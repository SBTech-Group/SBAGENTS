# Playbooks de Integrações Opt-in

> Padrões para integrações que **não são obrigatórias** em todo produto. Ligar apenas se o produto contratou aquela feature. Marcar a integração como ativa em `CLAUDE.md > Integrações ativas`.
>
> Padrões arquiteturais gerais → `ARCHITECTURE.md`.

---

## Integração com Hub (obrigatório se o produto está no catálogo)

Permite que o Hub Admin provisione tenants neste produto remotamente. Necessário para qualquer produto vendido através do hub centralizado.

### Quando usar

- O produto está (ou estará) no catálogo do Hub Admin
- Tenants do produto são provisionados via venda no Hub (não manualmente)
- O Hub centraliza cobrança B2B desse produto

### Quando não usar

- Produto piloto/MVP que ainda não entrou no catálogo (provisionamento manual via SQL)
- Produto white-label cliente-only, sem venda via casa

### Schema necessário

Nenhum novo. Usa as tabelas core (`tenants`, `tenant_members`, `subscriptions`, `tenant_settings`) que já existem por `ARCHITECTURE.md`.

### Endpoint de discovery `tenant-modules`

O produto expõe um endpoint de discovery que o Hub usa para importar automaticamente os módulos disponíveis. **Elimina sincronização manual** — produto é fonte de verdade.

```http
GET {SUPABASE_URL}/functions/v1/tenant-modules
Authorization: Bearer {HUB_PROVISIONING_TOKEN}
```

**Response:**
```json
[
  { "chave": "admin",   "label": "Painel Admin" },
  { "chave": "student", "label": "Área do Aluno" },
  { "chave": "teacher", "label": "Área do Professor" }
]
```

O Hub deriva a URL trocando o sufixo da `provision_endpoint`:
```
.../functions/v1/tenant-provision → .../functions/v1/tenant-modules
```

O Hub armazena o resultado em `produto_modulos` (cache local). O botão **"Sincronizar do produto"** na aba Módulos chama `hub-discover-modules` (Edge Function do Hub) que faz o upsert. Cadastro manual continua disponível como fallback.

---

### Como `modulos` mapeia para o banco

O campo `modulos: string[]` do payload do Hub mapeia **diretamente** para linhas na tabela `subscriptions` do produto (`ARCHITECTURE.md > Tabelas core obrigatórias`).

```
Hub payload          → Produto (subscriptions)
─────────────────────────────────────────────
modulos[0] = "agenda"  → { tenant_id, module: "agenda", active: true }
modulos[1] = "crm"     → { tenant_id, module: "crm",    active: true }
```

As chaves em `modulos[]` **devem coincidir** com as chaves cadastradas em `produto_modulos` no Hub Admin (aba Módulos do produto). O Hub usa essas chaves para validação no UI de planos e para gravar o snapshot `modulos_ativos` no tenant provisionado.

### Re-provisionamento (mudança de plano)

O Hub chama a mesma função quando um cliente muda de plano. Neste caso `slug` já existe, mas `modulos[]` pode ser diferente. A função **deve sincronizar** as subscriptions: ativar os módulos novos e desativar os removidos. Não basta retornar `already_provisioned` sem atualizar.

### Edge Function `tenant-provision`

Endpoint que o Hub chama para criar ou re-provisionar um tenant neste produto. **Deve ser idempotente e sincronizar módulos em toda chamada.**

