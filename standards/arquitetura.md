# Arquitetura Padrão — Produtos SaaS B2B

> Documento de referência. Descreve decisões arquiteturais **imutáveis** válidas para todos os produtos da casa. Não personalizar por produto.
>
> - Para contexto específico de cada produto → `CLAUDE.md`.
> - Para integrações opt-in (Hub, WhatsApp, etc.) → `PLAYBOOKS.md`.

---

## Princípio fundamental

**Um produto = um repositório = um projeto Supabase por ambiente.**

Cada produto tem:
- 1 repositório GitHub
- 1 projeto Supabase Pro (produção) em `sa-east-1`
- 1 projeto Supabase Free (staging) em `sa-east-1`
- 1 serviço Coolify de produção
- 1 serviço Coolify de staging

Tenants (clientes finais) do mesmo produto compartilham o mesmo banco, isolados por `tenant_id` + RLS. Adicionar um novo tenant = inserir linha no banco. Zero deploy.

Nunca compartilhar projeto Supabase entre produtos diferentes.

---

## Stack padrão

**Sempre presente em todo produto:**
- Frontend: React + TypeScript + Vite + Tailwind + shadcn-ui
- Identidade visual: **SB Tech** (Manrope + JetBrains Mono + paleta gold, ver "Identidade visual" abaixo)
- Backend: Supabase (Auth, Postgres, Edge Functions, Storage)
- Infra: Coolify + Traefik + Let's Encrypt (Hostinger KVM)
- CI/CD: GitHub Actions → webhook Coolify

**Opt-in (ver `PLAYBOOKS.md`):**
- Integração com Hub — obrigatória se o produto estiver no catálogo do Hub Admin
- Evolution API — WhatsApp self-hosted
- Mercado Pago — cobrança interna (tenant cobrando os clientes dele)

**Não é mais opt-in nos produtos:**
- Cobrança B2B via Asaas — migrou para o Hub Admin. Produtos não cobram mais o tenant diretamente.

---

## Identidade visual

Toda interface de produto da casa herda a identidade SB Tech em **duas camadas**:

### Camada 1 — DNA da casa (intocável)

Em `src/styles/sb-tech-base.css`. Vive idêntica em todo produto. Define:
- Paleta gold metálica (300–700) + house gradient
- Surfaces dark e light (primitivos), borders, hierarquia de texto
- Soft tints (peach, mint, sky, butter, rose, gold) com pares `-bg` e `-fg`
- Cores semânticas (success, warning, danger, info)
- Tipografia Manrope (sans) + JetBrains Mono (mono)
- Escala 4px-based de espaçamento
- Raios (6/10/14/20/pill)
- Motion (120/180/280ms, uma curva `cubic-bezier(0.22, 1, 0.36, 1)`)
- Shadows incluindo `--sb-shadow-focus` (gold ring) e `--sb-shadow-gold-glow`
- Classes utility `.sb-h1`, `.sb-eyebrow`, `.sb-stat`, `.sb-mono`, etc.

**Regra:** ninguém edita esse arquivo por produto. Se um valor precisa mudar pra todos os produtos, atualiza no template e propaga via PR.

### Camada 2 — Mood do produto (customizável)

Em `src/styles/tokens.css`. Define quais primitivos da Camada 1 viram tokens semânticos do produto:
- Escolha de tema (dark default ou light comentado)
- Cor primary do produto (default = gold da casa)
- Mapeamento de `--color-background`, `--color-foreground`, `--color-border`, etc. para os primitivos

O Tailwind config (`tailwind.config.ts`) consome esses tokens semânticos via HSL com alpha (`hsl(var(--color-primary) / <alpha-value>)`), então `bg-primary`, `text-foreground`, `border-border` funcionam em todo lugar.

### Regras invariantes da casa

Vale em todo produto, mesmo se trocar o tema ou a primary:

