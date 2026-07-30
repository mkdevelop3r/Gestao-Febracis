-- ============================================================
-- 08 — LINKS PENDENTES POR SESSÃO
-- Rodar depois do 07.
--
-- A view do 06 não expunha sessao_id, então o app não conseguia
-- recuperar os links de uma sessão específica — necessário para
-- o botão "Ver link da pesquisa" na tela do treinador.
--
-- O coalesce entre participante e cliente vive aqui, não no
-- front: participante_id nulo significa que o processo não tem
-- participantes cadastrados e o destinatário é o contato do
-- cliente. Regra de negócio no banco, o app só lê.
--
-- security_invoker = on: a view respeita o RLS de quem consulta,
-- então o treinador enxerga apenas os envios dos processos dele.
-- ============================================================

create or replace view vw_links_pendentes
with (security_invoker = on) as
select
  en.token,
  en.sessao_id,
  en.processo_id,
  coalesce(pa.nome, c.nome)         as destinatario,
  coalesce(pa.telefone, c.telefone) as telefone,
  pa.id                             as participante_id,
  c.nome                            as cliente,
  t.nome                            as treinador,
  s.agendado_inicio                 as sessao_em,
  s.numero                          as sessao_numero,
  p.tipo                            as tipo_processo,
  en.criado_em
from pesquisa_envios en
join processos   p on p.id = en.processo_id
join clientes    c on c.id = p.cliente_id
join treinadores t on t.id = p.treinador_id
left join sessoes       s  on s.id = en.sessao_id
left join participantes pa on pa.id = en.participante_id
where en.respondido_em is null
  and en.expira_em > now();

-- Uso no app:
--   supabase.from("vw_links_pendentes").select("*").eq("sessao_id", id)
--
-- Sem filtro, ela devolve tudo que está pendente de resposta —
-- é a lista de envio manual do piloto.
