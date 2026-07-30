# Febracis · Gestão — esqueleto

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha URL e anon key (Supabase → Settings → API)
npm run dev
```

## Antes de abrir

Os SQL precisam estar rodados nesta ordem: `01`, `03`, `04`.
(`02` só interessa se um dia voltar a integração com o Google Agenda.)

## Criar o primeiro usuário

Não há tela de cadastro de propósito. No painel do Supabase:

1. **Authentication → Users → Add user** — e-mail e senha do treinador.
   Copie o UUID gerado.
2. **Table editor → perfis** — nova linha com esse UUID, nome, e-mail,
   papel `treinador`.
3. **treinadores** — ligue `perfil_id` ao mesmo UUID.
4. **clientes** e **processos** — crie um de cada.
5. **sessoes** — uma sessão com `agendado_inicio` hoje.

Entre no app: a sessão aparece. Registre. O retorno traz o token da
pesquisa — abra `/s/<token>` e responda. A resposta cai em
`pesquisa_respostas`, e nota ≤ 5 gera linha em `alertas`.

## Rotas

| rota | quem |
|---|---|
| `/entrar` | treinador e coordenação |
| `/hoje` | treinador, sessões do dia |
| `/s/:token` | cliente, sem login |

## Publicar

GitHub → Vercel → import. Nas variáveis de ambiente, as mesmas duas do
`.env.local`. Em Supabase → Authentication → URL Configuration, adicione
o domínio da Vercel.

## O que está de fora, de propósito

Cadastro de cliente, treinador e processo. No piloto isso se faz no
Table editor. Construir CRUD para duas pessoas cadastrarem meia dúzia de
registros por semana é semanas de trabalho para resolver o que uma
planilha resolve.

## Envio no WhatsApp

Hoje o `registrar_sessao` devolve o token e o app mostra a confirmação,
mas ninguém manda a mensagem ainda. Enquanto o disparo pelo Black CRM
não existe, o link pode ser copiado e enviado à mão — o que serve de
teste real de taxa de resposta antes de automatizar.
