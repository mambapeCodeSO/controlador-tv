Quero criar uma aplicação web para controlar remotamente o conteúdo exibido em TVs da empresa.

## Objetivo da aplicação

A ideia é evitar ter que digitar URLs manualmente nas Smart TVs.

Cada TV vai abrir uma única vez uma URL fixa da aplicação, por exemplo:

* `/tv/recepcao`
* `/tv/comercial`
* `/tv/sala-reuniao`

Depois disso, pelo computador, eu acesso um painel admin e escolho qual URL cada TV deve exibir.

Exemplo:

* TV Recepção → `https://mambadigital.com.br`
* TV Comercial → `https://dashboard.mamba.com.br`
* TV Sala de Reunião → `https://mambaacademy.com.br`

A TV deve continuar exibindo o conteúdo mesmo se eu fechar o painel admin no computador, porque quem estará exibindo a página é a própria TV.

## Conceito principal

A aplicação terá dois lados:

1. **Painel Admin**

   * Interface para listar as TVs cadastradas.
   * Campo para inserir/alterar a URL atual de cada TV.
   * Botão para atualizar a TV.
   * Exibir status básico da TV, como online/offline com base no último acesso.

2. **Player da TV**

   * Página aberta diretamente na TV.
   * Deve ocupar a tela inteira.
   * Deve carregar a URL definida no painel admin dentro de um `iframe`.
   * Deve consultar periodicamente o banco para saber se a URL mudou.
   * Se a URL mudar, deve atualizar o `src` do iframe automaticamente.
   * A TV deve manter a rota fixa, por exemplo `/tv/recepcao`, e apenas trocar o conteúdo interno do iframe.

## Cadastro das TVs

A aplicação deve usar a opção simples de cadastro manual por slug.

Não quero usar IP, Bluetooth, descoberta automática de rede, API Samsung/Tizen ou pareamento por código neste primeiro MVP.

As TVs serão cadastradas manualmente no painel admin ou diretamente no banco Supabase.

Cada TV deve ter:

* Nome amigável
* Slug único
* URL atual
* URL padrão opcional
* Status ativa/inativa
* Último acesso

Exemplo:

```
TV Recepção
slug: recepcao
rota fixa: /tv/recepcao

```

```
TV Comercial
slug: comercial
rota fixa: /tv/comercial

```

```
TV Sala de Reunião
slug: sala-reuniao
rota fixa: /tv/sala-reuniao

```

O fluxo será:

1. Eu cadastro a TV no sistema com nome e slug.
2. A aplicação gera/usa uma rota fixa para essa TV.
3. Eu abro essa rota uma única vez no navegador da Samsung TV.
4. A TV fica com essa página aberta em tela cheia.
5. Depois eu controlo pelo painel admin qual URL será exibida dentro do iframe.
6. Não preciso identificar a TV por IP. A própria rota `/tv/[slug]` identifica qual TV está sendo controlada.

A rota da TV deve ser fixa e permanente:

```
https://controle.minhaempresa.com.br/tv/recepcao

```

Essa rota deve buscar no Supabase o registro com `slug = recepcao`, pegar o `current_url` e exibir essa URL dentro do iframe fullscreen.

O painel admin deve listar as TVs cadastradas no Supabase e permitir alterar o `current_url` de cada uma.

## Stack escolhida

Usar:

* Astro
* Tailwind CSS
* React somente para componentes interativos
* Supabase como banco de dados
* Polling simples para atualização das TVs
* Deploy compatível com Vercel, Railway ou similar

Quero usar Astro como base das páginas e React apenas como island/component onde tiver interação, como painel admin e player da TV.

## Por que usar Supabase

O Supabase será usado para salvar o estado atual de cada TV.

Ele deve armazenar:

* nome da TV
* slug da TV
* URL atual
* se está ativa
* último acesso da TV
* data da última atualização

Assim, mesmo que o painel admin seja fechado no computador, a informação continua salva no banco e a TV continua exibindo a URL configurada.

## Estrutura esperada de rotas

Criar algo próximo disso:

