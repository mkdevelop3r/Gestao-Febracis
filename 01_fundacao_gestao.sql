-- ============================================================
-- PLATAFORMA DE GESTÃO DE DESENVOLVIMENTO — FUNDAÇÃO
-- Febracis Bahia · Mentorias + Coaching
-- Rodar no SQL Editor do Supabase, de cima para baixo.
-- ============================================================
--
-- PADRÃO DE EVENTO NO GOOGLE AGENDA (escrito PELA plataforma):
--
--   Título:  [MTR-1042] Mentoria — Vamos Sorrir · Carol
--            [CCH-0087 S3/10] Coaching — Clécio Andrade · Volney
--
--   Descrição:
--            Cliente: Vamos Sorrir
--            Contato: clecio@vamossorrir.com.br · +55 71 9xxxx-xxxx
--            Treinador: Carol
--            Processo: MTR-1042  ·  Sessão: 3 de 10
--            Registrar: https://gestao.febracisbahia.com/s/<sessao_id>
--
-- Regras: sempre com hora de início e fim (nunca dia inteiro);
-- o código entre colchetes é o que o sync usa para reconciliar;
-- o e-mail do cliente entra como convidado quando houver.
-- ============================================================


-- ============================================================
-- 1. PESSOAS E ACESSO
-- ============================================================

create type papel_usuario as enum ('treinador', 'coach', 'gestao', 'admin');

-- Estende auth.users do Supabase
create table perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null unique,
  papel       papel_usuario not null default 'treinador',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Treinadores e coaches. 'aliases' resolve o problema real da agenda:
-- o mesmo profissional aparece como "Renan" e "Rennan".
create table treinadores (
  id            bigint generated always as identity primary key,
  perfil_id     uuid unique references perfis(id) on delete set null,
  nome          text not null,
  aliases       text[] not null default '{}',
  atua_mentoria boolean not null default true,
  atua_coaching boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create index on treinadores using gin (aliases);

create table clientes (
  id         bigint generated always as identity primary key,
  nome       text not null,
  empresa    text,
  email      text,
  telefone   text,
  cidade     text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create unique index clientes_email_uniq on clientes (lower(email)) where email is not null;


-- ============================================================
-- 2. PROCESSOS E SESSÕES
-- ============================================================

create type tipo_processo  as enum ('mentoria', 'coaching');
create type status_processo as enum ('ativo', 'concluido', 'pausado', 'cancelado');
create type status_sessao   as enum ('agendada', 'realizada', 'remarcada', 'faltou', 'cancelada');

create table processos (
  id             bigint generated always as identity primary key,
  codigo         text unique not null,          -- MTR-1042 / CCH-0087
  tipo           tipo_processo not null,
  cliente_id     bigint not null references clientes(id),
  treinador_id   bigint not null references treinadores(id),
  total_sessoes  int,                           -- 10 no coaching; null na mentoria
  status         status_processo not null default 'ativo',
  iniciado_em    date not null default current_date,
  concluido_em   date,
  observacoes    text,
  criado_em      timestamptz not null default now()
);

create index on processos (treinador_id, status);
create index on processos (cliente_id);

create table sessoes (
  id                bigint generated always as identity primary key,
  processo_id       bigint not null references processos(id) on delete cascade,
  numero            int,                        -- 1..10 no coaching; null em encontro solto
  status            status_sessao not null default 'agendada',

  agendado_inicio   timestamptz not null,
  agendado_fim      timestamptz not null,
  realizado_em      timestamptz,                -- preenchido no "registrar sessão"

  -- Vínculo com o Google Agenda. A plataforma cria o evento e guarda o id.
  google_calendar_id text,
  google_event_id    text unique,
  google_sync_em     timestamptz,

  resumo            text,
  ferramentas       text[],
  plano_de_acao     text,
  compromissos      text,
  proximos_passos   text,

  registrado_por    uuid references perfis(id),
  criado_em         timestamptz not null default now(),

  constraint sessao_fim_depois_inicio check (agendado_fim > agendado_inicio),
  constraint sessao_numero_unico unique (processo_id, numero)
);

create index on sessoes (agendado_inicio);
create index on sessoes (status) where status = 'agendada';

-- Eventos do Google que o sync não conseguiu identificar.
-- Nunca descartar em silêncio: vira fila de triagem na interface.
create table eventos_nao_identificados (
  id                 bigint generated always as identity primary key,
  google_calendar_id text not null,
  google_event_id    text not null,
  titulo             text,
  inicio             timestamptz,
  fim                timestamptz,
  dia_inteiro        boolean not null default false,
  payload            jsonb,
  resolvido_em       timestamptz,
  sessao_id          bigint references sessoes(id),
  unique (google_calendar_id, google_event_id)
);


-- ============================================================
-- 3. PESQUISAS
-- Modelos versionados: o texto das perguntas VAI mudar, e sem
-- versão você perde a comparabilidade histórica sem perceber.
-- ============================================================

create type tipo_pesquisa    as enum ('satisfacao', 'resultado');
create type formato_pergunta as enum ('nota_0_10', 'nota_1_5', 'texto');

create table pesquisa_modelos (
  id         bigint generated always as identity primary key,
  tipo       tipo_pesquisa not null,
  versao     int not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  unique (tipo, versao)
);

create table pesquisa_perguntas (
  id         bigint generated always as identity primary key,
  modelo_id  bigint not null references pesquisa_modelos(id) on delete cascade,
  ordem      int not null,
  chave      text not null,        -- 'qualidade', 'clareza', 'avaliacao_treinador'...
  enunciado  text not null,
  formato    formato_pergunta not null,
  obrigatoria boolean not null default true,
  unique (modelo_id, chave)
);

-- Um envio = um link tokenizado para uma sessão (ou processo, no marco final)
create table pesquisa_envios (
  id             bigint generated always as identity primary key,
  modelo_id      bigint not null references pesquisa_modelos(id),
  sessao_id      bigint references sessoes(id) on delete cascade,
  processo_id    bigint not null references processos(id) on delete cascade,
  token          text not null unique default encode(gen_random_bytes(16), 'hex'),
  canal          text,                         -- 'whatsapp' | 'email' | 'sms'
  enviado_em     timestamptz,
  lembrete_em    timestamptz,
  respondido_em  timestamptz,
  expira_em      timestamptz not null default now() + interval '30 days',
  criado_em      timestamptz not null default now()
);

create index on pesquisa_envios (processo_id);
create index on pesquisa_envios (respondido_em) where respondido_em is null;

-- Nota E texto. Sem a nota não existe gráfico de evolução — só uma
-- pilha de parágrafos. O texto vira insumo para o resumo por IA.
create table pesquisa_respostas (
  id            bigint generated always as identity primary key,
  envio_id      bigint not null references pesquisa_envios(id) on delete cascade,
  pergunta_id   bigint not null references pesquisa_perguntas(id),
  nota          numeric(4,1),
  texto         text,
  respondido_em timestamptz not null default now(),
  unique (envio_id, pergunta_id),
  constraint resposta_tem_conteudo check (nota is not null or texto is not null)
);


-- ============================================================
-- 4. SEGURANÇA (RLS)
-- Regra de ouro: se depender do front esconder o botão, não é segurança.
-- ============================================================

create or replace function app_papel()
returns papel_usuario language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

create or replace function app_treinador_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from treinadores where perfil_id = auth.uid()
$$;

alter table perfis              enable row level security;
alter table treinadores         enable row level security;
alter table clientes            enable row level security;
alter table processos           enable row level security;
alter table sessoes             enable row level security;
alter table pesquisa_envios     enable row level security;
alter table pesquisa_respostas  enable row level security;

create policy "perfil proprio" on perfis for select
  using (id = auth.uid() or app_papel() in ('gestao','admin'));

create policy "treinadores visiveis" on treinadores for select
  using (true);

create policy "clientes do treinador" on clientes for select
  using (
    app_papel() in ('gestao','admin')
    or exists (
      select 1 from processos p
      where p.cliente_id = clientes.id
        and p.treinador_id = app_treinador_id()
    )
  );

create policy "processos do treinador" on processos for select
  using (app_papel() in ('gestao','admin') or treinador_id = app_treinador_id());

create policy "sessoes do treinador" on sessoes for all
  using (
    app_papel() in ('gestao','admin')
    or exists (
      select 1 from processos p
      where p.id = sessoes.processo_id and p.treinador_id = app_treinador_id()
    )
  );

create policy "envios do treinador" on pesquisa_envios for select
  using (
    app_papel() in ('gestao','admin')
    or exists (
      select 1 from processos p
      where p.id = pesquisa_envios.processo_id and p.treinador_id = app_treinador_id()
    )
  );

-- CRÍTICO: resposta individual só para a gestão.
-- Se o treinador vê quem deu qual nota, o número perde valor.
create policy "respostas so gestao" on pesquisa_respostas for select
  using (app_papel() in ('gestao','admin'));


-- ============================================================
-- 5. AGREGADO PARA O TREINADOR
-- Média só a partir de 5 respostas, para não expor resposta individual
-- por dedução em amostra pequena.
-- ============================================================

create view vw_satisfacao_treinador
with (security_invoker = off) as
select
  t.id            as treinador_id,
  t.nome          as treinador,
  pg.chave        as indicador,
  round(avg(r.nota), 2) as media,
  count(r.id)     as respostas
from pesquisa_respostas r
join pesquisa_envios     e  on e.id = r.envio_id
join processos           p  on p.id = e.processo_id
join treinadores         t  on t.id = p.treinador_id
join pesquisa_perguntas  pg on pg.id = r.pergunta_id
where r.nota is not null
  and (
    app_papel() in ('gestao','admin')
    or t.id = app_treinador_id()
  )
group by t.id, t.nome, pg.chave
having count(r.id) >= 5;


-- ============================================================
-- 6. SEED — treinadores encontrados na agenda Febracis Bahia
-- ============================================================

insert into treinadores (nome, aliases, atua_mentoria, atua_coaching) values
  ('Carol',    array['Carol'],                    true,  false),
  ('Rennan',   array['Rennan','Renan'],           true,  false),
  ('Volney',   array['Volney'],                   true,  false),
  ('Valter',   array['Valter','Valter Vieira'],   true,  false),
  ('Thamyres', array['Thamyres','Thamires'],      true,  false);

-- Modelo de satisfação v1 (curta, depois de CADA encontro)
with m as (
  insert into pesquisa_modelos (tipo, versao) values ('satisfacao', 1) returning id
)
insert into pesquisa_perguntas (modelo_id, ordem, chave, enunciado, formato, obrigatoria)
select m.id, v.ordem, v.chave, v.enunciado, v.formato::formato_pergunta, v.obrig
from m, (values
  (1, 'qualidade',           'Como você avalia a qualidade do atendimento?',        'nota_0_10', true),
  (2, 'clareza',             'As orientações foram claras e aplicáveis?',           'nota_0_10', true),
  (3, 'avaliacao_treinador', 'Como você avalia o treinador nesta sessão?',          'nota_0_10', true),
  (4, 'comentario',          'Quer deixar algum comentário?',                       'texto',     false)
) as v(ordem, chave, enunciado, formato, obrig);

-- Modelo de resultado v1 (pesada, só em marco: fim da mentoria, S5 e S10 do coaching)
with m as (
  insert into pesquisa_modelos (tipo, versao) values ('resultado', 1) returning id
)
insert into pesquisa_perguntas (modelo_id, ordem, chave, enunciado, formato, obrigatoria)
select m.id, v.ordem, v.chave, v.enunciado, v.formato::formato_pergunta, v.obrig
from m, (values
  (1, 'aplicacao',    'Quanto do conteúdo você conseguiu aplicar?',                 'nota_0_10', true),
  (2, 'resultados',   'Qual o resultado que você já percebe?',                      'nota_0_10', true),
  (3, 'evolucao',     'Quanto você evoluiu desde o início do processo?',            'nota_0_10', true),
  (4, 'dificuldade',  'Qual foi a maior dificuldade para aplicar?',                 'nota_0_10', true),
  (5, 'resultados_txt','Descreva os resultados obtidos.',                           'texto',     false),
  (6, 'dificuldade_txt','Descreva as principais dificuldades.',                     'texto',     false)
) as v(ordem, chave, enunciado, formato, obrig);
