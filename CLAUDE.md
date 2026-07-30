# Plataforma de Gestão — Febracis Bahia

Sistema interno de gestão de **mentorias empresariais** e **processos de
coaching**. Substitui planilha e agenda solta. Está em piloto: uma
treinadora, poucos clientes, começando a rodar de verdade.

## Quem usa

- **Treinador / coach** — registra o que aconteceu em cada encontro. É o
  usuário mais importante: se ele parar de registrar, o sistema morre.
- **Coordenação (papel `gestao`)** — enxerga tudo, inclusive respostas
  individuais das pesquisas.
- **Cliente e participantes** — abrem só a pesquisa, por link tokenizado,
  sem login, quase sempre no celular vindo do WhatsApp.

## Stack

Vite + React 18 + react-router-dom · Supabase (Postgres + Auth + RLS) ·
lucide-react · publicado na Vercel.

Sem Tailwind, sem styled-components, sem biblioteca de UI. Estilo é
objeto inline usando os tokens de `src/tokens.js`. **Não adicione
dependências sem perguntar.**

## Estrutura

```
src/
  supabase.js          cliente único
  tokens.js            design tokens + estilo global
  App.jsx              rotas
  rotas/
    Login.jsx
    Hoje.jsx           sessões do dia do treinador (tela principal)
    Pesquisa.jsx       rota pública /s/:token
  componentes/
    LinksPesquisa.jsx  painel que entrega os links para envio manual
```

SQL em arquivos numerados, aplicados em ordem: `01` fundação · `03`
choque de agenda · `04` funções · `05` seed · `06` mentorias · `07`
links no registro. (`02` é do sync com Google Agenda, hoje inativo.)

## Decisões de arquitetura — não desfaça sem conversar

**Segurança mora no banco, não no front.** Toda tabela tem RLS. As
consultas do app **não filtram por treinador** — o RLS já devolve só o
que é dele. Se você vir uma query com `.eq("treinador_id", ...)`, é bug.

**Escrita sensível passa por função `security definer`**, nunca insert
direto: `registrar_sessao`, `pesquisa_abrir`, `pesquisa_responder`. O
treinador não pode ter permissão de inserir em `pesquisa_envios` — se
tivesse, poderia forjar envio. Só `pesquisa_abrir` e `pesquisa_responder`
são executáveis por `anon`.

**Resposta individual de pesquisa é invisível para o treinador.** Ele vê
média agregada com mínimo de 5 respostas (`vw_satisfacao_treinador`).
Isso está escrito na tela do cliente como promessa — a policy e o texto
precisam continuar batendo.

**A service_role key nunca entra no front.** Só `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`.

**Agenda é interna.** A integração com Google Agenda foi adiada porque a
agenda real não identifica cliente em evento nenhum. As colunas
`google_event_id` ficam dormentes de propósito.

**Coaching progride por sessão (3 de 10). Mentoria progride por entrega
concluída** e pode ter vários participantes — nesse caso sai um link de
pesquisa por pessoa, não um para o contratante.

**Sessão registrada é intocável.** Todo update de sessão filtra por
`status = 'agendada'`.

## O que NÃO construir agora

- **Telas de CRUD** de cliente, treinador, processo ou entrega. No piloto
  isso se faz no Table editor do Supabase. Construir CRUD para duas
  pessoas cadastrarem meia dúzia de registros por semana é semanas de
  trabalho desperdiçado.
- **Dashboard da diretoria.** Com dois processos no banco, qualquer
  painel mostra número sem significado e ensina a desconfiar do sistema.
- **Disparo automático de WhatsApp.** O envio é manual de propósito, para
  medir taxa de resposta real antes de automatizar.

Se um pedido exigir uma dessas, diga que está fora do escopo do piloto
antes de começar.

## Design

Tokens em `src/tokens.js`. Azul escuro `#0F1B2D` é a primária, dourado
`#D7A34B` é destaque e aparece pouco — linha do agora, contador
pendente, régua da sessão atual. Nunca decorativo.

Regras herdadas do Design System: **canto reto** (raio zero em tudo),
**bordas e réguas de 2px**, rótulos alinhados à esquerda em caixa alta
pequena, tipografia **Archivo** (400/600/800), ícones **lucide com
`strokeWidth={2}`**, tamanho 20 na navegação e 15 em linha de texto.

A **régua de sessões** — traços de 2px mostrando o progresso — é o
elemento de assinatura e aparece na tela do treinador e na do cliente.

Mobile importa: a tela da pesquisa é usada no celular por padrão.

## Escrita da interface

Português do Brasil, voz ativa, frase curta, sem jargão técnico.

O botão diz o que acontece: "Registrar sessão" produz "Sessão
registrada". **A interface nunca afirma o que não fez** — não escreva
"Pesquisa enviada" enquanto o envio for manual; escreva "Ver link da
pesquisa".

Erro explica o que houve e o que fazer, sem pedir desculpa. Tela vazia é
convite para agir, não lamento.

## Ao trabalhar aqui

- Rode `npm run build` antes de dizer que terminou.
- Mudança de banco vira arquivo SQL numerado novo; não edite os antigos,
  eles já foram aplicados em produção.
- Se uma alteração no app depender de mudança no banco, entregue os dois
  juntos e diga em que ordem aplicar.