```txt
/admin
/tv/[slug]
/login
```

Sugestão de estrutura de arquivos:

```txt
src/
  pages/
    admin.astro
    login.astro
    tv/
      [slug].astro

  components/
    AdminPanel.tsx
    TvPlayer.tsx
    TvCard.tsx

  lib/
    supabase.ts
```

## Banco de dados no Supabase

Criar uma tabela `tvs` com estrutura parecida com:

```sql
create table tvs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  current_url text not null,
  is_active boolean default true,
  last_seen_at timestamptz,
  updated_at timestamptz default now()
);
```

Exemplo de registros:

```txt
slug: recepcao
name: TV Recepção
current_url: https://mambadigital.com.br
```

```txt
slug: comercial
name: TV Comercial
current_url: https://dashboard.mamba.com.br
```

## Funcionamento do player da TV

A TV acessa uma URL fixa:

```txt
https://controle.minhaempresa.com.br/tv/recepcao
```

Essa página deve:

1. Buscar no Supabase a TV pelo `slug`.
2. Pegar o campo `current_url`.
3. Renderizar um iframe fullscreen com essa URL.
4. A cada 5 segundos, consultar novamente o Supabase.
5. Se `current_url` mudou, atualizar o iframe.
6. Atualizar `last_seen_at` periodicamente para indicar que a TV está online.

O iframe deve ocupar 100% da tela:

```txt
width: 100vw
height: 100vh
border: none
```

Também quero uma tela de fallback/loading caso a URL esteja vazia ou a TV não seja encontrada.

## Funcionamento do painel admin

No `/admin`, quero uma interface simples com cards das TVs.

Cada card deve mostrar:

* Nome da TV
* Slug
* URL atual
* Status online/offline
* Campo para nova URL
* Botão “Atualizar TV”
* Botão opcional “Recarregar”
* Botão opcional “Tela padrão”

Quando eu atualizar uma URL no painel admin, o campo `current_url` da TV deve ser atualizado no Supabase.

Na próxima consulta da TV, ela deve detectar a mudança e trocar o iframe automaticamente.

## Status online/offline

A TV deve atualizar `last_seen_at` enquanto estiver aberta.

No painel admin:

* Se `last_seen_at` for menor que 30 segundos atrás, mostrar como online.
* Se for maior que 30 segundos, mostrar como offline.

## Segurança

Para o MVP, pode ter uma autenticação simples para proteger o admin.

Pode ser:

* login simples com senha
* ou Supabase Auth
* ou variável de ambiente com senha admin

O importante é que a rota `/admin` não fique pública para qualquer pessoa alterar as URLs.

Também validar URLs antes de salvar:

* aceitar apenas `http://` ou `https://`
* impedir string vazia
* exibir erro amigável se a URL for inválida

## Observações importantes

Alguns sites podem bloquear abertura dentro de iframe por `X-Frame-Options` ou `Content-Security-Policy`.

Mesmo assim, o primeiro MVP deve usar iframe porque a maioria das páginas que queremos exibir serão nossas páginas, dashboards ou conteúdos internos.

Se uma URL não puder abrir em iframe, mostrar uma mensagem simples informando que aquele site bloqueia exibição embutida.

## Requisitos visuais

Criar uma interface moderna e limpa usando Tailwind.

Identidade visual preferencial:

* Fundo escuro
* Roxo escuro como cor principal
* Cards com bordas suaves
* Visual tecnológico
* Interface objetiva, sem excesso de elementos

## Resultado esperado

Quero que você me ajude a estruturar e implementar esse projeto em Astro + Tailwind + React + Supabase.

Comece criando:

1. Estrutura inicial do projeto.
2. Configuração do Supabase.
3. SQL da tabela `tvs`.
4. Página `/admin` com listagem e edição das TVs.
5. Página `/tv/[slug]` com player fullscreen em iframe.
6. Polling de 5 segundos.
7. Atualização de `last_seen_at`.
8. Validação básica de URL.
9. Proteção simples do painel admin.

A aplicação deve ser simples, funcional e fácil de evoluir depois.
