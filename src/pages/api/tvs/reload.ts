import type { APIRoute } from 'astro';
import { getSupabaseAdmin, type Tv, TV_COLUMNS } from '../../../lib/supabase';

export const prerender = false;

// POST /api/tvs/reload — incrementa reload_nonce para forçar o player a
// recarregar o iframe (mesma URL). O sinal é desacoplado do heartbeat, que
// só mexe em last_seen_at. { id }
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.isAuthed) {
    return json({ ok: false, error: 'Não autorizado.' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Requisição inválida.' }, 400);
  }

  const id = String(body.id ?? '').trim();
  if (!id) {
    return json({ ok: false, error: 'TV não identificada.' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Lê o nonce atual e o incrementa (read-then-write). Não altera a URL.
    const { data: current, error: readErr } = await supabase
      .from('tvs')
      .select('reload_nonce')
      .eq('id', id)
      .single();
    if (readErr) throw readErr;

    const nextNonce = ((current as { reload_nonce: number }).reload_nonce ?? 0) + 1;

    const { data, error } = await supabase
      .from('tvs')
      .update({ reload_nonce: nextNonce })
      .eq('id', id)
      .select(TV_COLUMNS)
      .single();
    if (error) throw error;
    return json({ ok: true, tv: data as Tv }, 200);
  } catch {
    return json({ ok: false, error: 'Falha ao recarregar a TV.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
