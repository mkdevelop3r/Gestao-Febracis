-- ============================================================
-- 12 — DADOS DE TESTE (TEMPORÁRIO)
--
-- Tudo aqui nasce com código TST-, para sumir depois com um
-- comando só. Não crie dado de teste sem essa marca: daqui a
-- duas semanas ninguém lembra o que era real.
--
-- ANTES DE RODAR: troque os telefones pelo SEU número, com +55.
-- É assim que você testa o botão do WhatsApp de ponta a ponta.
-- ============================================================

do $$
declare
  v_tel_teste text := '+55 71 90000-0000';   -- >>> TROQUE PELO SEU <<<

  v_treinador  bigint;
  v_cli_coach  bigint;
  v_cli_mentor bigint;
  v_proc_coach bigint;
  v_proc_ment  bigint;
begin
  -- Rennan, pelo perfil
  select t.id into v_treinador
    from treinadores t
    join perfis pf on pf.id = t.perfil_id
   where pf.email = 'rennan.ogchesford@gmail.com';

  if v_treinador is null then
    select id into v_treinador from treinadores where nome = 'Rennan';
  end if;

  if v_treinador is null then
    raise exception 'Treinador Rennan não encontrado. Confira a tabela treinadores.';
  end if;

  -- ---------- COACHING: 1 pessoa, 10 sessões ----------
  select id into v_cli_coach from clientes where nome = 'TST- Marcos Vieira';
  if v_cli_coach is null then
    insert into clientes (nome, empresa, telefone, cidade)
    values ('TST- Marcos Vieira', 'Vieira Contabilidade', v_tel_teste, 'Salvador')
    returning id into v_cli_coach;
  end if;

  insert into processos (codigo, tipo, cliente_id, treinador_id, total_sessoes)
  values ('TST-CCH-001', 'coaching', v_cli_coach, v_treinador, 10)
  on conflict (codigo) do update set treinador_id = excluded.treinador_id
  returning id into v_proc_coach;

  -- ---------- MENTORIA: empresa com 3 participantes ----------
  select id into v_cli_mentor from clientes where nome = 'TST- Padaria Bela Vista';
  if v_cli_mentor is null then
    insert into clientes (nome, empresa, telefone, cidade)
    values ('TST- Padaria Bela Vista', 'Bela Vista Alimentos', v_tel_teste, 'Salvador')
    returning id into v_cli_mentor;
  end if;

  insert into processos (codigo, tipo, cliente_id, treinador_id, total_sessoes)
  values ('TST-MTR-001', 'mentoria', v_cli_mentor, v_treinador, null)
  on conflict (codigo) do update set treinador_id = excluded.treinador_id
  returning id into v_proc_ment;

  insert into participantes (processo_id, nome, telefone, cargo)
  select v_proc_ment, x.nome, v_tel_teste, x.cargo
    from (values
      ('TST- Sandra Lima',   'Sócia'),
      ('TST- Paulo Andrade', 'Gerente'),
      ('TST- Vera Nunes',    'Financeiro')
    ) as x(nome, cargo)
   where not exists (select 1 from participantes where processo_id = v_proc_ment);

  insert into entregas (processo_id, ordem, titulo, prazo, status)
  select v_proc_ment, x.ordem, x.titulo, current_date + x.dias, x.st::status_entrega
    from (values
      (1, 'Diagnóstico da operação',      7, 'concluida'),
      (2, 'Controle de custo por produto', 21, 'em_andamento'),
      (3, 'Rotina de caixa diário',       35, 'planejada'),
      (4, 'Plano de metas da equipe',     49, 'planejada')
    ) as x(ordem, titulo, dias, st)
   on conflict (processo_id, ordem) do nothing;

  raise notice 'Criados TST-CCH-001 (coaching) e TST-MTR-001 (mentoria, 3 participantes).';
end $$;

-- Confira: os dois devem aparecer na tela /agendar
select codigo, tipo, cliente, treinador, total_sessoes, participantes
  from vw_processos_ativos;


-- ============================================================
-- PARA APAGAR TUDO DEPOIS — rode só quando o piloto começar.
-- As sessões, participantes, entregas e pesquisas caem junto.
-- ============================================================
--
-- delete from processos where codigo like 'TST-%';
-- delete from clientes  where nome   like 'TST-%';