| Regra | Por quê |
|---|---|
| **Dinheiro é gold** | Token `--color-money` aponta sempre para `--sb-gold-400`. KPIs financeiros, MRR, receita usam `text-money`, nunca `text-primary`. Marca-d'água da casa. |
| **Eyebrow é gold** | `.sb-eyebrow` é uppercase 11px gold-400 em qualquer tema. |
| **Focus ring é gold** | `*:focus-visible` aplica `--sb-shadow-focus` (gold) em todos os produtos. |
| **Sentence case** | Headings, botões, tabs, nav items. Exceção: CTAs que viram nome próprio ("New Order", "AI Wizard"). |
| **Sem emoji em UI** | Permitido só em bubbles de chat de IA. |
| **Lucide stroke 1.75** | Default da casa, mais leve que Lucide stock (2). |
| **Tabular nums em números** | `font-variant-numeric: tabular-nums` automático em `.sb-stat`, `.sb-mono`, elementos com `[data-numeric]`. |
| **Sem glassmorphism, inner shadow, blur em topbars** | Toolbar/topbar é sempre bg sólido. |

### Estrutura de arquivos de estilo

```
src/styles/
├── sb-tech-base.css   ← Camada 1: DNA da casa (intocável)
├── tokens.css          ← Camada 2: mood do produto (editável)
└── globals.css         ← imports + Tailwind + reset mínimo
```

---

## Multi-tenancy

### Modelo

Banco compartilhado com Row-Level Security. Todos os tenants vivem no mesmo Postgres, isolados pela coluna `tenant_id` em toda tabela de negócio, com policies aplicadas automaticamente pelo Postgres.

Não usamos schemas separados por cliente, bancos separados por cliente, ou deploys separados por cliente.

### Tabelas core obrigatórias

Existem em **todo produto**, sem exceção. Schema da migration `0001_core.sql`:

```sql
-- 1. Tenants (clientes do produto)
create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  nome       text not null,
  plano      text default 'essencial',
  status     text default 'ativo',      -- 'ativo' | 'suspenso' | 'cancelado'
  created_at timestamptz default now()
);

-- 2. Membros (usuários vinculados a tenants)
create table public.tenant_members (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  role      text default 'member',      -- 'admin' | 'member' | 'viewer'
  primary key (tenant_id, user_id)
);

-- 3. Módulos ativos por tenant (feature flags)
create table public.subscriptions (
  tenant_id  uuid references public.tenants(id) on delete cascade,
  module     text not null,
  active     boolean default true,
  expires_at timestamptz,
  primary key (tenant_id, module)
);

-- 4. Configurações visuais e comportamentais por tenant
create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  config    jsonb default '{}'
  -- ex: {"cor_primaria":"#e63946","logo_url":"...","nome_exibido":"Arena X"}
);
```

Note que **não há `faturas_saas`** entre as tabelas core — cobrança B2B mora no Hub Admin, não nos produtos.

### Função helper obrigatória

```sql
create or replace function public.current_tenant_id()
returns uuid language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
$$;
```

Sem ela, `current_tenant_id()` retorna null e o RLS bloqueia tudo.

### Padrão para tabelas de domínio

```sql
create table public.<entidade> (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- ... campos da entidade ...
  created_at timestamptz default now()
);

create index idx_<entidade>_tenant on public.<entidade>(tenant_id);

alter table public.<entidade> enable row level security;

create policy "tenant_isolation" on public.<entidade>
  for all using (tenant_id = public.current_tenant_id());
```

Se a entidade pertence a um módulo opcional, verificar também a `subscription`:

```sql
create policy "tenant_isolation" on public.<entidade>
  for all using (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.subscriptions
      where tenant_id = public.current_tenant_id()
        and module = '<nome_modulo>'
        and active = true
    )
  );
```

### Setando tenant_id no JWT

O `tenant_id` deve estar em `app_metadata` do usuário, **não** em `user_metadata`. Sete via Admin API quando o usuário for criado ou convidado:

```typescript
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { tenant_id: tenantId }
})
```

---

## Módulos

### Conceito

Módulos são features vendidas separadamente dentro do mesmo produto. Vivem no mesmo banco e mesmo deploy — separação por **dados**, não por infraestrutura.

Um tenant com módulo `agenda` ativo vê e acessa a agenda. Sem o módulo, não vê nem consegue acessar os dados (bloqueado no frontend pelo router dinâmico e no banco pelo RLS).

**Não crie repositórios separados para módulos do mesmo produto.**

### Origem dos módulos ativos

Se o produto está integrado ao Hub Admin, os módulos ativos de cada tenant são definidos **pelo Hub** no momento do provisionamento — campo `modulos[]` do payload da Edge Function `tenant-provision`. O produto não decide quais módulos o tenant tem; ele recebe essa lista e salva em `subscriptions`.

