-- ============================================================
-- 16 — PERGUNTAS DE RESULTADO SOB MEDIDA
-- Rodar depois do 15.
--
-- A pesquisa de cada encontro continua padrão, igual para todos.
-- A de resultado passa a aceitar perguntas próprias por mentoria.
--
-- Desenho: o modelo da mentoria CONTÉM o núcleo fixo copiado
-- mais as perguntas sob medida. Quem responde vê uma pesquisa
-- só; a agregação distingue pelo campo 'nucleo'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MODELO POR PROCESSO
-- ------------------------------------------------------------
alter table pesquisa_modelos
  add column if not exists processo_id bigint references processos(id) on delete cascade;

alter table pesquisa_perguntas
  add column if not exists nucleo boolean not null default true;

comment on column pesquisa_perguntas.nucleo is
  'true = pergunta padrão, comparável entre processos. false = sob medida.';

-- A unicidade antiga era (tipo, versao) e impede modelo por processo.
alter table pesquisa_modelos drop constraint if exists pesquisa_modelos_tipo_versao_key;

create unique index if not exists modelo_global_uniq
  on pesquisa_modelos (tipo, versao) where processo_id is null;

create unique index if not exists modelo_processo_uniq
  on pesquisa_modelos (processo_id, tipo, versao) where processo_id is not null;

-- Estas tabelas estavam sem RLS. Pergunta não é segredo, mas
-- escrita tem que passar pelas funções abaixo.
alter table pesquisa_modelos   enable row level security;
alter table pesquisa_perguntas enable row level security;

create policy "modelos legiveis" on pesquisa_modelos for select
  using (auth.uid() is not null);

create policy "perguntas legiveis" on pesquisa_perguntas for select
  using (auth.uid() is not null);


-- ------------------------------------------------------------
-- 2. SALVAR AS PERGUNTAS DE UMA MENTORIA
-- Cada salvamento cria uma versão nova. Editar não reescreve o
-- passado: quem já respondeu continua ligado à versão que viu.
-- ------------------------------------------------------------
create or replace function salvar_perguntas_resultado(
  p_processo_id bigint,
  p_perguntas   jsonb   -- [{"enunciado":"...","formato":"nota_0_10"}]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_versao int;
  v_modelo bigint;
  v_ordem  int := 0;
  v_item   jsonb;
begin
  if not exists (
    select 1 from processos p
     where p.id = p_processo_id
       and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id())
  ) then
    raise exception 'Processo não encontrado ou sem permissão';
  end if;

  if jsonb_array_length(coalesce(p_perguntas, '[]'::jsonb)) > 3 then
    raise exception 'No máximo 3 perguntas sob medida — a pesquisa é respondida no celular';
  end if;

  update pesquisa_modelos set ativo = false
   where processo_id = p_processo_id and tipo = 'resultado';

  select coalesce(max(versao), 0) + 1 into v_versao
    from pesquisa_modelos
   where processo_id = p_processo_id and tipo = 'resultado';

  insert into pesquisa_modelos (tipo, versao, ativo, processo_id)
  values ('resultado', v_versao, true, p_processo_id)
  returning id into v_modelo;

  -- núcleo fixo, copiado do modelo global ativo
  insert into pesquisa_perguntas (modelo_id, ordem, chave, enunciado, formato, obrigatoria, nucleo)
  select v_modelo, pg.ordem, pg.chave, pg.enunciado, pg.formato, pg.obrigatoria, true
    from pesquisa_perguntas pg
    join pesquisa_modelos m on m.id = pg.modelo_id
   where m.tipo = 'resultado' and m.processo_id is null and m.ativo;

  select coalesce(max(ordem), 0) into v_ordem
    from pesquisa_perguntas where modelo_id = v_modelo;

  -- sob medida
  for v_item in select * from jsonb_array_elements(coalesce(p_perguntas, '[]'::jsonb)) loop
    if coalesce(trim(v_item->>'enunciado'), '') = '' then
      continue;
    end if;
    v_ordem := v_ordem + 1;
    insert into pesquisa_perguntas
      (modelo_id, ordem, chave, enunciado, formato, obrigatoria, nucleo)
    values (v_modelo, v_ordem, 'sob_medida_' || v_ordem,
            trim(v_item->>'enunciado'),
            coalesce(nullif(v_item->>'formato',''), 'nota_0_10')::formato_pergunta,
            true, false);
  end loop;

  return jsonb_build_object('modelo_id', v_modelo, 'versao', v_versao, 'perguntas', v_ordem);
