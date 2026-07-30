-- ============================================================
-- 07 — O REGISTRO DEVOLVE OS LINKS
-- Rodar depois do 06.
--
-- Enquanto o disparo automático não existe, quem envia é o
-- treinador. Então a função precisa entregar na mão dele o
-- nome, o telefone e o token de cada destinatário.
-- ============================================================

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
  v_links       jsonb;
  v_treinador   text;
begin
  select p.id, t.nome into v_processo_id, v_treinador
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

  if p_status <> 'realizada' then
    return jsonb_build_object('registrada', true, 'pesquisa', false);
  end if;

  select id into v_modelo_id
    from pesquisa_modelos
   where tipo = 'satisfacao' and ativo
   order by versao desc limit 1;

  -- Sala cheia: um link por participante.
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

  -- Ninguém cadastrado: um link só, para o contato do cliente.
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
    'treinador',  v_treinador,
    'links',      v_links
  );
end $$;

revoke execute on function registrar_sessao from anon;
