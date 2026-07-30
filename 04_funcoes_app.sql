-- ============================================================
-- 04 — FUNÇÕES QUE O APP CHAMA
-- Rodar depois de 01 e 03.
--
-- Por que função e não insert direto do app:
-- registrar uma sessão e criar o envio da pesquisa é uma
-- operação só. E o treinador NÃO pode ter permissão de inserir
-- em pesquisa_envios pelo cliente — se tivesse, poderia forjar
-- envio. Aqui ele chama a função, a função faz as duas coisas.
-- ============================================================

-- ------------------------------------------------------------
-- 0. ALERTAS
-- Nota baixa precisa chegar em alguém no mesmo dia. Relatório
-- mensal avisa quando o cliente já foi embora.
-- ------------------------------------------------------------
create table alertas (
  id           bigint generated always as identity primary key,
  tipo         text not null,
  severidade   text not null default 'atencao',
  processo_id  bigint references processos(id) on delete cascade,
  sessao_id    bigint references sessoes(id) on delete set null,
  titulo       text not null,
  resolvido_em timestamptz,
  criado_em    timestamptz not null default now()
);

create index on alertas (resolvido_em) where resolvido_em is null;

alter table alertas enable row level security;

create policy "alertas so gestao" on alertas for all
  using (app_papel() in ('gestao','admin'));


-- ------------------------------------------------------------
-- 1. REGISTRAR SESSÃO
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
  v_token       text;
begin
  -- Permissão: o treinador dono do processo, ou a gestão.
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

  -- Cliente que não veio não recebe pesquisa de satisfação.
  if p_status <> 'realizada' then
    return jsonb_build_object('registrada', true, 'pesquisa', false);
  end if;

  select id into v_modelo_id
    from pesquisa_modelos
   where tipo = 'satisfacao' and ativo
   order by versao desc limit 1;

  insert into pesquisa_envios (modelo_id, sessao_id, processo_id, canal)
  values (v_modelo_id, p_sessao_id, v_processo_id, 'whatsapp')
  returning token into v_token;

  return jsonb_build_object('registrada', true, 'pesquisa', true, 'token', v_token);
end $$;

revoke execute on function registrar_sessao from anon;


-- ------------------------------------------------------------
-- 2. ABRIR A PESQUISA (rota pública /s/:token)
-- O anônimo não enxerga tabela nenhuma. Ele chama esta função,
-- que devolve só o necessário para desenhar a tela.
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
begin
  select en.*, p.tipo, p.total_sessoes, s.numero, s.agendado_inicio,
         c.nome as cliente, t.nome as treinador
    into e
    from pesquisa_envios en
    join processos   p on p.id = en.processo_id
    join clientes    c on c.id = p.cliente_id
    join treinadores t on t.id = p.treinador_id
    left join sessoes s on s.id = en.sessao_id
   where en.token = p_token;

  if not found then
    return jsonb_build_object('estado', 'invalido');
  end if;
  if e.respondido_em is not null then
    return jsonb_build_object('estado', 'respondida', 'cliente', e.cliente);
  end if;
  if e.expira_em < now() then
    return jsonb_build_object('estado', 'expirada', 'treinador', e.treinador);
  end if;

  select jsonb_agg(jsonb_build_object(
           'chave', pg.chave, 'enunciado', pg.enunciado, 'formato', pg.formato
         ) order by pg.ordem)
    into v
    from pesquisa_perguntas pg
   where pg.modelo_id = e.modelo_id;

  return jsonb_build_object(
    'estado',    'aberta',
    'cliente',   e.cliente,
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
-- 3. RESPONDER
-- p_respostas: [{"chave":"qualidade","nota":9,"texto":null}, ...]
-- ------------------------------------------------------------
create or replace function pesquisa_responder(p_token text, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_envio  pesquisa_envios%rowtype;
  v_item   jsonb;
  v_perg   bigint;
  v_baixa  boolean := false;
begin
  select * into v_envio from pesquisa_envios where token = p_token;

  if not found                       then return jsonb_build_object('estado','invalido');   end if;
  if v_envio.respondido_em is not null then return jsonb_build_object('estado','respondida'); end if;
  if v_envio.expira_em < now()       then return jsonb_build_object('estado','expirada');   end if;

  for v_item in select * from jsonb_array_elements(p_respostas) loop
    select id into v_perg
      from pesquisa_perguntas
     where modelo_id = v_envio.modelo_id
       and chave = (v_item->>'chave');

    if v_perg is not null then
      insert into pesquisa_respostas (envio_id, pergunta_id, nota, texto)
      values (
        v_envio.id, v_perg,
        nullif(v_item->>'nota','')::numeric,
        nullif(v_item->>'texto','')
      )
      on conflict (envio_id, pergunta_id) do nothing;

      if coalesce(nullif(v_item->>'nota','')::numeric, 10) <= 5 then
        v_baixa := true;
      end if;
    end if;
  end loop;

  update pesquisa_envios set respondido_em = now() where id = v_envio.id;

  -- Nota baixa vira alerta na hora, não relatório no fim do mês.
  if v_baixa then
    insert into alertas (tipo, severidade, processo_id, sessao_id, titulo)
    values ('nota_baixa', 'critico', v_envio.processo_id, v_envio.sessao_id,
            'Cliente avaliou uma sessão com nota 5 ou menos');
  end if;

  return jsonb_build_object('estado', 'ok');
end $$;

grant execute on function pesquisa_responder(text, jsonb) to anon;
