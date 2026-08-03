-- ============================================================
-- 17 — PESQUISA DE RESULTADO: NPS FIXO + LIVRES CATEGORIZADAS
-- Rodar depois do 16.
--
-- Estrutura de cada pesquisa de resultado:
--   1. NPS — texto travado, igual em toda mentoria. Só assim o
--      número é comparável com o mercado e entre unidades.
--   2..5. Até 4 perguntas escritas pela Elis, cada uma com
--      categoria. O texto muda; a categoria permite comparar
--      "resultado" de uma mentoria com "resultado" de outra.
--   última. Uma aberta, opcional, sempre no fim.
--
-- Escala única 0-10 em todas as de nota. Misturar escala é o
-- jeito mais silencioso de quebrar comparação.
-- ============================================================

create type categoria_pergunta as enum (
  'recomendacao',   -- NPS, travada
  'aplicacao',      -- quanto pôs em prática
  'resultado',      -- o que mudou no negócio
  'evolucao',       -- crescimento do próprio gestor
  'continuidade',   -- chance de seguir com a Febracis
  'dificuldade',    -- o que atrapalhou
  'aberta'          -- texto livre, sempre a última
);

alter table pesquisa_perguntas
  add column if not exists categoria categoria_pergunta;

-- Categoriza o que já existe, para as views não nascerem cegas
update pesquisa_perguntas set categoria = case chave
  when 'aplicacao'      then 'aplicacao'
  when 'resultados'     then 'resultado'
  when 'evolucao'       then 'evolucao'
  when 'dificuldade'    then 'dificuldade'
  when 'comentario'     then 'aberta'
  when 'resultados_txt' then 'aberta'
  when 'dificuldade_txt' then 'aberta'
  else categoria end
where categoria is null;


-- ------------------------------------------------------------
-- Texto canônico do NPS. Mudar aqui muda em toda pesquisa nova;
-- as antigas continuam com o texto que o cliente viu.
-- ------------------------------------------------------------
create or replace function nps_enunciado()
returns text language sql immutable as $$
  select 'De 0 a 10, o quanto você recomendaria esta mentoria a outro empresário?'
$$;