```typescript
// supabase/functions/tenant-provision/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const HUB_TOKEN = Deno.env.get('HUB_PROVISIONING_TOKEN')!
const SYSTEM_ADMIN_EMAIL = Deno.env.get('SYSTEM_ADMIN_EMAIL') ?? 'admin@sbtech-group.com'

// Garante que o superadmin da SB Tech existe no auth deste produto
// e está adicionado como membro do tenant com role superadmin.
async function ensureSystemAdmin(supabase: ReturnType<typeof createClient>, tenant_id: string) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find(u => u.email === SYSTEM_ADMIN_EMAIL)

  let adminId: string
  if (existing) {
    adminId = existing.id
    // Garante flag is_system_admin no app_metadata
    if (!existing.app_metadata?.is_system_admin) {
      await supabase.auth.admin.updateUserById(adminId, {
        app_metadata: { ...existing.app_metadata, is_system_admin: true },
      })
    }
  } else {
    // Cria usuário sem senha — acesso via "esqueci a senha" no primeiro login
    const { data: created } = await supabase.auth.admin.createUser({
      email: SYSTEM_ADMIN_EMAIL,
      email_confirm: true,
      app_metadata: { is_system_admin: true },
    })
    adminId = created?.user?.id ?? ''
  }

  if (!adminId) return

  // Adiciona ao tenant com role superadmin (upsert — idempotente)
  await supabase.from('tenant_members').upsert(
    { tenant_id, user_id: adminId, role: 'superadmin' },
    { onConflict: 'tenant_id,user_id' },
  )
}

Deno.serve(async (req) => {
  // 1. Autentica chamada do Hub
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${HUB_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug, nome, plano, modulos, admin_email, config } = await req.json()

  if (!slug || !Array.isArray(modulos)) {
    return new Response('slug e modulos são obrigatórios', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 2. Idempotência — se tenant já existe, sincroniza módulos e retorna
  const { data: existing } = await supabase
    .from('tenants').select('id').eq('slug', slug).maybeSingle()

  if (existing) {
    // Sincroniza subscriptions: desativa todos, reativa os do payload
    await supabase.from('subscriptions')
      .update({ active: false })
      .eq('tenant_id', existing.id)

    if (modulos.length > 0) {
      await supabase.from('subscriptions').upsert(
        modulos.map((module: string) => ({ tenant_id: existing.id, module, active: true })),
        { onConflict: 'tenant_id,module' }
      )
    }

    // Atualiza plano no tenant (pode ter mudado)
    await supabase.from('tenants').update({ plano }).eq('id', existing.id)

    // Garante superadmin mesmo em re-provisionamentos
    await ensureSystemAdmin(supabase, existing.id)

    return Response.json({
      tenant_id: existing.id,
      subdomain_url: `https://${slug}.${Deno.env.get('PRODUCT_DOMAIN')}`,
      status: 'already_provisioned',
    })
  }

  // 3. Cria tenant + settings + subscriptions
  const { data: tenant, error } = await supabase
    .from('tenants').insert({ slug, nome, plano }).select().single()

  if (error) return new Response(`Error: ${error.message}`, { status: 500 })

  await supabase.from('tenant_settings').insert({
    tenant_id: tenant.id,
    config: { nome_exibido: nome },
  })

  if (modulos.length > 0) {
    await supabase.from('subscriptions').insert(
      modulos.map((module: string) => ({ tenant_id: tenant.id, module, active: true }))
    )
  }

  // 4. Convida admin do tenant via generateLink (não inviteUserByEmail — template fixo no plano Free)
  let invite_link: string | null = null
  if (admin_email) {
    const subdomain_url = `https://${slug}.${Deno.env.get('PRODUCT_DOMAIN')}`
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: admin_email,
      options: {
        data: { tenant_id: tenant.id, app_name: Deno.env.get('PRODUCT_NAME') ?? '', workspace: nome },
        redirectTo: `${subdomain_url}/welcome`,
      },
    })

    if (!linkErr && linkData?.user?.id) {
      await supabase.auth.admin.updateUserById(linkData.user.id, {
        app_metadata: { tenant_id: tenant.id },
      })
      invite_link = linkData.properties?.action_link ?? null
    }
  }

  // 5. Garante superadmin do sistema em todo tenant provisionado
  await ensureSystemAdmin(supabase, tenant.id)

  // invite_link retornado para o Hub — Hub envia o e-mail via Resend
  // (produto não envia email diretamente; centralizado no Hub)
  return Response.json({
    tenant_id: tenant.id,
    subdomain_url: `https://${slug}.${Deno.env.get('PRODUCT_DOMAIN')}`,
    invite_link,
    admin_invite_sent_to: admin_email ?? null,
    status: 'provisioned',
  })
})
```

### Variáveis necessárias

```bash
HUB_PROVISIONING_TOKEN=<gerar UUID único por produto, registrar no Hub e no Infisical>
PRODUCT_DOMAIN=<dominio raiz do produto, ex: arenahub.sbtech-group.com>
PRODUCT_NAME=<nome legível do produto, ex: Arena Hub>
SYSTEM_ADMIN_EMAIL=admin@sbtech-group.com   # mesmo valor em todos os produtos
```

> **`PRODUCT_DOMAIN`** deve ser o domínio de onde os subdomínios de tenant são gerados.
> Ex: se o tenant acessa `slug.arenahub.sbtech-group.com`, então `PRODUCT_DOMAIN=arenahub.sbtech-group.com`.
> O Hub envia e-mail com `invite_link` via Resend — o produto não precisa de `RESEND_API_KEY`.

### Contrato request/response

**Request (do Hub para o produto):**
```http
POST {SUPABASE_URL}/functions/v1/tenant-provision
Authorization: Bearer {HUB_PROVISIONING_TOKEN}
Content-Type: application/json