**O produto é a fonte de verdade das chaves de módulo.** O catálogo de módulos disponíveis vive no produto via Edge Function `tenant-modules` (GET). O Hub importa esse catálogo via botão "Sincronizar do produto" e armazena em cache local (`produto_modulos`). Nunca o contrário — não cadastrar chaves no Hub e tentar manter em sync manualmente com o produto.

Se uma chave do payload `modulos[]` não tiver módulo implementado no produto, o produto ignora silenciosamente. Isso indica que o Hub está desatualizado — rodar "Sincronizar" no Hub resolve.

Ver `PLAYBOOKS.md > Integração com Hub` para o contrato completo e implementação de referência.

### Estrutura de pastas

```
src/
├── core/                     ← nunca desligado, base de todos os tenants
│   ├── auth/
│   ├── layout/
│   ├── ui/                   ← shadcn-ui + componentes universais (EmptyState, ConfirmModal)
│   └── tenant/
│       ├── useTenant.ts
│       └── useSubscriptions.ts
├── modules/
│   ├── <modulo_1>/
│   │   ├── pages/
│   │   ├── components/
│   │   └── index.ts          ← exporta { id, routes, menuItems }
│   └── <modulo_2>/
│       └── index.ts
├── styles/                   ← ver "Identidade visual"
│   ├── sb-tech-base.css
│   ├── tokens.css
│   └── globals.css
└── app/
    ├── router.tsx
    ├── menu.tsx
    └── providers.tsx
```

### Contrato de um módulo

```typescript
export const meuModulo = {
  id: 'alunos',
  routes: [
    { path: '/alunos', element: <AlunosPage /> },
    { path: '/alunos/:id', element: <AlunoDetailPage /> },
  ],
  menuItems: [
    { label: 'Alunos', path: '/alunos', icon: 'users' }
  ],
}
```

### Router dinâmico

```typescript
const ALL_MODULES = [/* importar todos os módulos do produto aqui */]

export function AppRouter() {
  const { activeModules } = useSubscriptions()
  const routes = ALL_MODULES
    .filter(m => activeModules.includes(m.id))
    .flatMap(m => m.routes)
  return <Routes>{routes.map(r => <Route key={r.path} {...r} />)}</Routes>
}
```

---

## Subdomínios

Cada tenant acessa o produto via subdomínio próprio:

```
academiax.seudominio.com.br   → slug 'academiax'
academiay.seudominio.com.br   → slug 'academiay'
```

Configuração necessária (uma vez por produto):

1. **Wildcard DNS**: `*.seudominio.com.br → IP do servidor de prod`
2. **Wildcard SSL**: Let's Encrypt via DNS challenge no Traefik
3. **Uma única instância** serve todos os tenants

O slug é resolvido no boot do frontend:

```typescript
const slug = window.location.hostname.split('.')[0]
```

Em dev local, usar `VITE_DEV_TENANT_SLUG` no `.env` como fallback.

---

## Personalização por cliente

| Tipo de personalização | Onde fica |
|---|---|
| Cores, logo, nome exibido | `tenant_settings.config` (JSONB) |
| Módulo ativo ou inativo | tabela `subscriptions` |
| Campo extra em uma entidade | coluna nullable na tabela de domínio |
| Campos customizados livres | tabela `tenant_custom_fields` (opt-in) |
| Fluxo completamente diferente | avaliar produto/repositório separado |

**Nunca:** criar branches por cliente, deploys por cliente, ou forks por cliente.

---

## Ambientes

| | Staging | Produção |
|---|---|---|
| Servidor | VPS menor (KVM 2) | VPS principal (KVM 4+) |
| Supabase | Projeto Free (org Free) | Projeto Pro (org Pro) |
| Branch | `hml` | `main` |
| Acesso | Equipe interna | Clientes reais |
| SSL | Opcional | Obrigatório (wildcard) |

### Coolify: um projeto por produto, dois environments

No Coolify a hierarquia é Projeto → Environment → Aplicação, e o servidor é escolhido por aplicação. É assim que o "Novo produto" do Hub monta cada produto hoje, sem deploy (`guias/novo-produto.md`, passo 5). É descrição da implementação, não regra verificável (não há ID em `regras.md`); produtos anteriores ao Hub podem estar diferentes:

