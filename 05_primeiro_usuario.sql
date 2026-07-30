-- ============================================================
-- 05 — PRIMEIRO USUÁRIO E SESSÃO DE TESTE
--
-- ANTES de rodar:
--   Supabase → Authentication → Users → Add user
--   marque "Auto Confirm User" (senão o login recusa)
--   copie o UUID que aparece na lista
--
-- Troque os três valores abaixo e rode o arquivo inteiro.
-- Pode rodar mais de uma vez sem duplicar.
-- ============================================================

do $$
declare
  -- >>> TROQUE AQUI <<<
  v_uuid  uuid := '00000000-0000-0000-0000-000000000000';
  v_nome  text := 'Carol';
  v_email text := 'carol@febracis.com.br';
  -- >>> ---------- <<<

  v_treinador_id bigint;
  v_cliente_id   bigint;
  v_processo_id  bigint;
begin
  if v_uuid = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Troque v_uuid pelo UUID do usuário criado em Authentication → Users';
  end if;

  -- 1. Perfil
  insert into perfis (id, nome, email, papel)
  values (v_uuid, v_nome, v_email, 'treinador')
  on conflict (id) do update
    set nome = excluded.nome, email = excluded.email;

  -- 2. Liga ao treinador que já veio no seed do 01
  update treinadores
     set perfil_id = v_uuid, atua_coaching = true
   where nome = v_nome
  returning id into v_treinador_id;

  if v_treinador_id is null then
    insert into treinadores (perfil_id, nome, aliases, atua_mentoria, atua_coaching)
    values (v_uuid, v_nome, array[v_nome], true, true)
    returning id into v_treinador_id;
  end if;

  -- 3. Cliente de teste
  select id into v_cliente_id
    from clientes
   where lower(email) = lower('clecio@exemplo.com.br');

  if v_cliente_id is null then
    insert into clientes (nome, empresa, email, telefone, cidade)
    values ('Clécio Andrade', 'Olhos d''Água', 'clecio@exemplo.com.br',
            '+55 71 98000-0000', 'Salvador')
    returning id into v_cliente_id;
  end if;

  -- 4. Processo de coaching, 10 sessões
  insert into processos (codigo, tipo, cliente_id, treinador_id, total_sessoes)
  values ('CCH-0001', 'coaching', v_cliente_id, v_treinador_id, 10)
  on conflict (codigo) do update set treinador_id = excluded.treinador_id
  returning id into v_processo_id;

  -- 5. Sessão daqui a 30 minutos — cai no "hoje" em qualquer fuso
  insert into sessoes (processo_id, numero, agendado_inicio, agendado_fim)
  values (v_processo_id, 3, now() + interval '30 minutes', now() + interval '90 minutes')
  on conflict (processo_id, numero) do update
    set agendado_inicio = excluded.agendado_inicio,
        agendado_fim    = excluded.agendado_fim,
        status          = 'agendada';

  raise notice 'Pronto. Treinador % (id %), processo CCH-0001, sessão 3 de 10 hoje.',
    v_nome, v_treinador_id;
end $$;

-- Conferência
select s.id, s.numero, s.status, s.agendado_inicio,
       c.nome as cliente, t.nome as treinador
  from sessoes s
  join processos   p on p.id = s.processo_id
  join clientes    c on c.id = p.cliente_id
  join treinadores t on t.id = p.treinador_id
 order by s.agendado_inicio desc
 limit 5;
