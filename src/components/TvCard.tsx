import { useEffect, useState } from 'react';
import type { Tv } from '../lib/supabase';
import { isValidUrl, INVALID_URL_MESSAGE } from '../lib/validation';

interface Props {
  tv: Tv;
  now: number; // relógio compartilhado (ms) para status ao vivo
  onToast: (message: string, kind?: 'ok' | 'error') => void;
  onUpdated: (tv: Tv) => void;
}

const ONLINE_WINDOW_MS = 30_000;

function isOnline(tv: Tv, now: number): boolean {
  if (!tv.last_seen_at) return false;
  const seen = new Date(tv.last_seen_at).getTime();
  return now - seen < ONLINE_WINDOW_MS;
}

/**
 * Painel-monitor de uma TV (a assinatura do console): nome, rota mono,
 * URL atual, DOT de status pulsante e controles de troca de conteúdo.
 */
export default function TvCard({ tv, now, onToast, onUpdated }: Props) {
  const online = isOnline(tv, now);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setError('');
  }, [tv.id]);

  async function call(path: string, body: Record<string, unknown>): Promise<Tv | null> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Falha na operação.');
    }
    return (data.tv as Tv) ?? null;
  }

  async function handleUpdate() {
    setError('');
    // Validação no cliente para UX; o servidor revalida.
    if (!isValidUrl(urlInput)) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    setBusy('update');
    try {
      const updated = await call('/api/tvs/update', { id: tv.id, current_url: urlInput.trim() });
      if (updated) onUpdated(updated);
      setUrlInput('');
      onToast('TV atualizada');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Falha ao atualizar a TV.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleReload() {
    setBusy('reload');
    onToast('Recarregando TV');
    try {
      const updated = await call('/api/tvs/reload', { id: tv.id });
      if (updated) onUpdated(updated);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Falha ao recarregar a TV.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleDefault() {
    setBusy('default');
    try {
      const updated = await call('/api/tvs/default', { id: tv.id });
      if (updated) onUpdated(updated);
      onToast('Tela padrão aplicada');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Falha ao aplicar a tela padrão.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50">
      {/* Cabeçalho do monitor: nome + status */}
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold text-text">{tv.name}</h3>
          <span className="mt-1 inline-block rounded-md bg-surface2 px-2 py-0.5 font-mono text-xs text-muted">
            /tv/{tv.slug}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {online && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-online opacity-60 motion-safe:animate-ping" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                online ? 'bg-online motion-safe:animate-pulseDot' : 'bg-offline/50'
              }`}
            />
          </span>
          <span className={`text-xs font-medium ${online ? 'text-online' : 'text-muted'}`}>
            {online ? 'ao vivo' : 'offline'}
          </span>
        </div>
      </header>

      {/* Corpo: URL atual */}
      <div className="px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted">Exibindo agora</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-text" title={tv.current_url}>
            {tv.current_url || <span className="text-muted">— nada definido —</span>}
          </p>
          <a
            href={`/tv/${tv.slug}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-primary/60 hover:text-text"
          >
            Abrir
          </a>
        </div>

        {/* Controle de troca */}
        <div className="mt-4">
          <label htmlFor={`url-${tv.id}`} className="mb-1.5 block text-xs text-muted">
            Nova URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`url-${tv.id}`}
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdate();
              }}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleUpdate}
              disabled={busy !== null}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {busy === 'update' ? 'Atualizando…' : 'Atualizar TV'}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-offline">{error}</p>}
        </div>
      </div>

      {/* Rodapé: ações secundárias */}
      <footer className="mt-auto flex gap-2 border-t border-border/70 px-5 py-3">
        <button
          type="button"
          onClick={handleReload}
          disabled={busy !== null}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary/60 hover:text-text disabled:opacity-50"
        >
          Recarregar
        </button>
        <button
          type="button"
          onClick={handleDefault}
          disabled={busy !== null}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary/60 hover:text-text disabled:opacity-50"
        >
          Tela padrão
        </button>
      </footer>
    </article>
  );
}