| Environment | Servidor | Branch | Domínio | App |
|---|---|---|---|---|
| `homologação` | Homologação | `hml` | `<slug>-hlg.sbtech-group.com` | `<Produto> - HML` |
| `produção` | Produção | `main` | `<slug>.sbtech-group.com` | `<Produto> - PRD` |

- Projeto com nome `<Produto> (<slug>)`. Perfil de cada app: Nixpacks, publica `/dist`, porta 3000, `NIXPACKS_NODE_VERSION`.
- As variáveis `VITE_SUPABASE_*` são manuais por ambiente (cada ambiente tem o seu projeto Supabase). O primeiro deploy é manual e confirmado, e só acontece depois delas; os deploys seguintes seguem o CI/CD abaixo.
- Os uuids dos dois apps ficam em `produtos.coolify_*` no Hub. É por eles que a Sentinela lê os logs.
- O repositório precisa ter os dois branches (`hml` e `main`) antes do primeiro deploy: o Coolify falha com "Remote branch not found" se faltar um.

### Sentinela (leitura de logs)

`hub-log-watch` (sem IA, a cada 10 min) lê os dois environments de cada produto: erros nos logs, deploy falho e app parado. Cada problema vira um card em Tarefas do Hub (`origem = 'sentinela'`, com produto e ambiente); erro repetido atualiza o mesmo card. Texto de log passa por redação de segredos antes de virar card. Quem trata o card é uma pessoa ou um agente, nunca a própria Sentinela.

### Variáveis de ambiente

No Coolify, cada serviço tem env vars próprias. Nunca compartilhar chaves entre staging e prod.

```bash
# Staging
VITE_SUPABASE_URL=https://<projeto-staging>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-staging>

# Produção
VITE_SUPABASE_URL=https://<projeto-prod>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-prod>
```

Segredos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `HUB_PROVISIONING_TOKEN`, etc.) ficam no Infisical, nunca em `.env` commitado e nunca no frontend.

---

## CI/CD e branches

> Atualizado pelo ADR 0002 (`architecture/adr/0002-branches-producao-homologacao.md`), SBAGENTS 0.4.0.

| Branch | Propósito | Deploy automático |
|---|---|---|
| `main` | Produção. Só recebe PR de `hml` ou `hotfix/*`. | Sim, após aprovação no environment `production` |
| `hml` | Homologação. Recebe os PRs das branches de trabalho. | Sim, automático |
| `feature/*`, `fix/*` | Trabalho de pessoas, a partir de `hml`. | Não |
| `agente/<nome>/<assunto>` | Trabalho de agentes, a partir de `hml`. | Não |
| `hotfix/*` | Correção urgente, a partir de `main`; depois `main` é mesclado em `hml`. | Não |

**Regras:**
- Nunca push direto em `main` ou `hml` — sempre via PR, de pessoa ou de agente
- Branches de trabalho → PR para `hml` (CI verde + 1 revisão humana)
- `hml` → PR para `main` (CI verde + aprovação no GitHub Environment `production`)
- Agente nunca abre PR para `main`

### Proteção de branches no GitHub

**`main`:** PR obrigatório, 1 aprovação, status checks passando, sem bypass.
**`hml`:** PR obrigatório, 1 aprovação, status checks passando.
**Environment `production`:** revisor obrigatório.

### Workflows

```yaml
# .github/workflows/staging.yml
name: Deploy Staging
on:
  push:
    branches: [hml]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Coolify
        run: |
          curl -X POST "${{ secrets.COOLIFY_WEBHOOK_STAGING }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN_STAGING }}"
```

```yaml
# .github/workflows/production.yml
name: Deploy Produção
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Trigger Coolify
        run: |
          curl -X POST "${{ secrets.COOLIFY_WEBHOOK_PROD }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN_PROD }}"
```

---

## Segredos e variáveis

| Variável | Onde fica | Quem acessa |
|---|---|---|
| `VITE_SUPABASE_URL` | Coolify env vars | Frontend (público) |
| `VITE_SUPABASE_ANON_KEY` | Coolify env vars | Frontend (público) |
| `SUPABASE_SERVICE_ROLE_KEY` | Infisical → Coolify | Edge Functions |
| `HUB_PROVISIONING_TOKEN` | Infisical → Supabase secrets | Edge Function `tenant-provision` (se aplicável) |
| `COOLIFY_WEBHOOK_*` | GitHub Secrets | GitHub Actions |

