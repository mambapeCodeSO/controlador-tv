import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Tv } from '../lib/supabase';
import { normalizeSlug, isValidSlug } from '../lib/validation';
import TvCard from './TvCard';

interface Props {
  initialTvs: Tv[];
  loadError?: boolean;
}

interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

const LIST_POLL_MS = 10_000;
const ONLINE_WINDOW_MS = 30_000;

function countOnline(tvs: Tv[], now: number): number {
  return tvs.filter(
    (t) => t.last_seen_at && now - new Date(t.last_seen_at).getTime() < ONLINE_WINDOW_MS,
  ).length;
}

export default function AdminPanel({ initialTvs, loadError = false }: Props) {
  const [tvs, setTvs] = useState<Tv[]>(initialTvs ?? []);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Form de cadastro.
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const pushToast = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Relógio ao vivo (status online/offline recalcula sozinho).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll da lista para refletir heartbeats/mudanças feitas em outra aba.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/tvs', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data.ok && Array.isArray(data.tvs)) {
          setTvs(data.tvs as Tv[]);
        }
      } catch {
        /* silencioso */
      }
    };
    const id = setInterval(load, LIST_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const handleUpdated = useCallback((updated: Tv) => {
    setTvs((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const cleanName = name.trim();
    const cleanSlug = normalizeSlug(slug || cleanName);
    if (!cleanName) {
      setFormError('Informe o nome da TV.');
      return;
    }
    if (!isValidSlug(cleanSlug)) {
      setFormError('Slug inválido. Use letras, números e hífens.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tvs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, slug: cleanSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Falha ao cadastrar a TV.');
      }
      setTvs((prev) =>
        [...prev, data.tv as Tv].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName('');
      setSlug('');
      setSlugTouched(false);
      setShowForm(false);
      pushToast('TV cadastrada');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao cadastrar a TV.');
    } finally {
      setCreating(false);
    }
  }

  const online = countOnline(tvs, now);
  const previewSlug = normalizeSlug(slug || name);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-3.5 w-3.5 rounded-full bg-primary" />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-text">Controle-TV</h1>
            <p className="font-mono text-xs text-muted">console de sinalização</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-text">
              <span className="text-online">{online}</span>
              <span className="text-muted"> / {tvs.length}</span>
            </p>
            <p className="text-xs text-muted">ao vivo</p>
          </div>
          <form method="POST" action="/api/logout">
            <button
              type="submit"
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted transition-colors hover:border-offline/50 hover:text-text"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Ação de cadastro */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          TVs cadastradas
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {showForm ? 'Fechar' : 'Cadastrar nova TV'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-2xl border border-border bg-surface p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tv-name" className="mb-1.5 block text-sm text-muted">
                Nome
              </label>
              <input
                id="tv-name"
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="Recepção"
                className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-text placeholder:text-muted/60 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="tv-slug" className="mb-1.5 block text-sm text-muted">
                Slug (rota)
              </label>
              <input
                id="tv-slug"
                type="text"
                value={slugTouched ? slug : previewSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="recepcao"
                className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none"
              />
              <p className="mt-1.5 font-mono text-xs text-muted">
                /tv/{previewSlug || '…'}
              </p>
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-offline">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {creating ? 'Cadastrando…' : 'Cadastrar TV'}
            </button>
          </div>
        </form>
      )}

      {/* Grade de TVs */}
      {tvs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
          <p className="text-muted">
            {loadError
              ? 'Não foi possível carregar as TVs. Verifique a configuração do Supabase.'
              : 'Nenhuma TV cadastrada. Cadastre a primeira.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tvs.map((tv) => (
            <TvCard
              key={tv.id}
              tv={tv}
              now={now}
              onToast={pushToast}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg motion-safe:animate-toastIn ${
              t.kind === 'error'
                ? 'border-offline/40 bg-surface text-offline'
                : 'border-primary/40 bg-surface text-text'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
