import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// SSR é necessário para auth (cookies), middleware e rotas de API.
// Adapter Node standalone: gera um servidor próprio (dist/server/entry.mjs)
// que o Heroku executa via Procfile. Ele lê HOST e PORT do ambiente — o
// Heroku injeta a PORT automaticamente.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), tailwind()],
});
