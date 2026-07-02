import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// =====================================================================
// Tipo Tv — espelha as colunas de public.tvs (ver supabase/schema.sql).
// =====================================================================
export interface Tv {
  id: string;
  slug: string;
  name: string;
  current_url: string;
  default_url: string;
  is_active: boolean;
  last_seen_at: string | null;
  reload_nonce: number;
  updated_at: string;
}

// Colunas seguras para o cliente ler (todas são públicas de qualquer forma).
export const TV_COLUMNS =
  'id, slug, name, current_url, default_url, is_active, last_seen_at, reload_nonce, updated_at';

// =====================================================================
// Cliente ANÔNIMO (browser-safe).
// Usado pelo player da TV para ler current_url/updated_at por slug.
// A anon key só tem permissão de SELECT (garantido pelo RLS no schema).
//
// IMPORTANTE: lemos as envs aqui, mas NÃO lançamos erro se estiverem
// ausentes — isso quebraria o build. O createClient aceita strings e só
// falha em runtime numa requisição real, o que é o comportamento correto.
// =====================================================================
export const supabaseAnon: SupabaseClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL ?? '',
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// =====================================================================
// Cliente SERVICE ROLE (server-only).
// Bypassa o RLS — usado por todas as rotas de API para escrita e para a
// listagem do admin. NUNCA importe isto em componentes de cliente.
//
// Criado de forma preguiçosa (lazy) dentro da função para que a ausência
// das envs não derrube o build SSR no momento do import.
// =====================================================================
export function getSupabaseAdmin(): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Configuração ausente: defina PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.',
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