Regras imutáveis:
- Nunca commitar `.env` com valores reais — apenas `.env.example`
- `SUPABASE_SERVICE_ROLE_KEY` nunca vai pro frontend
- Chaves de produção nunca em staging e vice-versa

---

## Configuração obrigatória do Supabase Auth por produto

Antes de qualquer provisonamento, configurar no **Dashboard Supabase do produto** (não do Hub):

| Campo | Onde | Valor |
|---|---|---|
| **Site URL** | Authentication → URL Configuration | `https://<dominio-raiz-do-produto>` |
| **Redirect URLs** | Authentication → URL Configuration → Add URL | `https://*.<dominio-raiz-do-produto>/**` |

**Por que é crítico:** `tenant-provision` usa `generateLink` com `redirectTo: https://{slug}.{PRODUCT_DOMAIN}/welcome`. Se o padrão `*.dominio/**` não estiver na allowlist, o Supabase **ignora o `redirectTo`** e cai no fallback (Site URL + `/login`) — o admin é redirecionado para o domínio raiz do produto em vez do subdomínio do tenant dele.

Dois domínios distintos precisam de dois padrões distintos. Exemplo para Arena Hub:
- `https://*.arenahub.sbtech-group.com/**` — subdomínios do servidor de staging/prod
- `https://*.arenahub.com.br/**` — subdomínios de produção no domínio próprio (quando ativo)

---

## Invite flow — página `/welcome`

Todo produto integrado ao Hub deve ter uma rota pública `/welcome` que trata o token de convite.

**Fluxo completo:**
1. Hub provisiona tenant → `tenant-provision` chama `generateLink(type: 'invite', redirectTo: .../welcome)`
2. `tenant-provision` retorna `invite_link` no response
3. Hub envia e-mail via Resend com o `invite_link`
4. Admin clica → Supabase verifica token → redireciona para `{subdomain}/welcome#access_token=...&type=invite`
5. App monta `/welcome` → SDK processa hash → sessão estabelecida
6. UI exibe formulário "Crie sua senha" → `supabase.auth.updateUser({ password })`
7. Redirect para `/dashboard`

**Implementação mínima:**

```tsx
// src/pages/WelcomePage.tsx — rota pública /welcome
export function WelcomePage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Senha definida. Bem-vindo!')
    navigate('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Crie sua senha</h1>
      <input type="password" minLength={8} value={password}
             onChange={e => setPassword(e.target.value)} required />
      <button type="submit" disabled={loading}>Entrar</button>
    </form>
  )
}
```

**Regras:**
- `/welcome` deve ser rota **pública** — fora do guard de auth. O usuário ainda não tem sessão quando chega.
- Não reutilizar o layout autenticado nesta rota.
- Verificar `supabase.auth.onAuthStateChange` para detectar `SIGNED_IN` com `type=invite` se precisar de lógica adicional.

---

## Onboarding de novo tenant

Há **dois caminhos**:

### (a) Via Hub Admin (preferido se o produto está no catálogo)

O Hub Admin chama a Edge Function `tenant-provision` do produto. O produto cria tenant, settings, subscriptions e envia o convite ao admin. Ver `PLAYBOOKS.md > Integração com Hub`.

### (b) Manualmente via SQL (bootstrap, testes, produtos fora do catálogo)

```sql
-- 1. Criar o tenant
insert into public.tenants (slug, nome, plano)
values ('novocliente', 'Nome do Cliente', 'essencial')
returning id;

-- 2. Ativar módulos contratados
insert into public.subscriptions (tenant_id, module, active)
values
  ('<id>', 'modulo_a', true),
  ('<id>', 'modulo_b', true);

-- 3. Configurações visuais (opcional)
insert into public.tenant_settings (tenant_id, config)
values ('<id>', '{"cor_primaria": "#1a56db", "nome_exibido": "Nome do Cliente"}');
```

Depois, criar o usuário admin via Supabase Dashboard ou Admin API e setar `app_metadata.tenant_id`.

Nenhum deploy necessário em nenhum dos caminhos.

