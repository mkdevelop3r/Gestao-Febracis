-- ============================================================
-- 11 — PROCESSOS ATIVOS PARA A TELA DE AGENDAMENTO
-- Rodar depois do 10.
--
-- security_invoker: o treinador vê os processos dele, a
-- coordenação vê todos. Mesma view, dois resultados.
-- ============================================================

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
    where pa.processo_id = p.id and pa.ativo)         as participantes
from processos p
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
where p.status = 'ativo'
order by c.nome;
