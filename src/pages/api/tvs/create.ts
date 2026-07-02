import type { APIRoute } from 'astro';
import { getSupabaseAdmin, type Tv, TV_COLUMNS } from '../../../lib/supabase';
import {
  normalizeSlug,
  isValidSlug,
  isValidUrl,
  INVALID_URL_MESSAGE,
} from '../../../lib/validation';

export const prerender = false;

// POST /api/tvs/create — cria uma nova TV. { name, slug, current_url?, default_url? }
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

  const name = String(body.name ?? '').trim();
  const slug = normalizeSlug(body.slug ?? name);

  if (!name) {
    return json({ ok: false, error: 'Informe o nome da TV.' }, 400);
  }
  if (!isValidSlug(slug)) {
    return json({ ok: false, error: 'Slug inválido. Use letras, números e hífens.' }, 400);
  }

  // URLs são opcionais na criação; se enviadas, precisam ser válidas.
  const current_url = body.current_url != null ? String(body.current_url).trim() : '';
  const default_url = body.default_url != null ? String(body.default_url).trim() : '';
  if (current_url && !isValidUrl(current_url)) {
    return json({ ok: false, error: INVALID_URL_MESSAGE }, 400);
  }
  if (default_url && !isValidUrl(default_url)) {
    return json({ ok: false, error: INVALID_URL_MESSAGE }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tvs')
      .insert({ name, slug, current_url, default_url })
      .select(TV_COLUMNS)
      .single();

    if (error) {
      // 23505 = unique_violation (slug duplicado).
      if ((error as { code?: string }).code === '23505') {
        return json({ ok: false, error: 'Já existe uma TV com esse slug.' }, 409);
      }
      throw error;
    }
    return json({ ok: true, tv: data as Tv }, 201);
  } catch {
    return json({ ok: false, error: 'Falha ao cadastrar a TV.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