-- ------------------------------------------------------------
-- SALVAR — NPS entra sozinho, aberta vai sempre por último
-- p_perguntas: [{"enunciado":"...","categoria":"resultado"}]
-- p_aberta: texto da pergunta final (null usa o padrão)
-- ------------------------------------------------------------
create or replace function salvar_perguntas_resultado(
  p_processo_id bigint,
  p_perguntas   jsonb,
  p_aberta      text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_versao int;
  v_modelo bigint;
  v_ordem  int := 0;
  v_item   jsonb;
  v_cat    categoria_pergunta;
begin
  if not exists (
    select 1 from processos p
     where p.id = p_processo_id
       and (app_papel() in ('gestao','admin') or p.treinador_id = app_treinador_id())
  ) then
    raise exception 'Processo não encontrado ou sem permissão';
  end if;

  if jsonb_array_length(coalesce(p_perguntas, '[]'::jsonb)) > 4 then
    raise exception 'Até 4 perguntas além do NPS — com a aberta, a pesquisa já fica em 6';
  end if;

  update pesquisa_modelos set ativo = false
   where processo_id = p_processo_id and tipo = 'resultado';

  select coalesce(max(versao), 0) + 1 into v_versao
    from pesquisa_modelos
   where processo_id = p_processo_id and tipo = 'resultado';

  insert into pesquisa_modelos (tipo, versao, ativo, processo_id)
  values ('resultado', v_versao, true, p_processo_id)
  returning id into v_modelo;

  -- 1. NPS, travado
  v_ordem := 1;
  insert into pesquisa_perguntas
    (modelo_id, ordem, chave, enunciado, formato, obrigatoria, nucleo, categoria)
  values (v_modelo, v_ordem, 'nps', nps_enunciado(),
          'nota_0_10', true, true, 'recomendacao');

  -- 2..5. livres, com categoria
  for v_item in select * from jsonb_array_elements(coalesce(p_perguntas, '[]'::jsonb)) loop
    if coalesce(trim(v_item->>'enunciado'), '') = '' then
      continue;
    end if;

    v_cat := coalesce(nullif(v_item->>'categoria',''), 'resultado')::categoria_pergunta;

    if v_cat in ('recomendacao', 'aberta') then
      raise exception 'Categoria % é reservada: o NPS e a pergunta aberta são posicionados pelo sistema', v_cat;
    end if;

    v_ordem := v_ordem + 1;
    insert into pesquisa_perguntas
      (modelo_id, ordem, chave, enunciado, formato, obrigatoria, nucleo, categoria)
    values (v_modelo, v_ordem, 'livre_' || v_ordem, trim(v_item->>'enunciado'),
            'nota_0_10', true, false, v_cat);
  end loop;

  -- última: aberta, opcional
  v_ordem := v_ordem + 1;
  insert into pesquisa_perguntas
    (modelo_id, ordem, chave, enunciado, formato, obrigatoria, nucleo, categoria)
  values (v_modelo, v_ordem, 'aberta',
          coalesce(nullif(trim(coalesce(p_aberta,'')), ''),
                   'O que faria esta mentoria valer mais para você?'),
          'texto', false, true, 'aberta');

  return jsonb_build_object('modelo_id', v_modelo, 'versao', v_versao, 'perguntas', v_ordem);
end $$;

revoke execute on function salvar_perguntas_resultado(bigint, jsonb, text) from anon;
drop function if exists salvar_perguntas_resultado(bigint, jsonb);


-- ------------------------------------------------------------
-- NPS DE VERDADE: promotores menos detratores, não média.
-- 9-10 promotor · 7-8 neutro · 0-6 detrator.
-- ------------------------------------------------------------
create or replace view vw_nps
with (security_invoker = on) as
select
  p.id                                                        as processo_id,
  p.codigo,
  c.nome                                                      as cliente,
  t.id                                                        as treinador_id,
  t.nome                                                      as treinador,
  count(*)                                                    as respostas,
  count(*) filter (where r.nota >= 9)                         as promotores,
  count(*) filter (where r.nota between 7 and 8)              as neutros,
  count(*) filter (where r.nota <= 6)                         as detratores,
  round(
    100.0 * (count(*) filter (where r.nota >= 9)
           - count(*) filter (where r.nota <= 6)) / nullif(count(*), 0)
  )                                                           as nps
from pesquisa_respostas r
join pesquisa_perguntas pg on pg.id = r.pergunta_id
join pesquisa_envios    e  on e.id = r.envio_id
join processos          p  on p.id = e.processo_id
join clientes           c  on c.id = p.cliente_id
join treinadores        t  on t.id = p.treinador_id
where pg.categoria = 'recomendacao'
  and r.nota is not null
group by p.id, p.codigo, c.nome, t.id, t.nome;


-- ------------------------------------------------------------
-- Média por categoria: o texto muda entre mentorias, a
-- categoria não. É isso que mantém a comparação de pé.
-- ------------------------------------------------------------
create or replace view vw_resultado_por_categoria
with (security_invoker = on) as
select
  pg.categoria,
  t.id                  as treinador_id,
  t.nome                as treinador,
  round(avg(r.nota), 1) as media,
  min(r.nota)           as pior_nota,
  count(*)              as respostas
from pesquisa_respostas r
join pesquisa_perguntas pg on pg.id = r.pergunta_id
join pesquisa_envios    e  on e.id = r.envio_id
join pesquisa_modelos   m  on m.id = e.modelo_id
join processos          p  on p.id = e.processo_id
join treinadores        t  on t.id = p.treinador_id
where m.tipo = 'resultado'
  and r.nota is not null
  and pg.categoria is not null
  and pg.categoria <> 'aberta'
group by pg.categoria, t.id, t.nome;


-- ------------------------------------------------------------
-- As respostas abertas, para a gestão ler
-- ------------------------------------------------------------
create or replace view vw_respostas_abertas
with (security_invoker = on) as
select
  r.respondido_em,
  r.texto,
  c.nome              as cliente,
  coalesce(pa.nome, c.nome) as quem_respondeu,
  t.nome              as treinador,
  p.codigo,
  pg.enunciado        as pergunta
from pesquisa_respostas r
join pesquisa_perguntas pg on pg.id = r.pergunta_id
join pesquisa_envios    e  on e.id = r.envio_id
join processos          p  on p.id = e.processo_id
join clientes           c  on c.id = p.cliente_id
join treinadores        t  on t.id = p.treinador_id
left join participantes pa on pa.id = e.participante_id
where pg.categoria = 'aberta'
  and coalesce(trim(r.texto), '') <> ''
order by r.respondido_em desc;

notify pgrst, 'reload schema';
