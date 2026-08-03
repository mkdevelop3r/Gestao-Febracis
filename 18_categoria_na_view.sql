-- ============================================================
-- 18 — CATEGORIA NA vw_perguntas_resultado
-- Rodar depois do 17.
--
-- O 17 acrescentou a coluna categoria em pesquisa_perguntas, mas a
-- view lista colunas explicitamente e não a expunha. Sem categoria no
-- select, o app não separa NPS / livres / aberta nem preenche o
-- seletor de categoria de cada pergunta.
--
-- create or replace view só deixa ACRESCENTAR coluna no fim — não dá
-- para reordenar nem renomear. Por isso a ordem original é mantida e
-- categoria entra por último. Se mesmo assim vier o erro 42P16
-- (cannot change name of view column ...), a definição viva já diverge
-- desta; nesse caso rode antes:
--     drop view if exists vw_perguntas_resultado;
-- e depois este create.
--
-- security_invoker = on é obrigatório: sem ele a view roda como dona
-- do banco e o treinador enxergaria perguntas de processos que não são
-- dele. Mantido abaixo.
-- ============================================================

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
  pg.nucleo,
  pg.categoria
from pesquisa_modelos m
join pesquisa_perguntas pg on pg.modelo_id = m.id
where m.tipo = 'resultado' and m.ativo and m.processo_id is not null;

notify pgrst, 'reload schema';
