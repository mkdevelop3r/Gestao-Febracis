-- ============================================================
-- 13 — CRIAR PROCESSO PELA TELA
-- Rodar depois do 11.
--
-- Por que função e não insert direto: não existe policy de
-- escrita em clientes nem em processos, e dar permissão ampla
-- de insert em clientes deixaria qualquer treinador criar
-- cadastro solto. Aqui a função valida quem é, reaproveita o
-- cliente se já existir e gera o código sozinha.
--
-- Regra de permissão decidida com a operação:
--   treinador → cria apenas para si mesmo
--   gestao/admin → cria para qualquer treinador
-- ============================================================

create or replace function criar_processo(
  p_tipo              tipo_processo,
  p_cliente_nome      text,
  p_cliente_telefone  text default null,
  p_cliente_email     text default null,
  p_cliente_empresa   text default null,
  p_treinador_id      bigint default null,
  p_total_sessoes     int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel       papel_usuario := app_papel();
  v_meu         bigint        := app_treinador_id();
  v_treinador   bigint;
  v_cliente     bigint;
  v_codigo      text;
  v_prefixo     text;
  v_ano         text := to_char(now(), 'YYYY');
  v_seq         int;
  v_total       int;
  v_processo_id bigint;
  v_tel         text := nullif(regexp_replace(coalesce(p_cliente_telefone,''), '\D', '', 'g'), '');
begin
  if coalesce(trim(p_cliente_nome), '') = '' then
    raise exception 'Informe o nome do cliente';
  end if;

  -- ---------- quem fica responsável ----------
  if v_papel in ('gestao', 'admin') then
    v_treinador := coalesce(p_treinador_id, v_meu);
    if v_treinador is null then
      raise exception 'Escolha o treinador responsável';
    end if;
  elsif v_meu is not null then
    v_treinador := v_meu;            -- treinador cria só para si
  else
    raise exception 'Sem permissão para criar processo';
  end if;

  if not exists (select 1 from treinadores where id = v_treinador and ativo) then
    raise exception 'Treinador inválido ou inativo';
  end if;

  -- ---------- cliente: reaproveita antes de duplicar ----------
  if p_cliente_email is not null and p_cliente_email <> '' then
    select id into v_cliente from clientes
     where lower(email) = lower(p_cliente_email);
  end if;

  if v_cliente is null and v_tel is not null then
    select id into v_cliente from clientes
     where regexp_replace(coalesce(telefone,''), '\D', '', 'g') = v_tel;
  end if;

  if v_cliente is null then
    select id into v_cliente from clientes
     where lower(nome) = lower(trim(p_cliente_nome));
  end if;

  if v_cliente is null then
    insert into clientes (nome, empresa, email, telefone)
    values (trim(p_cliente_nome),
            nullif(trim(coalesce(p_cliente_empresa,'')), ''),
            nullif(trim(coalesce(p_cliente_email,'')), ''),
            nullif(trim(coalesce(p_cliente_telefone,'')), ''))
    returning id into v_cliente;
  end if;

  -- ---------- código automático ----------
  v_prefixo := case p_tipo when 'coaching' then 'CCH' else 'MTR' end;

  select coalesce(max(substring(codigo from '\d+$')::int), 0) + 1
    into v_seq
    from processos
   where codigo like v_prefixo || '-' || v_ano || '-%';

  v_codigo := v_prefixo || '-' || v_ano || '-' || lpad(v_seq::text, 3, '0');

  -- ---------- total de sessões ----------
  v_total := case when p_tipo = 'coaching'
                  then coalesce(p_total_sessoes, 10)
                  else null end;

  insert into processos (codigo, tipo, cliente_id, treinador_id, total_sessoes)
  values (v_codigo, p_tipo, v_cliente, v_treinador, v_total)
  returning id into v_processo_id;

  return jsonb_build_object(
    'id',        v_processo_id,
    'codigo',    v_codigo,
    'cliente',   trim(p_cliente_nome),
    'reusou_cliente', exists (
      select 1 from processos where cliente_id = v_cliente and id <> v_processo_id
    )
  );
end $$;

revoke execute on function criar_processo from anon;

-- ------------------------------------------------------------
-- Adicionar participante a uma mentoria já criada.
-- O cadastro nasce enxuto; os participantes entram depois.
-- ------------------------------------------------------------
create or replace function adicionar_participante(
  p_processo_id bigint,
  p_nome        text,
  p_telefone    text default null,
  p_email       text default null,
  p_cargo       text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not exists (
    select 1 from processos p
     where p.id = p_processo_id
       and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id())
  ) then
    raise exception 'Processo não encontrado ou sem permissão';
  end if;

  insert into participantes (processo_id, nome, telefone, email, cargo)
  values (p_processo_id, trim(p_nome),
          nullif(trim(coalesce(p_telefone,'')), ''),
          nullif(trim(coalesce(p_email,'')), ''),
          nullif(trim(coalesce(p_cargo,'')), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nome', trim(p_nome));
end $$;

revoke execute on function adicionar_participante from anon;
