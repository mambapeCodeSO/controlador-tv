import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySessionToken } from './lib/auth';

// =====================================================================
// Middleware de guarda.
// Protege:
//   * /admin              -> redireciona para /login se não autenticado
//   * /api/tvs/*          -> retorna 401 JSON se não autenticado
// Público (sem guarda):
//   * /                   (landing)
//   * /login              (form de login)
//   * /tv/[slug]          (player da TV)
//   * /api/login          (autenticação)
//   * /api/logout         (encerrar sessão)
//   * /api/heartbeat      (sinal de vida do player)
// =====================================================================

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = verifySessionToken(token);
  context.locals.isAuthed = isAuthed;

  // Rotas de escrita das TVs exigem sessão válida.
  if (pathname.startsWith('/api/tvs/')) {
    if (!isAuthed) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Não autorizado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return next();
  }

  // Painel admin exige sessão válida.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!isAuthed) {
      return context.redirect('/login', 302);
    }
    return next();
  }

  return next();
});
