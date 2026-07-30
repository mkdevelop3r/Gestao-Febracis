-- ============================================================
-- 02 — ESTADO DO SYNC COM O GOOGLE AGENDA
-- Rodar depois de 01_fundacao_gestao.sql
-- ============================================================

create table integracao_agenda_estado (
  calendar_id       text primary key,
  apelido           text,
  sync_token        text,
  ultima_execucao   timestamptz,
  ultimo_erro       text,
  eventos_lidos     int not null default 0,
  atualizado_em     timestamptz not null default now()
);

-- A agenda real da unidade. O sync só lê daqui.
insert into integracao_agenda_estado (calendar_id, apelido)
values ('marketingbahia@febracis.com.br', 'Febracis Bahia')
on conflict (calendar_id) do nothing;

-- Ninguém além do service role toca nisso.
alter table integracao_agenda_estado enable row level security;
alter table eventos_nao_identificados enable row level security;

create policy "triagem so gestao" on eventos_nao_identificados for all
  using (app_papel() in ('gestao','admin'));

-- Fila de triagem: o que o sync viu e não soube identificar.
create view vw_triagem_agenda
with (security_invoker = on) as
select
  e.id,
  e.titulo,
  e.inicio,
  e.fim,
  e.dia_inteiro,
  e.google_event_id,
  e.google_calendar_id
from eventos_nao_identificados e
where e.resolvido_em is null
order by e.inicio desc nulls last;
