-- ============================================================
-- 06 — MENTORIAS: ENTREGAS E PARTICIPANTES
-- Rodar depois de 01, 03, 04.
--
-- Coaching progride por sessão (3 de 10).
-- Mentoria progride por entrega concluída — não tem número fechado.
-- E mentoria tem sala cheia: a pesquisa vai para cada participante,
-- não só para quem assinou o contrato.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENTREGAS
-- ------------------------------------------------------------
create type status_entrega as enum ('planejada', 'em_andamento', 'concluida', 'cancelada');

create table entregas (
  id            bigint generated always as identity primary key,
  processo_id   bigint not null references processos(id) on delete cascade,
  ordem         int not null,
  titulo        text not null,
  descricao     text,
  status        status_entrega not null default 'planejada',
  prazo         date,
  concluida_em  date,
  sessao_id     bigint references sessoes(id) on delete set null,
  criado_em     timestamptz not null default now(),
  unique (processo_id, ordem)
);

create index on entregas (processo_id, status);

-- ------------------------------------------------------------
-- 2. PARTICIPANTES
-- ------------------------------------------------------------
create table participantes (
  id           bigint generated always as identity primary key,
  processo_id  bigint not null references processos(id) on delete cascade,
  nome         text not null,
  email        text,
  telefone     text,
  cargo        text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create index on participantes (processo_id) where ativo;

-- A pesquisa passa a saber de quem é a resposta.
alter table pesquisa_envios
  add column participante_id bigint references participantes(id) on delete set null;

-- ------------------------------------------------------------
-- 3. SEGURANÇA
-- ------------------------------------------------------------
alter table entregas      enable row level security;
alter table participantes enable row level security;

create policy "entregas do treinador" on entregas for all
  using (
    app_papel() in ('gestao','admin')
    or exists (select 1 from processos p
                where p.id = entregas.processo_id
                  and p.treinador_id = app_treinador_id())
  );

create policy "participantes do treinador" on participantes for all
  using (
    app_papel() in ('gestao','admin')
    or exists (select 1 from processos p
                where p.id = participantes.processo_id
                  and p.treinador_id = app_treinador_id())
  );

-- ------------------------------------------------------------
-- 4. REGISTRAR SESSÃO — agora um envio por participante
-- ------------------------------------------------------------
create or replace function registrar_sessao(
  p_sessao_id     bigint,
  p_status        status_sessao,
  p_resumo        text default null,
  p_plano         text default null,
  p_proximos      text default null,
  p_ferramentas   text[] default null,
  p_compromissos  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processo_id bigint;
  v_modelo_id   bigint;
  v_qtd         int;
begin
  select p.id into v_processo_id
    from sessoes s
    join processos p on p.id = s.processo_id
   where s.id = p_sessao_id
     and s.status = 'agendada'
     and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id());

  if v_processo_id is null then
    raise exception 'Sessão não encontrada, já registrada ou sem permissão';
  end if;

  update sessoes
     set status          = p_status,
         realizado_em    = case when p_status = 'realizada' then now() end,
         resumo          = p_resumo,
         plano_de_acao   = p_plano,
         proximos_passos = p_proximos,
         ferramentas     = p_ferramentas,
         compromissos    = p_compromissos,
         registrado_por  = auth.uid()
   where id = p_sessao_id;

  if p_status <> 'realizada' then
    return jsonb_build_object('registrada', true, 'pesquisa', false);
  end if;

  select id into v_modelo_id
    from pesquisa_modelos
   where tipo = 'satisfacao' and ativo
   order by versao desc limit 1;

  -- Tem sala cheia? Um link por pessoa.
  insert into pesquisa_envios (modelo_id, sessao_id, processo_id, participante_id, canal)
  select v_modelo_id, p_sessao_id, v_processo_id, pa.id, 'whatsapp'
    from participantes pa
   where pa.processo_id = v_processo_id and pa.ativo;

  get diagnostics v_qtd = row_count;

  -- Ninguém cadastrado: um link só, para o contato do cliente.
  if v_qtd = 0 then
    insert into pesquisa_envios (modelo_id, sessao_id, processo_id, canal)
    values (v_modelo_id, p_sessao_id, v_processo_id, 'whatsapp');
    v_qtd := 1;
  end if;

  return jsonb_build_object('registrada', true, 'pesquisa', true, 'enviados', v_qtd);
end $$;

revoke execute on function registrar_sessao from anon;

-- ------------------------------------------------------------
-- 5. ABRIR A PESQUISA — saúda o participante pelo nome
-- ------------------------------------------------------------
create or replace function pesquisa_abrir(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  e record;
  v_quem text;
begin
  select en.*, p.tipo, p.total_sessoes, s.numero, s.agendado_inicio,
         c.nome as cliente, t.nome as treinador, pa.nome as participante
    into e
    from pesquisa_envios en
    join processos   p  on p.id = en.processo_id
    join clientes    c  on c.id = p.cliente_id
    join treinadores t  on t.id = p.treinador_id
    left join sessoes       s  on s.id = en.sessao_id
    left join participantes pa on pa.id = en.participante_id
   where en.token = p_token;

  if not found                       then return jsonb_build_object('estado','invalido');  end if;
  if e.respondido_em is not null      then return jsonb_build_object('estado','respondida',
                                                'cliente', coalesce(e.participante, e.cliente)); end if;
  if e.expira_em < now()              then return jsonb_build_object('estado','expirada',
                                                'treinador', e.treinador); end if;

  v_quem := coalesce(e.participante, e.cliente);

  select jsonb_agg(jsonb_build_object(
           'chave', pg.chave, 'enunciado', pg.enunciado, 'formato', pg.formato
         ) order by pg.ordem)
    into v
    from pesquisa_perguntas pg
   where pg.modelo_id = e.modelo_id;

  return jsonb_build_object(
    'estado',    'aberta',
    'cliente',   v_quem,
    'empresa',   e.cliente,
    'treinador', e.treinador,
    'tipo',      e.tipo,
    'numero',    e.numero,
    'total',     e.total_sessoes,
    'data',      e.agendado_inicio,
    'perguntas', coalesce(v, '[]'::jsonb)
  );
end $$;

grant execute on function pesquisa_abrir(text) to anon;

-- ------------------------------------------------------------
-- 6. PROGRESSO E LINKS PENDENTES
-- ------------------------------------------------------------

-- Progresso da mentoria = entregas concluídas, não encontros realizados.
create view vw_progresso_mentoria
with (security_invoker = on) as
select
  p.id            as processo_id,
  p.codigo,
  c.nome          as cliente,
  t.nome          as treinador,
  count(e.id)                                          as entregas_total,
  count(e.id) filter (where e.status = 'concluida')     as entregas_concluidas,
  count(e.id) filter (where e.status <> 'concluida'
                        and e.prazo < current_date)     as entregas_atrasadas,
  case when count(e.id) = 0 then 0
       else round(100.0 * count(e.id) filter (where e.status = 'concluida')
                  / count(e.id)) end                    as percentual
from processos p
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
left join entregas e on e.processo_id = p.id
where p.tipo = 'mentoria'
group by p.id, p.codigo, c.nome, t.nome;

-- Enquanto o disparo automático não existe: os links a enviar à mão.
create view vw_links_pendentes
with (security_invoker = on) as
select
  en.token,
  coalesce(pa.nome, c.nome)     as destinatario,
  coalesce(pa.telefone, c.telefone) as telefone,
  c.nome                        as cliente,
  t.nome                        as treinador,
  s.agendado_inicio             as sessao_em,
  en.criado_em
from pesquisa_envios en
join processos   p on p.id = en.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
left join sessoes       s  on s.id = en.sessao_id
left join participantes pa on pa.id = en.participante_id
where en.respondido_em is null
  and en.expira_em > now()
order by en.criado_em desc;


-- ============================================================
-- 7. MENTORIA DE TESTE — opcional, para ver funcionando
-- ============================================================
do $$
declare
  v_treinador_id bigint;
  v_cliente_id   bigint;
  v_processo_id  bigint;
begin
  select id into v_treinador_id from treinadores where perfil_id is not null limit 1;
  if v_treinador_id is null then
    raise notice 'Nenhum treinador ligado a um perfil. Rode o 05 primeiro.';
    return;
  end if;

  select id into v_cliente_id from clientes where nome = 'Grupo Alpha';
  if v_cliente_id is null then
    insert into clientes (nome, empresa, email, telefone, cidade)
    values ('Grupo Alpha', 'Grupo Alpha', 'contato@grupoalpha.com.br',
            '+55 71 98000-1111', 'Salvador')
    returning id into v_cliente_id;
  end if;

  insert into processos (codigo, tipo, cliente_id, treinador_id, total_sessoes)
  values ('MTR-0001', 'mentoria', v_cliente_id, v_treinador_id, null)
  on conflict (codigo) do update set treinador_id = excluded.treinador_id
  returning id into v_processo_id;

  insert into participantes (processo_id, nome, telefone, cargo)
  select v_processo_id, x.nome, x.tel, x.cargo
    from (values
      ('Ana Prado',    '+55 71 98000-2001', 'Diretora'),
      ('Bruno Sales',  '+55 71 98000-2002', 'Gerente comercial'),
      ('Ítalo Menezes','+55 71 98000-2003', 'Coordenador')
    ) as x(nome, tel, cargo)
   where not exists (select 1 from participantes where processo_id = v_processo_id);

  insert into entregas (processo_id, ordem, titulo, prazo, status)
  select v_processo_id, x.ordem, x.titulo, current_date + x.dias, x.st::status_entrega
    from (values
      (1, 'Diagnóstico da operação',        7,  'concluida'),
      (2, 'Redesenho do funil comercial',  21,  'em_andamento'),
      (3, 'Plano de metas por equipe',     35,  'planejada'),
      (4, 'Ritual de gestão semanal',      49,  'planejada')
    ) as x(ordem, titulo, dias, st)
   on conflict (processo_id, ordem) do nothing;

  insert into sessoes (processo_id, numero, agendado_inicio, agendado_fim)
  values (v_processo_id, 3, now() + interval '2 hours', now() + interval '4 hours')
  on conflict (processo_id, numero) do update
    set agendado_inicio = excluded.agendado_inicio,
        agendado_fim    = excluded.agendado_fim,
        status          = 'agendada';

  raise notice 'Mentoria MTR-0001 criada: 3 participantes, 4 entregas, 1 encontro hoje.';
end $$;

select * from vw_progresso_mentoria;
