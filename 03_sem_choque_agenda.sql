-- ============================================================
-- 03 — SEM CHOQUE DE AGENDA
-- Rodar depois de 01_fundacao_gestao.sql
--
-- Restrição de exclusão não aceita subconsulta: ela só enxerga
-- colunas da própria linha. Por isso treinador_id passa a viver
-- também em sessoes, mantido por trigger a partir de processos.
-- ============================================================

create extension if not exists btree_gist;

-- 1. Coluna denormalizada
alter table sessoes add column treinador_id bigint references treinadores(id);

update sessoes s
   set treinador_id = p.treinador_id
  from processos p
 where p.id = s.processo_id;

alter table sessoes alter column treinador_id set not null;

-- 2. Período como coluna gerada
alter table sessoes add column periodo tstzrange
  generated always as (tstzrange(agendado_inicio, agendado_fim)) stored;

-- 3. Triggers que mantêm a cópia honesta

create or replace function sessao_herda_treinador()
returns trigger language plpgsql as $$
begin
  select treinador_id into new.treinador_id
    from processos where id = new.processo_id;
  return new;
end $$;

create trigger trg_sessao_herda_treinador
  before insert or update of processo_id on sessoes
  for each row execute function sessao_herda_treinador();

-- Trocou o treinador do processo? As sessões futuras acompanham.
create or replace function processo_propaga_treinador()
returns trigger language plpgsql as $$
begin
  if new.treinador_id is distinct from old.treinador_id then
    update sessoes
       set treinador_id = new.treinador_id
     where processo_id = new.id
       and status = 'agendada';
  end if;
  return new;
end $$;

create trigger trg_processo_propaga_treinador
  after update of treinador_id on processos
  for each row execute function processo_propaga_treinador();

-- 4. ANTES de criar a restrição, veja se já existe choque.
--    Se esta consulta voltar linhas, resolva-as primeiro —
--    senão o ALTER abaixo falha.
--
--   select a.id, b.id, a.treinador_id, a.agendado_inicio, b.agendado_inicio
--     from sessoes a
--     join sessoes b
--       on a.id < b.id
--      and a.treinador_id = b.treinador_id
--      and a.periodo && b.periodo
--    where a.status = 'agendada' and b.status = 'agendada';

-- 5. A restrição. Só vale para sessão agendada: remarcada,
--    cancelada ou já realizada podem se sobrepor à vontade.
alter table sessoes add constraint sem_choque_treinador
  exclude using gist (
    treinador_id with =,
    periodo      with &&
  ) where (status = 'agendada');