{
  "slug": "novaarena",
  "nome": "Nova Arena LTDA",
  "plano": "pro",
  "modulos": ["alunos", "agenda", "financeiro"],
  "admin_email": "admin@novaarena.com.br",
  "assinatura_id": "uuid-no-hub",
  "config": {
    "documento": "12.345.678/0001-99",
    "preco_mensal": 490.00,
    "ciclo": "mensal"
  }
}
```

> `modulos[]` contém as chaves exatas cadastradas em `produto_modulos` no Hub Admin.
> `config` é informativo — preço e ciclo ficam no Hub, não no produto.
> `admin_email` pode ser null se o cliente ainda não tem email cadastrado.

**Response de sucesso (HTTP 200):**
```json
{
  "tenant_id": "uuid-no-produto",
  "subdomain_url": "https://novaarena.arenahub.sbtech-group.com",
  "invite_link": "https://[ref].supabase.co/auth/v1/verify?token=...&type=invite&redirect_to=...",
  "admin_invite_sent_to": "admin@novaarena.com.br",
  "status": "provisioned"
}
```

> `invite_link` é gerado via `generateLink(type: 'invite')`. O Hub usa esse link para enviar o e-mail de convite via Resend. O produto **não envia e-mail** — retorna apenas o link. Se o admin já existia, `invite_link` é `null` e o Hub não reenvia.

**Response de re-provisionamento (HTTP 200):**
```json
{
  "tenant_id": "uuid-no-produto",
  "subdomain_url": "https://novaarena.arenahub.sbtech-group.com",
  "invite_link": null,
  "status": "already_provisioned"
}
```

**Response de erro (HTTP 4xx/5xx):**
```json
{ "error": "mensagem descritiva" }
```

`status` pode ser: `provisioned` (criado agora), `already_provisioned` (já existia, módulos sincronizados).
O Hub interpreta qualquer status não-2xx como falha e registra em `tenants_provisionados.last_error`.

### Gating de módulos no produto

O produto usa `subscriptions` para controlar acesso:

**Router dinâmico** — carrega apenas rotas dos módulos ativos:
```typescript
const { activeModules } = useSubscriptions() // lê subscriptions do tenant atual
const routes = ALL_MODULES
  .filter(m => activeModules.includes(m.id))
  .flatMap(m => m.routes)
```

**RLS no banco** — bloqueio no nível do Postgres (ver `ARCHITECTURE.md`):
```sql
-- Tabelas de módulos opcionais aplicam esta policy:
create policy "tenant_isolation" on public.<entidade>
  for all using (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.subscriptions
      where tenant_id = public.current_tenant_id()
        and module = '<chave_do_modulo>'
        and active = true
    )
  );
```

Módulo inativo = usuário não vê a rota no menu + banco bloqueia leitura/escrita. Dois níveis de proteção.

### Checklist de ativação

**Supabase Auth do produto (Dashboard — não é via código):**
- [ ] **Site URL** → `https://<dominio-raiz-do-produto>` (ex: `https://arenahub.sbtech-group.com`)
- [ ] **Redirect URLs** → adicionar `https://*.<dominio-raiz-do-produto>/**` (ex: `https://*.arenahub.sbtech-group.com/**`)
- [ ] Se tiver domínio próprio: adicionar também `https://*.<dominio-proprio>/**`

**Produto (Edge Functions + código):**
- [ ] Edge Function `tenant-modules` deployada (retorna `[{chave, label}]`)
- [ ] Edge Function `tenant-provision` deployada — usa `generateLink` (não `inviteUserByEmail`), retorna `invite_link`
- [ ] Rota pública `/welcome` implementada no produto (trata token de convite, exibe form de senha)
- [ ] `HUB_PROVISIONING_TOKEN` adicionado ao Supabase secrets do produto
- [ ] `PRODUCT_DOMAIN` configurado nos secrets (domínio de onde partem os subdomínios de tenant)
- [ ] `PRODUCT_NAME` configurado nos secrets (nome legível, usado no e-mail de convite)
- [ ] `SYSTEM_ADMIN_EMAIL=admin@sbtech-group.com` configurado nos secrets

