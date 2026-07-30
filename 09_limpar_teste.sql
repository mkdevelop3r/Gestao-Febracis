-- ============================================================
-- 09 — LIMPAR DADOS DE TESTE
--
-- Apaga os processos de demonstração e tudo que nasceu deles.
-- NÃO toca em: auth.users, perfis, treinadores, pesquisa_modelos
-- e pesquisa_perguntas. Seu login e as perguntas continuam.
--
-- Rode bloco por bloco, conferindo o passo 1 antes de seguir.
-- ============================================================

-- ------------------------------------------------------------
-- 1. O QUE VAI SUMIR — confira antes
-- ------------------------------------------------------------
select p.codigo, p.tipo, c.nome as cliente,
       (select count(*) from sessoes         where processo_id = p.id) as sessoes,
       (select count(*) from participantes   where processo_id = p.id) as participantes,
       (select count(*) from entregas        where processo_id = p.id) as entregas,
       (select count(*) from pesquisa_envios where processo_id = p.id) as envios
  from processos p
  join clientes c on c.id = p.cliente_id
 where p.codigo in ('CCH-0001', 'MTR-0001');


-- ------------------------------------------------------------
-- 2. APAGAR
-- Um delete só: sessões, participantes, entregas, envios,
-- respostas e alertas caem junto por cascata.
-- ------------------------------------------------------------
delete from processos
 where codigo in ('CCH-0001', 'MTR-0001');

delete from clientes
 where nome in ('Clécio Andrade', 'Grupo Alpha');

-- Sobrou algum alerta solto de teste
delete from alertas where processo_id is null;


-- ------------------------------------------------------------
-- 3. RECOMEÇAR A NUMERAÇÃO (opcional)
-- Só faz sentido com as tabelas vazias. Deixa os ids reais
-- começando em 1, o que ajuda na hora de conferir no piloto.
-- ------------------------------------------------------------
alter table processos         alter column id restart with 1;
alter table sessoes           alter column id restart with 1;
alter table clientes          alter column id restart with 1;
alter table participantes     alter column id restart with 1;
alter table entregas          alter column id restart with 1;
alter table pesquisa_envios   alter column id restart with 1;
alter table pesquisa_respostas alter column id restart with 1;
alter table alertas           alter column id restart with 1;


-- ------------------------------------------------------------
-- 4. CONFERÊNCIA — tudo zero, menos as três últimas linhas
-- ------------------------------------------------------------
select 'processos'          as tabela, count(*) from processos
union all select 'clientes',           count(*) from clientes
union all select 'sessoes',            count(*) from sessoes
union all select 'participantes',      count(*) from participantes
union all select 'entregas',           count(*) from entregas
union all select 'pesquisa_envios',    count(*) from pesquisa_envios
union all select 'pesquisa_respostas', count(*) from pesquisa_respostas
union all select 'alertas',            count(*) from alertas
union all select '— mantidos —',       null
union all select 'perfis',             count(*) from perfis
union all select 'treinadores',        count(*) from treinadores
union all select 'pesquisa_perguntas', count(*) from pesquisa_perguntas;
