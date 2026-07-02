# Controle-TV

Console para controlar remotamente o que cada TV da empresa exibe — sem
digitar URL na TV. Cada painel físico abre uma rota fixa `/tv/<slug>` em
tela cheia e renderiza uma URL dentro de um `iframe`. Pelo painel `/admin`
você troca o conteúdo de cada TV; o conteúdo persiste no Supabase, então a
TV continua exibindo mesmo que o admin feche o navegador. O player faz
polling a cada 5s e troca o `src` do iframe quando `current_url` (ou
`updated_at`) muda.

## Stack

- **Astro 4** (SSR, `output: 'server'`) — páginas e rotas de API
- **Tailwind CSS** — design system "control room"
- **React** — apenas ilhas interativas (`AdminPanel`, `TvPlayer`, `TvCard`)
- **Supabase** (`@supabase/supabase-js`) — banco de dados
- **Heroku** — deploy (adapter `@astrojs/node` standalone + `Procfile`)

---

## 1) Rodar local

```bash
npm install
cp .env.example .env   # no Windows/PowerShell: Copy-Item .env.example .env
# preencha o .env (ver seções 2 e 3)
npm run dev
```

App em `http://localhost:4321`. Rotas principais:

- `/` — landing
- `/login` — entrar (senha do admin)
- `/admin` — painel (protegido)
- `/tv/<slug>` — player fullscreen de cada TV

Build de produção: `npm run build` e `npm run preview`.

## 2) Configurar o Supabase

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, cole e execute o conteúdo de **`supabase/schema.sql`**
   (deste repositório). Ele cria a tabela `public.tvs`, os índices, o
   trigger `set_updated_at`, ativa o **RLS** e insere TVs de exemplo.
3. Em **Project Settings → API**, copie para o `.env`:
   - `PUBLIC_SUPABASE_URL` = **Project URL**
   - `PUBLIC_SUPABASE_ANON_KEY` = chave **anon public**
   - `SUPABASE_SERVICE_ROLE_KEY` = chave **service_role** (secreta!)

## 3) Definir senha e segredo

No `.env`:

- `ADMIN_PASSWORD` — senha única de acesso ao `/admin`. Use uma senha forte.
- `SESSION_SECRET` — segredo para assinar o cookie de sessão (HMAC-SHA256).
  Gere um valor aleatório longo, por exemplo: `openssl rand -hex 32`.

## 4) Cadastrar TVs

Entre em `/login`, informe a `ADMIN_PASSWORD` e acesse `/admin`. Clique em
**"Cadastrar nova TV"**, informe o **nome** (ex.: `Recepção`) e o **slug**
(ex.: `recepcao`, gerado automaticamente a partir do nome). Cada TV vira um
painel-monitor no grid, com status ao vivo e controles de conteúdo.

## 5) Abrir cada TV

Na própria TV/mini-PC, abra o navegador em **`/tv/<slug>`** (ex.:
`https://seu-dominio/tv/recepcao`) em tela cheia (F11 / modo kiosk). A TV
passa a exibir a URL definida no admin e se atualiza sozinha:

- **Atualizar TV** — define uma nova URL para exibir.
- **Recarregar** — força o player a recarregar a mesma URL (útil para
  dashboards que travam). Funciona incrementando `reload_nonce`, um sinal
  de reload desacoplado do heartbeat (`last_seen_at`/`updated_at`), para que
  o batimento de vida da TV nunca cause um reload indesejado.
- **Tela padrão** — restaura `current_url = default_url` da TV.

## 6) Deploy no Heroku

O app é SSR e usa o adapter **`@astrojs/node`** (modo standalone). O
`Procfile` sobe o servidor com `node ./dist/server/entry.mjs`, escutando na
porta que o Heroku injeta (`PORT`) e em `HOST=0.0.0.0`.

```bash
# 1) criar o app (uma vez)
heroku create controlador-tv

# 2) definir as 5 variáveis de ambiente (NUNCA commitar o .env)
heroku config:set \
  PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..." \
  SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." \
  ADMIN_PASSWORD="sua-senha-forte" \
  SESSION_SECRET="valor-aleatorio-longo"

# 3) deploy (Heroku roda `npm install` + `npm run build` e inicia o Procfile)
git push heroku main
```

Notas:
- O buildpack Node roda o script `build` automaticamente e gera `dist/`.
- `engines.node` no `package.json` fixa a versão do Node (`20.x`).
- As variáveis `PUBLIC_*` são embutidas no client durante o build, então é
  importante defini-las **antes** do build (o `config:set` acima já garante).

---

## Modelo de autenticação e RLS (trade-offs)

- **RLS ligado** na tabela `tvs`. A **anon key** só tem policy de `SELECT`
  (leitura pública) — o player lê `current_url`/`updated_at` por slug sem
  sessão. **Todas as escritas** (admin e heartbeat) passam pelo servidor
  com a **service role key**, que ignora o RLS. A service role key é
  **server-only** (`import.meta.env.SUPABASE_SERVICE_ROLE_KEY`) e nunca é
  importada em ilhas de cliente.
- **Login** é de senha única (`ADMIN_PASSWORD`), comparada em tempo
  constante. Em sucesso, gravamos um cookie `ct_session` httpOnly com um
  token assinado por HMAC (`SESSION_SECRET`), válido ~8h. O
  `middleware.ts` valida o cookie para `/admin` (redireciona a `/login`) e
  para `/api/tvs/*` (retorna 401). As rotas do player, heartbeat, login e a
  landing são públicas.
- **Trade-off:** a policy de leitura é pública — qualquer um com a anon key
  lê as URLs de todas as TVs. Aceitável porque são conteúdos institucionais
  não sensíveis. O login é single-user, sem papéis. Para múltiplos
  operadores ou conteúdo restrito, migrar para o Supabase Auth e leitura
  autenticada/por tenant.

## Limitação do iframe (X-Frame-Options / CSP)

Muitos sites (Google, YouTube homepage, bancos, etc.) enviam
`X-Frame-Options: DENY` ou um `Content-Security-Policy: frame-ancestors`
que **impede** a exibição dentro de um iframe. Para conteúdo cross-origin é
**impossível** detectar de forma confiável, pelo JavaScript, se o frame foi
bloqueado (o navegador isola o conteúdo). O player faz uma detecção
**best-effort**: se o evento `onLoad` do iframe não disparar em ~6s após
uma troca de URL, exibe um aviso não-bloqueante
("Este site pode estar bloqueando a exibição incorporada..."). Prefira URLs
próprias/embeddáveis (dashboards internos, slides publicados, páginas que
permitem embed).
