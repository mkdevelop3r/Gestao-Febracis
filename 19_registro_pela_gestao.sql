-- ============================================================
-- 19 — COORDENAÇÃO REGISTRA NO LUGAR DO TREINADOR
-- Rodar depois do 18.
--
-- A permissão já existia desde o 04. O que falta é registrar o
-- fato: quando a coordenação preenche por alguém que esqueceu,
-- isso precisa ficar visível. Resumo escrito por quem não estava
-- na sessão não pode se passar por relato do treinador.
-- ============================================================

alter table sessoes
  add column if not exists registrado_pela_gestao boolean not null default false;

comment on column sessoes.registrado_pela_gestao is
  'true = quem registrou foi a coordenação, não o treinador da sessão.';


create or replace function registrar_sessao(
  p_sessao_id     bigint,
  p_status        status_sessao,
  p_resumo        text default null,
  p_plano         text default null,
  p_proximos      text default null,
  p_ferramentas   text[] default null,
  p_compromissos  text default null,
  p_nova_data     timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processo_id bigint;
  v_treinador   bigint;
  v_treinador_n text;
  v_cliente_n   text;
  v_codigo      text;
  v_tipo        tipo_processo;
  v_quando      timestamptz;
  v_modelo_id   bigint;
  v_token       text;
  v_links       jsonb;
  v_numero      int;
  v_duracao     interval;
  v_nova        bigint;
  v_conflito    boolean := false;
  v_resultado   jsonb;
  v_pela_gestao boolean;
  v_quem        text;
begin
  select p.id, p.treinador_id, t.nome, c.nome, p.codigo, p.tipo,
         s.numero, s.agendado_inicio, s.agendado_fim - s.agendado_inicio
    into v_processo_id, v_treinador, v_treinador_n, v_cliente_n, v_codigo, v_tipo,
         v_numero, v_quando, v_duracao
    from sessoes s
    join processos   p on p.id = s.processo_id
    join clientes    c on c.id = p.cliente_id
    join treinadores t on t.id = p.treinador_id
   where s.id = p_sessao_id
     and s.status = 'agendada'
     and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id());

  if v_processo_id is null then
    raise exception 'Sessão não encontrada, já registrada ou sem permissão';
  end if;

  -- Coordenação preenchendo por alguém que não é ela própria.
  -- Se a Elis tivesse processo como treinadora, o dela não conta.
  v_pela_gestao := app_papel() in ('gestao','admin')
                   and v_treinador is distinct from app_treinador_id();

  select nome into v_quem from perfis where id = auth.uid();

  update sessoes
     set status                 = p_status,
         realizado_em           = case when p_status = 'realizada' then now() end,
         resumo                 = p_resumo,
         plano_de_acao          = p_plano,
         proximos_passos        = p_proximos,
         ferramentas            = p_ferramentas,
         compromissos           = p_compromissos,
         registrado_por         = auth.uid(),
         registrado_pela_gestao = v_pela_gestao
   where id = p_sessao_id;

  if p_status <> 'realizada' then
    update sessoes set numero = null where id = p_sessao_id;

    if p_nova_data is not null then
      if exists (
        select 1 from sessoes s2
         where s2.treinador_id = v_treinador
           and s2.status = 'agendada'
           and tstzrange(p_nova_data, p_nova_data + v_duracao) && s2.periodo
      ) then
        v_conflito := true;
      else
        insert into sessoes (processo_id, numero, agendado_inicio, agendado_fim)
        values (v_processo_id, v_numero, p_nova_data, p_nova_data + v_duracao)
        returning id into v_nova;

        update sessoes set remarcada_para = v_nova where id = p_sessao_id;
      end if;
    end if;

    v_resultado := jsonb_build_object(
      'registrada',        true,
      'pesquisa',          false,
      'remarcada',         v_nova is not null,
      'nova_sessao_id',    v_nova,
      'conflito',          v_conflito,
      'treinador',         v_treinador_n,
      'pela_gestao',       v_pela_gestao,
      'pendente_remarcar', v_nova is null
    );

  else
    select id into v_modelo_id
      from pesquisa_modelos
     where tipo = 'satisfacao' and ativo and processo_id is null
     order by versao desc limit 1;

    with novos as (
      insert into pesquisa_envios (modelo_id, sessao_id, processo_id, participante_id, canal)
      select v_modelo_id, p_sessao_id, v_processo_id, pa.id, 'whatsapp'
        from participantes pa
       where pa.processo_id = v_processo_id and pa.ativo
      returning participante_id, token
    )
    select jsonb_agg(jsonb_build_object(
             'nome', pa.nome, 'telefone', pa.telefone, 'token', n.token))
      into v_links
      from novos n
      join participantes pa on pa.id = n.participante_id;

    if v_links is null then
      insert into pesquisa_envios (modelo_id, sessao_id, processo_id, canal)
      values (v_modelo_id, p_sessao_id, v_processo_id, 'whatsapp')
      returning token into v_token;

      select jsonb_build_array(jsonb_build_object(
               'nome', c.nome, 'telefone', c.telefone, 'token', v_token))
        into v_links
        from processos p
        join clientes c on c.id = p.cliente_id
       where p.id = v_processo_id;
    end if;

    v_resultado := jsonb_build_object(
      'registrada',  true,
      'pesquisa',    true,
      'treinador',   v_treinador_n,
      'pela_gestao', v_pela_gestao,
      'links',       v_links
    );
  end if;

  insert into notificacoes (tipo, sessao_id, payload)
  values ('sessao_registrada', p_sessao_id, jsonb_build_object(
    'status',          p_status,
    'treinador',       v_treinador_n,
    'cliente',         v_cliente_n,
    'codigo',          v_codigo,
    'tipo_processo',   v_tipo,
    'numero',          v_numero,
    'era_para_ser_em', v_quando,
    'resumo',          p_resumo,
    'plano',           p_plano,
    'proximos',        p_proximos,
    'remarcada_para',  p_nova_data,
    'conflito',        v_conflito,
    'pela_gestao',     v_pela_gestao,
    'registrado_por',  v_quem
  ));

  return v_resultado;