end $$;

revoke execute on function salvar_perguntas_resultado from anon;


-- ------------------------------------------------------------
-- 3. ENVIAR A PESQUISA DE RESULTADO
-- Por enquanto manual: a coordenação decide o marco. Gatilho
-- automático por entrega concluída fica para depois do piloto.
-- ------------------------------------------------------------
create or replace function enviar_pesquisa_resultado(p_processo_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modelo bigint;
  v_links  jsonb;
  v_token  text;
begin
  if not exists (
    select 1 from processos p
     where p.id = p_processo_id
       and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id())
  ) then
    raise exception 'Processo não encontrado ou sem permissão';
  end if;

  -- prefere o modelo da mentoria; cai no global se não houver
  select id into v_modelo
    from pesquisa_modelos
   where tipo = 'resultado' and ativo and processo_id = p_processo_id
   order by versao desc limit 1;

  if v_modelo is null then
    select id into v_modelo
      from pesquisa_modelos
     where tipo = 'resultado' and ativo and processo_id is null
     order by versao desc limit 1;
  end if;

  if v_modelo is null then
    raise exception 'Nenhum modelo de pesquisa de resultado ativo';
  end if;

  with novos as (
    insert into pesquisa_envios (modelo_id, sessao_id, processo_id, participante_id, canal)
    select v_modelo, null, p_processo_id, pa.id, 'whatsapp'
      from participantes pa
     where pa.processo_id = p_processo_id and pa.ativo
    returning participante_id, token
  )
  select jsonb_agg(jsonb_build_object(
           'nome', pa.nome, 'telefone', pa.telefone, 'token', n.token))
    into v_links
    from novos n
    join participantes pa on pa.id = n.participante_id;

  if v_links is null then
    insert into pesquisa_envios (modelo_id, sessao_id, processo_id, canal)
    values (v_modelo, null, p_processo_id, 'whatsapp')
    returning token into v_token;

    select jsonb_build_array(jsonb_build_object(
             'nome', c.nome, 'telefone', c.telefone, 'token', v_token))
      into v_links
      from processos p
      join clientes c on c.id = p.cliente_id
     where p.id = p_processo_id;
  end if;

  return jsonb_build_object('enviada', true, 'links', v_links);
end $$;

revoke execute on function enviar_pesquisa_resultado from anon;


-- ------------------------------------------------------------
-- 4. LER AS PERGUNTAS SOB MEDIDA DE UM PROCESSO
-- ------------------------------------------------------------
create or replace view vw_perguntas_resultado
with (security_invoker = on) as
select
  m.processo_id,
  m.id      as modelo_id,
  m.versao,
  pg.id     as pergunta_id,
  pg.ordem,
  pg.chave,
  pg.enunciado,
  pg.formato,
  pg.nucleo
from pesquisa_modelos m
join pesquisa_perguntas pg on pg.modelo_id = m.id
where m.tipo = 'resultado' and m.ativo and m.processo_id is not null;


-- ------------------------------------------------------------
-- 5. CORREÇÃO: a média de satisfação estava somando tudo
-- Sem o filtro por tipo, as notas da pesquisa de resultado
-- entrariam na média de satisfação por treinador em silêncio.
-- ------------------------------------------------------------
create or replace view vw_piloto_satisfacao
with (security_invoker = on) as
select
  t.id                       as treinador_id,
  t.nome                     as treinador,
  round(avg(r.nota), 1)      as media,
  min(r.nota)                as pior_nota,
  count(distinct e.id)       as respostas
from pesquisa_respostas r
join pesquisa_envios    e  on e.id = r.envio_id
join pesquisa_modelos   m  on m.id = e.modelo_id
join pesquisa_perguntas pg on pg.id = r.pergunta_id
join processos          p  on p.id = e.processo_id
join treinadores        t  on t.id = p.treinador_id
where r.nota is not null
  and m.tipo = 'satisfacao'
  and pg.nucleo
group by t.id, t.nome;

notify pgrst, 'reload schema';
