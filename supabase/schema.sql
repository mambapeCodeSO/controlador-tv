-- =====================================================================
-- Controle-TV — Schema Supabase / PostgreSQL
-- =====================================================================
-- Objetivo: controlar remotamente o que cada TV da empresa exibe.
-- Cada TV abre a rota fixa /tv/[slug] em tela cheia e renderiza uma URL
-- dentro de um iframe. O painel admin atualiza `current_url`; o player
-- da TV faz polling a cada 5s para detectar mudanças.
--
-- ---------------------------------------------------------------------
-- DECISÃO DE ARQUITETURA — CAMINHO DE ESCRITA (WRITE PATH) x RLS
-- ---------------------------------------------------------------------
-- TODAS as escritas (criação/edição de TVs pelo admin e o heartbeat de
-- `last_seen_at` do player) são feitas NO SERVIDOR usando a SERVICE ROLE
-- key do Supabase, que BYPASSA (ignora) o Row Level Security.
--
-- A anon key (usada no navegador da TV e, se aplicável, no cliente) tem
-- permissão APENAS de LEITURA (SELECT). Não existe nenhuma policy de
-- INSERT/UPDATE/DELETE para anon — logo, escrita direta pelo cliente é
-- bloqueada pelo RLS por padrão (deny-by-default).
--
-- Por que assim?
--   * As URLs exibidas são dados não sensíveis (públicos por natureza).
--   * O player precisa ler `current_url`/`updated_at` por slug de forma
--     simples e barata, sem sessão autenticada -> anon SELECT resolve.
--   * Concentrar as escritas no back-end (service role) evita expor
--     qualquer credencial de escrita no front-end e centraliza a
--     validação/regras de negócio numa única camada confiável.
-- =====================================================================

-- Extensão necessária para gen_random_uuid() (disponível por padrão no
-- Supabase, mas garantimos aqui para tornar o script autossuficiente).
create extension if not exists pgcrypto;

-- =====================================================================
-- 1) TABELA public.tvs
-- =====================================================================
-- Uma linha por TV/painel físico. O `slug` é o identificador estável
-- usado na rota /tv/[slug]. `current_url` é o que o iframe exibe agora.
create table if not exists public.tvs (
  -- Identificador interno imutável da TV.
  id uuid primary key default gen_random_uuid(),

  -- Identificador legível e estável usado na URL /tv/[slug]. Único.
  slug text unique not null,

  -- Nome amigável exibido no painel admin (ex.: "Recepção").
  name text not null,

  -- URL atualmente renderizada no iframe da TV. String vazia = nada
  -- definido ainda (o player pode cair para a tela padrão nesse caso).
  current_url text not null default '',

  -- COLUNA EXTRA — feature "Tela padrão".
  -- Existe para permitir um "estado de repouso" configurável por TV:
  -- quando o conteúdo temporário termina/expira, ou quando `current_url`
  -- está vazio, o admin pode restaurar rapidamente a exibição para a
  -- URL padrão daquela TV (ex.: um dashboard institucional). Guardar a
  -- padrão separada de `current_url` permite trocar o conteúdo atual sem
  -- perder qual é o "conteúdo de fábrica" para voltar depois.
  default_url text not null default '',

  -- Permite desativar uma TV sem apagá-la (ex.: painel em manutenção).
  is_active boolean not null default true,

  -- Heartbeat do player: última vez que a TV deu sinal de vida (polling).
  -- Atualizado pelo servidor (service role). Serve para monitorar TVs
  -- offline. Nullable pois uma TV recém-criada ainda não se reportou.
  last_seen_at timestamptz,

  -- SINAL DE RECARREGAR (decoupled do heartbeat).
  -- O player compara `reload_nonce` entre polls e, quando ele muda,
  -- recarrega o iframe — mesmo mantendo a mesma `current_url`. As rotas
  -- de "Recarregar"/"Atualizar"/"Tela padrão" incrementam este contador.
  -- Deliberadamente separado de `updated_at`: o heartbeat (last_seen_at)
  -- bate `updated_at` via trigger a cada ~15s, e NÃO deve recarregar a TV.
  reload_nonce bigint not null default 0,

  -- Timestamp da última alteração da linha (campo de AUDITORIA apenas).
  -- Atualizado automaticamente pelo trigger set_updated_at em todo UPDATE
  -- (inclui o heartbeat). O player IGNORA este campo para fins de reload —
  -- o gatilho de reload é `reload_nonce`, não `updated_at`.
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2) ÍNDICES
-- =====================================================================
-- Observação: a constraint UNIQUE em `slug` já cria um índice único.
-- Ainda assim, criamos um índice explícito nomeado para deixar clara a
-- intenção de busca rápida por slug (lookup principal do player).
create index if not exists idx_tvs_slug on public.tvs (slug);

-- Índice para filtrar rapidamente TVs ativas/inativas (listagens do
-- painel admin e dashboards de monitoramento).
create index if not exists idx_tvs_is_active on public.tvs (is_active);

-- =====================================================================
-- 3) FUNÇÃO + TRIGGER: set_updated_at()
-- =====================================================================
-- Mantém `updated_at = now()` automaticamente em TODO UPDATE — campo de
-- AUDITORIA. NÃO é mais o gatilho de "Recarregar" (isso agora é o
-- `reload_nonce`, incrementado explicitamente pelas rotas de API). Como o
-- heartbeat também dispara este trigger, manter `updated_at` como reload
-- recarregaria a TV a cada heartbeat — por isso o desacoplamento.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Recria o trigger de forma idempotente.
drop trigger if exists trg_tvs_set_updated_at on public.tvs;
create trigger trg_tvs_set_updated_at
  before update on public.tvs
  for each row
  execute function public.set_updated_at();

-- =====================================================================
-- 4) ROW LEVEL SECURITY (RLS)
-- =====================================================================
-- Ver bloco de decisão no topo do arquivo. Resumo:
--   * RLS habilitado => deny-by-default para clientes (anon/authenticated).
--   * Única policy: SELECT público (leitura das URLs, dados não sensíveis).
--   * Nenhuma policy de escrita => escrita só via service role (bypassa RLS).
alter table public.tvs enable row level security;

-- Policy de LEITURA pública. TRADE-OFF: qualquer um com a anon key pode
-- ler todas as TVs e suas URLs. Aceitável aqui porque as URLs exibidas
-- são conteúdo público/institucional, não sensível. Se um dia houver
-- conteúdo restrito, esta policy deve ser trocada por leitura autenticada
-- ou filtrada por tenant/organização.
drop policy if exists "tvs_public_read" on public.tvs;
create policy "tvs_public_read"
  on public.tvs
  for select
  to anon, authenticated
  using (true);

-- IMPORTANTE: NÃO criar policies de INSERT/UPDATE/DELETE para anon.
-- Todas as escritas passam pelo back-end com a SERVICE ROLE key, que
-- ignora o RLS. Isso mantém a anon key como somente-leitura.

-- =====================================================================
-- 5) SEED DATA — TVs de exemplo
-- =====================================================================
-- Inserção idempotente: se o slug já existir, não faz nada.
insert into public.tvs (slug, name, current_url, default_url)
values
  ('recepcao',     'Recepção',        'https://example.com', 'https://example.com'),
  ('comercial',    'Comercial',       'https://example.com', 'https://example.com'),
  ('sala-reuniao', 'Sala de Reunião', 'https://example.com', 'https://example.com')
on conflict (slug) do nothing;

-- =====================================================================
-- FIM DO SCHEMA
-- =====================================================================