end $$;

revoke execute on function registrar_sessao(
  bigint, status_sessao, text, text, text, text[], text, timestamptz
) from anon;


-- ------------------------------------------------------------
-- A fila de pendências passa a levar o que a tela precisa para
-- registrar dali mesmo, sem ida e volta.
-- ------------------------------------------------------------
drop view if exists vw_piloto_pendencias;

create view vw_piloto_pendencias
with (security_invoker = on) as
select
  s.id                as sessao_id,
  s.numero,
  s.agendado_inicio,
  s.agendado_fim,
  p.id                as processo_id,
  p.codigo,
  p.tipo,
  p.total_sessoes,
  c.nome              as cliente,
  t.nome              as treinador,
  (select count(*) from participantes pa
    where pa.processo_id = p.id and pa.ativo)                  as participantes,
  greatest(0, extract(day from now() - s.agendado_fim)::int)   as dias_parada
from sessoes s
join processos   p on p.id = s.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
where s.status = 'agendada'
  and s.agendado_fim < now();


-- ------------------------------------------------------------
-- Quanto do registro está sendo feito pela coordenação.
-- Se este número subir, o problema não é a Elis: é o treinador
-- não estar usando o sistema.
-- ------------------------------------------------------------
create or replace view vw_registro_por_quem
with (security_invoker = on) as
select
  t.id                                                        as treinador_id,
  t.nome                                                      as treinador,
  count(*)                                                    as registradas,
  count(*) filter (where s.registrado_pela_gestao)            as pela_coordenacao,
  round(100.0 * count(*) filter (where s.registrado_pela_gestao)
        / nullif(count(*), 0))                                as percentual_coordenacao
from sessoes s
join processos   p on p.id = s.processo_id
join treinadores t on t.id = p.treinador_id
where s.status <> 'agendada'
group by t.id, t.nome;

notify pgrst, 'reload schema';
