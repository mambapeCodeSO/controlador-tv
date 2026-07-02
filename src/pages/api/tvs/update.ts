import type { APIRoute } from 'astro';
import { getSupabaseAdmin, type Tv, TV_COLUMNS } from '../../../lib/supabase';
import { isValidUrl, INVALID_URL_MESSAGE } from '../../../lib/validation';

export const prerender = false;

// POST /api/tvs/update — define a URL atual de uma TV. { id, current_url }
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
  const current_url = String(body.current_url ?? '').trim();

  if (!id) {
    return json({ ok: false, error: 'TV não identificada.' }, 400);
  }
  if (!isValidUrl(current_url)) {
    return json({ ok: false, error: INVALID_URL_MESSAGE }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Lê o nonce atual para incrementá-lo junto: se a nova URL for igual à
    // antiga, o bump do nonce garante o reload do player mesmo assim.
    const { data: current, error: readErr } = await supabase
      .from('tvs')
      .select('reload_nonce')
      .eq('id', id)
      .single();
    if (readErr) throw readErr;

    const nextNonce = ((current as { reload_nonce: number }).reload_nonce ?? 0) + 1;

    const { data, error } = await supabase
      .from('tvs')
      .update({ current_url, reload_nonce: nextNonce })
      .eq('id', id)
      .select(TV_COLUMNS)
      .single();
    if (error) throw error;
    return json({ ok: true, tv: data as Tv }, 200);
  } catch {
    return json({ ok: false, error: 'Falha ao atualizar a TV.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
