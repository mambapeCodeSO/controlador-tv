import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Rota PÚBLICA (o player não tem sessão). Atualiza SOMENTE last_seen_at
// para um slug existente — nunca toca em current_url nem reload_nonce.
//
// O trigger set_updated_at ainda bate `updated_at` neste UPDATE, mas isso
// é inofensivo: o player usa `reload_nonce` (não `updated_at`) como gatilho
// de reload, então o heartbeat não recarrega a TV.
export const POST: APIRoute = async ({ request }) => {
  let slug = '';
  try {
    const body = await request.json();
    slug = String(body?.slug ?? '').trim();
  } catch {
    slug = '';
  }

  if (!slug) {
    return json({ ok: false, error: 'Slug ausente.' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('tvs')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('slug', slug);
    if (error) throw error;
    return json({ ok: true }, 200);
  } catch {
    return json({ ok: false, error: 'Falha ao registrar heartbeat.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