**Hub Admin:**
- [ ] Produto cadastrado no Hub (provision_endpoint, provisioning_token_ref)
- [ ] Env var `{PRODUTO}_PROVISIONING_TOKEN` adicionada ao Supabase secrets do Hub
- [ ] Módulos sincronizados via botão **Sincronizar do produto** (aba Módulos)
- [ ] Planos criados com as chaves de módulo corretas

**Testes:**
- [ ] Provisionar via Hub → tenant criado + e-mail de convite recebido + link aponta para subdomínio do tenant
- [ ] Clicar no link → redirecionado para `{slug}.{dominio}/welcome` → form de senha aparece
- [ ] Definir senha → login funciona no subdomínio correto
- [ ] Teste de idempotência: provisionar duas vezes com mesmo slug → não duplica
- [ ] Teste de re-provisionamento: mudar plano no Hub → módulos sincronizados no produto
- [ ] `admin@sbtech-group.com` acessa todos os módulos em qualquer tenant
- [ ] RLS bloqueia tenant A de acessar dados do tenant B
- [ ] `CLAUDE.md` marcado com integração ativa

---

## WhatsApp via Evolution API

> **Obsoleto desde 2026-09 (SBAGENTS 0.3.0).** O Hub Admin removeu a Evolution e centralizou o WhatsApp oficial Meta (`hub-meta-*`). Produtos novos usam WhatsApp pelo Hub: ver `contrato-integracao-produto.md > Integrações transversais`. Esta seção fica só como referência para produtos que ainda usam Evolution.

Para produtos que precisam enviar/receber mensagens WhatsApp em nome dos tenants.

### Quando usar

- Notificações automáticas para clientes finais (lembretes, confirmações)
- Atendimento via WhatsApp integrado ao produto
- Disparo de mensagens em massa (com opt-in do destinatário)

### Quando não usar

- Produto B2B puro sem comunicação com clientes finais
- Já existe outra solução de mensageria integrada

### Setup

Evolution API roda self-hosted no servidor de produção. Cada tenant tem uma instância própria, identificada por nome (geralmente o `slug` do tenant).

```bash
EVOLUTION_API_URL=https://evolution.seudominio.com.br
EVOLUTION_API_KEY=<no Infisical>
```

### Schema sugerido (opt-in)

```sql
create table public.whatsapp_instancias (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  nome         text not null,
  status       text default 'desconectada',
  numero       text,
  created_at   timestamptz default now()
);

create table public.whatsapp_mensagens (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  instancia_id uuid references public.whatsapp_instancias(id) on delete cascade,
  numero       text not null,
  conteudo     text,
  direcao      text,                          -- 'entrada' | 'saida'
  status       text,
  created_at   timestamptz default now()
);
```

Aplicar RLS em ambas seguindo o padrão de `ARCHITECTURE.md`.

### Checklist de ativação

- [ ] Evolution API rodando no servidor de prod via Coolify
- [ ] `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no Infisical
- [ ] Tabelas `whatsapp_instancias` e `whatsapp_mensagens` via migration
- [ ] Edge Function recebendo webhooks da Evolution
- [ ] Fluxo de pareamento QR Code dentro do produto
- [ ] `CLAUDE.md` marcado com integração ativa

---

## Mercado Pago (cobrança interna)

O **tenant** está cobrando os **clientes dele** (não você cobrando o tenant — isso é Hub). É uma feature *dentro* do produto, oferecida ao tenant.

### Quando usar

- O produto inclui módulo de cobrança/financeiro para os tenants usarem com clientes finais
- Cada tenant tem sua própria conta Mercado Pago conectada

### Quando não usar

- Para cobrança B2B (você → tenant) — isso é Hub, não produto
- Quando o módulo financeiro do produto não envolve cobrança digital

### Considerações

- Cada tenant precisa autorizar via OAuth do Mercado Pago para conectar a conta dele
- O access token de cada tenant é armazenado criptografado (Supabase Vault ou `pgcrypto`)
- Webhooks devem identificar de qual tenant veio cada notificação — incluir `tenant_id` no `external_reference`

(Esta seção será expandida quando houver um produto em produção usando o padrão.)

---

## Como adicionar um novo playbook

Quando uma integração opt-in se repetir em 2+ produtos, vale adicionar como seção aqui. Estrutura mínima:

1. **Quando usar / quando não usar** — para evitar adoção indevida
2. **Schema necessário** — tabelas + RLS
3. **Edge Functions** — webhooks, processadores
4. **UI / rotas** — o que aparece no produto
5. **Variáveis necessárias** — chaves, URLs, secrets
6. **Checklist de ativação** — para o desenvolvedor seguir