---

## Superadmin do sistema

`admin@sbtech-group.com` é o usuário interno da SB Tech com acesso irrestrito a todos os produtos e todos os tenants. **Não está sujeito a planos nem módulos.**

### Como funciona

- Cada produto tem este usuário criado em sua própria instância Supabase
- Adicionado como `role: 'superadmin'` em **todo tenant** no momento do provisionamento
- JWT contém `app_metadata.is_system_admin = true`
- RLS e router verificam esta flag e concedem acesso total

### Helper obrigatório no produto

```sql
create or replace function public.is_system_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean,
    false
  );
$$;
```

### Padrão de policy com bypass de superadmin

```sql
-- Qualquer policy de tenant isolation deve incluir OR is_system_admin()
create policy "tenant_isolation" on public.<entidade>
  for all using (
    tenant_id = public.current_tenant_id()
    or public.is_system_admin()
  );

-- Módulos opcionais: acesso se módulo ativo OU superadmin
create policy "tenant_modulo_isolation" on public.<entidade>
  for all using (
    (
      tenant_id = public.current_tenant_id()
      and exists (
        select 1 from public.subscriptions
        where tenant_id = public.current_tenant_id()
          and module = '<modulo>'
          and active = true
      )
    )
    or public.is_system_admin()
  );
```

### Router no produto

```typescript
const { activeModules, isSystemAdmin } = useSubscriptions()
const routes = ALL_MODULES
  .filter(m => isSystemAdmin || m.alwaysActive || activeModules.includes(m.id))
  .flatMap(m => m.routes)
```

### Variável obrigatória

```bash
SYSTEM_ADMIN_EMAIL=admin@sbtech-group.com   # mesmo valor em todos os produtos
```

Nunca hardcodar o email no código — usar env var para facilitar testes em staging com email diferente.

---

## Offboarding de tenant

```sql
update public.tenants set status = 'cancelado' where slug = 'novocliente';
update public.subscriptions set active = false where tenant_id = '<id>';
```

Antes de qualquer hard delete: exportar dados (`pg_dump` filtrando por `tenant_id`) e entregar. Se o tenant veio do Hub, marcar a assinatura como cancelada lá também.

---

## Decisões de arquitetura e seus motivos

Estas decisões foram tomadas deliberadamente. Não as reverter sem entender o contexto.

**Por que Supabase e não Postgres self-hosted?**
Supabase Cloud (org Pro, $25/mês) entrega Auth + RLS + Postgres + Storage + Edge Functions gerenciados. Self-hosting exige 5–15h/mês de operação. Para a fase atual (3–50 clientes por produto), o custo de tempo supera qualquer economia de infraestrutura.

**Por que banco compartilhado e não banco por cliente?**
Banco por cliente significa: cada migration em N bancos, backup de N bancos, conexão de N bancos, custo de N instâncias. Com RLS, isolamento equivalente com complexidade operacional de 1 banco.

**Por que não Keycloak?**
Supabase Auth resolve autenticação, e `app_metadata` resolve o tenant no JWT. Reavaliar quando um cliente enterprise exigir SSO via SAML/Active Directory.

**Por que repositório por produto e não monorepo geral?**
Produtos diferentes têm ciclos de deploy independentes, times potencialmente diferentes e projetos Supabase separados. Monorepo geral criaria acoplamento desnecessário. Módulos do mesmo produto ficam no mesmo repositório.

**Por que cobrança B2B é responsabilidade do Hub e não de cada produto?**
Um cliente pode contratar 3 produtos da casa e não quer receber 3 boletos. Centralizar cobrança no Hub permite faturamento consolidado por cliente. Como bônus, cada produto fica mais simples (sem schema de billing, sem integração Asaas).

**Por que dois níveis de tokens de design (primitivos da casa + semânticos do produto)?**
Permite herdar identidade SB Tech (tipografia, espaçamento, motion, regras) sem forçar todo produto a parecer idêntico. Produtos podem ter mood diferente (dark/light, cor primary distinta) preservando o DNA da casa. O custo é uma camada extra de indireção — aceitável dado o benefício.

**Por que dois servidores (staging/prod) e não dois ambientes no mesmo?**
Um erro em staging nunca deve tocar dados de produção. Servidores separados garantem isso por design, não por disciplina.
