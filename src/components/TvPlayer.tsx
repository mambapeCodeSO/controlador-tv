import { useEffect, useRef, useState, useCallback } from 'react';
import { supabaseAnon } from '../lib/supabase';

interface Props {
  slug: string;
  initialUrl: string;
  initialName: string;
  initialReloadNonce: number;
}

const POLL_MS = 5000;
const HEARTBEAT_MS = 15000;
// Muitos dashboards mantem conexoes vivas (websocket, long-polling, streaming)
// e nesses casos o evento onLoad do iframe pode NUNCA disparar, mesmo com a
// pagina exibida e funcionando. Depois desse tempo escondemos o overlay de
// "Carregando" mesmo sem onLoad, para nao deixar um spinner preso na tela.
const LOADING_FALLBACK_MS = 8000;

/**
 * Player fullscreen de uma TV.
 * - Renderiza um iframe em tela cheia com a URL atual.
 * - A cada 5s consulta o Supabase (anon) por current_url + reload_nonce do
 *   slug. Se a URL mudar, troca o src do iframe. Se o reload_nonce mudar
 *   (mesma URL), forca um reload — suporta o botao "Recarregar" do admin.
 *   `updated_at` (auditoria) e IGNORADO de proposito: o heartbeat o altera
 *   a cada ~15s e nao deve recarregar a TV.
 * - Envia heartbeat (/api/heartbeat) a cada ~15s para atualizar
 *   last_seen_at.
 *
 * NOTA: nao ha deteccao de bloqueio (X-Frame-Options/CSP). Para iframes
 * cross-origin e impossivel saber pelo cliente se o site recusou a
 * incorporacao — qualquer heuristica por timeout gera falso positivo em
 * paginas lentas ou com conexao viva. Se um dia for preciso detectar
 * bloqueio de verdade, o caminho e um proxy no servidor que inspeciona os
 * cabecalhos da resposta.
 */
export default function TvPlayer({ slug, initialUrl, initialName, initialReloadNonce }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [name] = useState(initialName ?? '');
  const [loadingFrame, setLoadingFrame] = useState<boolean>(Boolean(initialUrl));

  const reloadNonceRef = useRef<number>(initialReloadNonce ?? 0);
  // Chave de reload: muda sempre que precisamos remontar/recarregar o iframe.
  const [frameKey, setFrameKey] = useState(0);
  const loaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoaderTimer = useCallback(() => {
    if (loaderTimerRef.current) {
      clearTimeout(loaderTimerRef.current);
      loaderTimerRef.current = null;
    }
  }, []);

  // Sempre que a URL muda (e existe), mostra o overlay de "Carregando" e arma
  // um fallback: se o onLoad nao disparar dentro do tempo limite (dashboards
  // com conexao viva podem nunca dispara-lo), escondemos o overlay mesmo
  // assim, pois a pagina normalmente ja esta visivel.
  const armLoader = useCallback(() => {
    clearLoaderTimer();
    if (!url) return;
    setLoadingFrame(true);
    loaderTimerRef.current = setTimeout(() => {
      setLoadingFrame(false);
    }, LOADING_FALLBACK_MS);
  }, [url, clearLoaderTimer]);

  useEffect(() => {
    armLoader();
    return clearLoaderTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, frameKey]);

  const handleFrameLoad = useCallback(() => {
    clearLoaderTimer();
    setLoadingFrame(false);
  }, [clearLoaderTimer]);

  // Polling: detecta mudancas de current_url / updated_at.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const { data, error } = await supabaseAnon
          .from('tvs')
          .select('current_url, reload_nonce')
          .eq('slug', slug)
          .maybeSingle();
        if (!alive || error || !data) return;

        const nextUrl = (data.current_url as string) ?? '';
        const nextNonce = (data.reload_nonce as number) ?? 0;

        const urlChanged = nextUrl !== url;
        const nonceChanged = nextNonce !== reloadNonceRef.current;

        if (urlChanged) {
          reloadNonceRef.current = nextNonce;
          setUrl(nextUrl);
        } else if (nonceChanged) {
          // Mesma URL, mas o sinal de reload mudou -> recarrega o iframe.
          reloadNonceRef.current = nextNonce;
          setFrameKey((k) => k + 1);
        }
      } catch {
        /* silencioso: tenta de novo no proximo tick */
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [slug, url]);

  // Heartbeat: sinaliza que a TV esta viva.
  useEffect(() => {
    const beat = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [slug]);

  // Estado de repouso: sem URL definida.
  if (!url) {
    return (
      <main
        style={{ width: '100vw', height: '100vh' }}
        className="flex flex-col items-center justify-center bg-bg px-6 text-center"
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold text-text">
          Aguardando conteudo
        </h1>
        {name && <p className="mt-1 text-muted">{name}</p>}
        <p className="mt-6 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-sm text-muted">
          /tv/{slug}
        </p>
      </main>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0D0B14' }}>
      {loadingFrame && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-border bg-surface/90 px-4 py-2 text-sm text-muted backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Carregando...
          </div>
        </div>
      )}

      <iframe
        key={frameKey}
        src={url}
        title={name || slug}
        onLoad={handleFrameLoad}
        style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
        allow="autoplay; fullscreen; encrypted-media"
      />
    </div>
  );
}
