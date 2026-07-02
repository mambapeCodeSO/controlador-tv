import type { APIRoute } from 'astro';
import { getSupabaseAdmin, type Tv, TV_COLUMNS } from '../../../lib/supabase';

export const prerender = false;

// GET /api/tvs — lista todas as TVs (protegido pelo middleware).
export const GET: APIRoute = async ({ locals }) => {
  // Recheck defensivo além do middleware.
  if (!locals.isAuthed) {
    return json({ ok: false, error: 'Não autorizado.' }, 401);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tvs')
      .select(TV_COLUMNS)
      .order('name', { ascending: true });
    if (error) throw error;
    return json({ ok: true, tvs: (data as Tv[]) ?? [] }, 200);
  } catch {
    return json({ ok: false, error: 'Falha ao carregar as TVs.' }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
