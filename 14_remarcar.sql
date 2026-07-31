-- ============================================================
-- 14 — REMARCAR E FALTAR
-- Rodar depois do 13.
--
-- Hoje "remarcada" e "faltou" fecham a sessão e ela some da
-- agenda: ninguém remarca e não sobra pendência em lugar nenhum.
--
-- Desenho novo:
--   · encontro que não aconteceu devolve o número à sequência
--     (a sessão 3 continua sendo a 3ª — a que falhou não conta)
--   · se o treinador já souber a nova data, a substituta nasce
--     na hora, com o mesmo número
--   · se não souber, vira pendência visível para a coordenação
-- ============================================================

alter table sessoes
  add column if not exists remarcada_para bigint references sessoes(id) on delete set null;

comment on column sessoes.remarcada_para is
  'Sessão que substituiu esta. Nulo em sessão não realizada = pendente de remarcação.';


-- ------------------------------------------------------------
-- registrar_sessao com nova data opcional
--
-- Acrescentar parâmetro NÃO substitui a função: o Postgres cria
-- uma sobrecarga ao lado da antiga, e aí o PostgREST não sabe
-- qual chamar. A versão de 7 argumentos precisa sair antes.
-- ------------------------------------------------------------
drop function if exists registrar_sessao(
  bigint, status_sessao, text, text, text, text[], text
);

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
  v_modelo_id   bigint;
  v_token       text;
  v_links       jsonb;
  v_numero      int;
  v_duracao     interval;
  v_nova        bigint;
  v_conflito    boolean := false;
begin
  select p.id, p.treinador_id, t.nome,
         s.numero, s.agendado_fim - s.agendado_inicio
    into v_processo_id, v_treinador, v_treinador_n, v_numero, v_duracao
    from sessoes s
    join processos   p on p.id = s.processo_id
    join treinadores t on t.id = p.treinador_id
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

  -- ---------- não aconteceu ----------
  if p_status <> 'realizada' then

    -- devolve o número à sequência: o encontro não ocorreu
    update sessoes set numero = null where id = p_sessao_id;

    if p_nova_data is not null then
      -- confere choque antes de inserir: se der erro aqui, a
      -- transação inteira cai e o registro se perde
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

    return jsonb_build_object(
      'registrada',    true,
      'pesquisa',      false,
      'remarcada',     v_nova is not null,
      'nova_sessao_id', v_nova,
      'conflito',      v_conflito,
      'treinador',     v_treinador_n,
      'pendente_remarcar', v_nova is null
    );
  end if;

  -- ---------- aconteceu: dispara a pesquisa ----------
  select id into v_modelo_id
    from pesquisa_modelos
   where tipo = 'satisfacao' and ativo
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

  return jsonb_build_object(
    'registrada', true,
    'pesquisa',   true,
    'treinador',  v_treinador_n,
    'links',      v_links
  );
end $$;

revoke execute on function registrar_sessao(
  bigint, status_sessao, text, text, text, text[], text, timestamptz
) from anon;

-- Função nova só aparece na API depois que o cache recarrega.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Encontros que não aconteceram e ninguém remarcou
-- ------------------------------------------------------------
create or replace view vw_precisa_remarcar
with (security_invoker = on) as
select
  s.id                as sessao_id,
  s.status,
  s.agendado_inicio   as era_para_ser_em,
  s.resumo            as motivo,
  p.id                as processo_id,
  p.codigo,
  p.tipo,
  c.nome              as cliente,
  t.nome              as treinador,
  greatest(0, extract(day from now() - s.agendado_inicio)::int) as dias_parado
from sessoes s
join processos   p on p.id = s.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
where s.status in ('remarcada', 'faltou')
  and s.remarcada_para is null;


-- ------------------------------------------------------------
-- Faltas e remarcações pendentes na lista de processos
-- (colunas acrescentadas no fim — create or replace só permite isso)
-- ------------------------------------------------------------
create or replace view vw_processos_ativos
with (security_invoker = on) as
select
  p.id,
  p.codigo,
  p.tipo,
  p.total_sessoes,
  c.nome     as cliente,
  c.empresa,
  t.id       as treinador_id,
  t.nome     as treinador,
  (select count(*) from sessoes s
    where s.processo_id = p.id)                       as sessoes_criadas,
  (select count(*) from sessoes s
    where s.processo_id = p.id and s.status = 'realizada') as sessoes_realizadas,
  coalesce((select max(s.numero) from sessoes s
    where s.processo_id = p.id), 0)                   as ultimo_numero,
  (select min(s.agendado_inicio) from sessoes s
    where s.processo_id = p.id
      and s.status = 'agendada'
      and s.agendado_inicio > now())                  as proxima_em,
  (select count(*) from participantes pa
    where pa.processo_id = p.id and pa.ativo)         as participantes,
  (select count(*) from sessoes s
    where s.processo_id = p.id and s.status = 'faltou')    as faltas,
  (select count(*) from sessoes s
    where s.processo_id = p.id
      and s.status in ('remarcada','faltou')
      and s.remarcada_para is null)                   as precisa_remarcar
from processos p
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
where p.status = 'ativo'
order by c.nome;
