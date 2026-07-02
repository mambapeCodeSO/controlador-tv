import type { APIRoute } from 'astro';
import { getSupabaseAdmin, type Tv, TV_COLUMNS } from '../../../lib/supabase';

export const prerender = false;

// POST /api/tvs/default — aplica a tela padrão: current_url = default_url. { id }
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

    const { data: current, error: readErr } = await supabase
      .from('tvs')
      .select('default_url, reload_nonce')
      .eq('id', id)
      .single();
    if (readErr) throw readErr;

    const row = current as { default_url: string; reload_nonce: number };
    const default_url = row.default_url ?? '';
    const nextNonce = (row.reload_nonce ?? 0) + 1;

    const { data, error } = await supabase
      .from('tvs')
      .update({ current_url: default_url, reload_nonce: nextNonce })
      .eq('id', id)
      .select(TV_COLUMNS)
      .single();
    if (error) throw error;
    return json({ ok: true, tv: data as Tv }, 200);
  } catch {
    return json({ ok: false, error: 'Falha ao aplicar a tela padrão.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
