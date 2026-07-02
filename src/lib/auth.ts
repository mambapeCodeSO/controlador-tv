import crypto from 'node:crypto';

// =====================================================================
// Autenticação simples baseada em cookie assinado (HMAC-SHA256).
// Modelo de acesso: uma única senha de admin (ADMIN_PASSWORD). Ao logar,
// emitimos um token assinado com SESSION_SECRET, guardado num cookie
// httpOnly. O middleware verifica esse cookie para proteger /admin e as
// rotas de escrita /api/tvs/*.
//
// TRADE-OFF: não é multiusuário nem usa o Supabase Auth. É deliberadamente
// mínimo para um MVP interno de controle de TVs. Para múltiplos operadores
// ou papéis, migrar para Supabase Auth / provedor de identidade.
// =====================================================================

export const SESSION_COOKIE = 'ct_session';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 horas

// Lê um segredo do ambiente. Prioriza process.env (runtime — reflete as
// config vars do Heroku/host Node) e cai para import.meta.env (build-time,
// útil em dev). Módulo server-only: nunca é importado pelo cliente, então
// process.env é seguro aqui.
function serverEnv(key: string): string | undefined {
  const buildTime = import.meta.env as Record<string, string | undefined>;
  return process.env[key] ?? buildTime[key];
}

function getSecret(): string {
  const secret = serverEnv('SESSION_SECRET');
  if (!secret) {
    throw new Error('Configuração ausente: defina SESSION_SECRET no ambiente.');
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(payload: string, secret: string): string {
  return base64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

// Comparação de tempo constante — evita timing attacks tanto na senha
// quanto na assinatura do cookie.
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Verifica a senha do admin em tempo constante.
export function verifyPassword(input: string): boolean {
  const expected = serverEnv('ADMIN_PASSWORD');
  if (!expected) {
    throw new Error('Configuração ausente: defina ADMIN_PASSWORD no ambiente.');
  }
  if (typeof input !== 'string' || input.length === 0) return false;
  return safeEqual(input, expected);
}

// Cria um token assinado no formato "<payloadBase64url>.<assinatura>".
// O payload guarda a data de expiração (exp) em epoch segundos.
export function createSessionToken(): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = base64url(JSON.stringify({ exp }));
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

// Valida assinatura e expiração. Retorna true se o token for legítimo.
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const expected = sign(payload, secret);
  if (!safeEqual(signature, expected)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number };
    if (typeof decoded.exp !== 'number') return false;
    return decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// Monta os atributos do cookie de sessão (usado no Set-Cookie).
export function sessionCookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
