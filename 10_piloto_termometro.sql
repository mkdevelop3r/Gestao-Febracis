-- ============================================================
-- 10 — TERMÔMETRO DO PILOTO
-- Rodar depois do 08.
--
-- Não é o painel da diretoria. São os quatro números que dizem
-- se o piloto está funcionando: o treinador registra? o cliente
-- responde? Todas com security_invoker, então o RLS decide o
-- que cada pessoa enxerga.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SESSÕES QUE ACONTECERAM E NINGUÉM REGISTROU
-- O sinal mais importante do piloto. Se esta lista cresce,
-- o problema está na tela do treinador ou no hábito dele.
-- ------------------------------------------------------------
create or replace view vw_piloto_pendencias
with (security_invoker = on) as
select
  s.id                                            as sessao_id,
  s.agendado_inicio,
  s.agendado_fim,
  p.codigo,
  p.tipo,
  c.nome                                          as cliente,
  t.nome                                          as treinador,
  greatest(0, extract(day from now() - s.agendado_fim)::int) as dias_parada
from sessoes s
join processos   p on p.id = s.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
where s.status = 'agendada'
  and s.agendado_fim < now();

-- ------------------------------------------------------------
-- 2. PESQUISAS ENVIADAS E NÃO RESPONDIDAS
-- Se esta lista cresce, o problema é a pesquisa ou o canal.
-- ------------------------------------------------------------
create or replace view vw_piloto_pesquisas
with (security_invoker = on) as
select
  en.token,
  en.criado_em,
  coalesce(pa.nome, c.nome)                       as destinatario,
  coalesce(pa.telefone, c.telefone)               as telefone,
  c.nome                                          as cliente,
  t.nome                                          as treinador,
  greatest(0, extract(day from now() - en.criado_em)::int) as dias_esperando
from pesquisa_envios en
join processos   p on p.id = en.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
left join participantes pa on pa.id = en.participante_id
where en.respondido_em is null
  and en.expira_em > now();

-- ------------------------------------------------------------
-- 3. SATISFAÇÃO POR TREINADOR
-- Sem o mínimo de 5 respostas da vw_satisfacao_treinador: aqui
-- a gestão precisa ver desde a primeira. Quem garante que o
-- treinador não enxerga isto é o RLS de pesquisa_respostas,
-- que só libera para 'gestao' e 'admin'.
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
join pesquisa_envios e  on e.id = r.envio_id
join processos       p  on p.id = e.processo_id
join treinadores     t  on t.id = p.treinador_id
where r.nota is not null
group by t.id, t.nome;

-- ------------------------------------------------------------
-- 4. OS QUATRO NÚMEROS
-- ------------------------------------------------------------
create or replace view vw_piloto_resumo
with (security_invoker = on) as
select
  (select count(*) from sessoes
    where status = 'realizada')                    as sessoes_registradas,
  (select count(*) from sessoes
    where status = 'agendada' and agendado_fim < now()) as sessoes_pendentes,
  (select count(*) from pesquisa_envios)           as links_gerados,
  (select count(*) from pesquisa_envios
    where respondido_em is not null)               as respostas_recebidas;
