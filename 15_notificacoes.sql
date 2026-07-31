-- ============================================================
-- 15 — NOTIFICAÇÃO DE REGISTRO POR E-MAIL
-- Rodar depois do 14.
--
-- O envio NUNCA acontece dentro da transação do registro. O
-- registro grava uma linha em notificacoes; um gatilho chama a
-- Edge Function pelo pg_net, que é assíncrono por natureza. Se
-- o Resend estiver fora do ar, o treinador não perde a sessão.
--
-- ANTES DE RODAR: troque a URL e a anon key no final do arquivo.
-- Os dois valores são públicos — a anon key já vive no navegador.
-- ============================================================

create extension if not exists pg_net;

-- ------------------------------------------------------------
-- 1. FILA
-- ------------------------------------------------------------
create table notificacoes (
  id          bigint generated always as identity primary key,
  tipo        text not null,
  sessao_id   bigint references sessoes(id) on delete cascade,
  payload     jsonb not null,
  criado_em   timestamptz not null default now(),
  enviado_em  timestamptz,
  erro        text,
  tentativas  int not null default 0
);

create index on notificacoes (enviado_em) where enviado_em is null;

alter table notificacoes enable row level security;

create policy "notificacoes so gestao" on notificacoes for select
  using (app_papel() in ('gestao','admin'));


-- ------------------------------------------------------------
-- 2. REGISTRAR SESSÃO — mesma assinatura, agora enfileirando
-- ------------------------------------------------------------
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
    -- devolve o número: o encontro não aconteceu
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
      'pendente_remarcar', v_nova is null
    );

  else
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

    v_resultado := jsonb_build_object(
      'registrada', true,
      'pesquisa',   true,
      'treinador',  v_treinador_n,
      'links',      v_links
    );
  end if;

  -- ---------- enfileira o aviso para a coordenação ----------
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
    'conflito',        v_conflito
  ));

  return v_resultado;
end $$;

revoke execute on function registrar_sessao(
  bigint, status_sessao, text, text, text, text[], text, timestamptz
) from anon;


-- ------------------------------------------------------------
-- 3. GATILHO — chama a Edge Function sem travar a transação
--
-- >>> TROQUE OS DOIS VALORES ABAIXO <<<
-- A URL do projeto e a anon key. Ambas são públicas: a anon key
-- já está no bundle do site. Nada sigiloso vive aqui.
-- ------------------------------------------------------------
create or replace function notificacao_disparar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url  text := 'https://SEUPROJETO.supabase.co/functions/v1/notificar';
  v_anon text := 'COLE_A_ANON_KEY_AQUI';
begin
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_anon),
    body    := jsonb_build_object('notificacao_id', new.id)
  );
  return new;
end $$;

create trigger trg_notificacao_disparar
  after insert on notificacoes
  for each row execute function notificacao_disparar();

notify pgrst, 'reload schema';
