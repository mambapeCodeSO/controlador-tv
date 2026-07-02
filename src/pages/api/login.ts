import type { APIRoute } from 'astro';
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let password = '';
  try {
    const form = await request.formData();
    password = String(form.get('password') ?? '');
  } catch {
    password = '';
  }

  if (!verifyPassword(password)) {
    // Redireciona de volta ao form com sinalização de erro.
    return redirect('/login?error=1', 302);
  }

  const isProd = import.meta.env.PROD;
  cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions(isProd));
  return redirect('/admin', 302);
};
