# Integração com o Admin Hub

## Resumo

O Hub vende o produto: tem o catálogo, os planos, os clientes e as assinaturas. Quando uma assinatura é provisionada, o Hub chama o produto para criar o ambiente (multi-tenant) ou a conta (saas) do cliente, com os módulos do plano. O produto expõe duas funções (`tenant-provision` e `tenant-modules`), aplica os módulos no backend e devolve um link de convite. O e-mail de convite sai pelo Hub.

## Quando usar / quando não usar

**Use** quando o produto está ou vai entrar no catálogo do Hub e o cliente é criado a partir de uma venda.

**Não use** em produto piloto que ainda é provisionado à mão, nem em projeto exclusivo de um cliente sem venda pela casa.

## Arquitetura

```
 Operador no Hub                       Hub (Supabase zzhkigjadsfultoynmha)              Produto
 ───────────────                       ───────────────────────────────────              ───────
 Cadastra cliente, plano, assinatura ─▶ assinaturas
 Clica "Provisionar" (ConfirmModal)  ─▶ hub-provision ──Bearer <token do produto>──▶ tenant-provision
                                        │                                             cria tenant/conta,
                                        │                                             aplica módulos,
                                        │◀──────────── { invite_link, ... } ──────────  gera link de convite
                                        ├─ tenants_provisionados / saas_contas
                                        └─ e-mail de convite (Resend)
 Aba Módulos → "Sincronizar"         ─▶ hub-discover-modules ──Bearer──▶ tenant-modules (GET)
                                        └─ produto_modulos (cache)

 Produto saas, cadastro self-service:  produto ──Bearer──▶ hub-register-account
                                        └─ cria cliente + assinatura + saas_contas no Hub
```

O produto é a fonte de verdade dos módulos. O Hub guarda um cache em `produto_modulos` e o snapshot `modulos_ativos` de cada ambiente.

### As duas modalidades

| | `multi-tenant` (no Hub: `modelo = 'tenant'`) | `saas` (no Hub: `modelo = 'saas'`) |
|---|---|---|
| Exemplo | ArenaHub | Promobot |
| O que o Hub cria no produto | Um tenant com subdomínio | Uma conta no app compartilhado |
| Registro no Hub | `tenants_provisionados` (chave `tenant_slug`) | `saas_contas` (chave `conta_ref`) |
| Identificador que o produto usa com o Hub | `tenant_ref` = slug do tenant | `tenant_ref` = `conta_ref` |
| Cadastro pelo próprio usuário | Não | Sim, via `hub-register-account` |

Detalhes das modalidades: `standards/modalidades.md`.

## Cadastro do produto no Hub

Na tela **Produtos** do Hub (tabela `produtos`):

| Campo | O que pôr | Exemplo |
|---|---|---|
| `slug` | Identificador estável. É o `produto_slug` em toda chamada ao Hub | `arena-hub` |
| `modelo` | `tenant` ou `saas` | `tenant` |
| `provision_endpoint` | URL completa da `tenant-provision` do produto. **Termina em `/tenant-provision`**: o Hub troca o último trecho para achar `tenant-modules` e usa o mesmo host para entregar eventos do WhatsApp em `/functions/v1/whatsapp-webhook` | `https://<ref>.supabase.co/functions/v1/tenant-provision` |
| `provisioning_token_ref` | **Nome** do secret no Supabase do Hub que guarda o token do produto. Convenção: `<SLUG_EM_MAIÚSCULAS>_PROVISIONING_TOKEN` | `ARENAHUB_PROVISIONING_TOKEN` |
| `dominio_raiz` | Domínio dos subdomínios (multi-tenant) | `arenahub.sbtech-group.com` |
| `modulo_default` | Módulo inicial das contas criadas por `hub-register-account` (saas) | `crm` |
| `ativo` | Produto inativo recusa todas as chamadas | `true` |

## Endpoints

### No produto (o Hub chama)

| Função | Método | Autenticação | Faz |
|---|---|---|---|
| `tenant-provision` | POST | `Authorization: Bearer <HUB_PROVISIONING_TOKEN>` | Cria ou atualiza o ambiente/conta e sincroniza os módulos. Idempotente |
| `tenant-modules` | GET | Mesmo Bearer | Lista os módulos que o produto oferece |
| `whatsapp-webhook` | POST | Mesmo Bearer | Só se usar WhatsApp: recebe mensagens e status (ver `whatsapp-meta.md`) |

Corpo que o Hub envia para `tenant-provision`, **multi-tenant** (`hub-provision`, `provisionTenant`):

```json
{
  "slug": "arena-centro",
  "nome": "Arena Centro Ltda",
  "plano": "Pro",
  "modulos": ["admin", "student", "whatsapp"],
  "admin_email": "dono@arenacentro.com.br",
  "assinatura_id": "9b6f…",
  "config": { "documento": "12345678000199", "assinatura_id": "9b6f…", "preco_mensal": 299, "ciclo": "mensal" }
}
```

Resposta esperada:

```json
{ "tenant_id": "uuid-no-produto", "subdomain_url": "https://arena-centro.arenahub.sbtech-group.com",
  "invite_link": "https://…/auth/v1/verify?…&redirect_to=…/welcome", "status": "provisioned" }
```

Corpo **saas** (`hub-provision`, `provisionSaas`): igual, sem `slug` e com `"modelo": "saas"`. Resposta:

```json
{ "conta_ref": "id-da-conta-no-produto", "access_url": "https://produto.sbtech-group.com/login",
  "invite_link": "https://…", "status": "provisioned" }
```

- `invite_link` vem de `auth.admin.generateLink({ type: 'invite' })`. O produto **não envia e-mail**: o Hub envia pelo Resend.
- `invite_link: null` quando o admin já existia. O Hub então manda só um aviso de acesso.
- `status: "already_provisioned"` é aceito, mas os módulos **precisam** ser sincronizados mesmo assim (mudança de plano usa a mesma chamada).

### No Hub (o produto chama)

| Função | Quem usa | Autenticação | Faz |
|---|---|---|---|
| `hub-register-account` | Produto `saas`, no cadastro do usuário | `Authorization: Bearer <HUB_PROVISIONING_TOKEN>` | Cria ou renova cliente, assinatura e `saas_contas` |
| `hub-meta-tenant` | Produto com WhatsApp | Mesmo Bearer | Ver `whatsapp-meta.md` |
| `hub-public-plans` | Site / landing | Aberta (só leitura) | Planos publicados |

Base: `https://zzhkigjadsfultoynmha.supabase.co/functions/v1/<função>`.

`hub-register-account`, corpo:

```json
{
  "produto_slug": "promobot",
  "nome": "Maria Souza",
  "email": "maria@exemplo.com",
  "documento": "opcional",
  "telefone": "opcional",
  "plano_slug": "opcional; sem ele usa modulo_default",
  "conta_ref": "user_id no produto",
  "conta_url": "https://promobot.sbtech-group.com"
}
```

Resposta: `{ "created": true, "cliente_id", "assinatura_id", "saas_conta_id", ... }` na primeira vez; `{ "created": false, "renewed": true, ... , "modulos_ativos": [...] }` nas seguintes. Chame **do backend** (Edge Function), nunca do navegador: o token não pode ir para o bundle (SEC-01).

## Secrets e variáveis

| Nome | Onde | Valor |
|---|---|---|
| `HUB_PROVISIONING_TOKEN` | Supabase do **produto** (Edge Functions → Secrets) | Segredo longo aleatório, um por produto |
| `<SLUG>_PROVISIONING_TOKEN` (nome em `produtos.provisioning_token_ref`) | Supabase do **Hub** | O mesmo valor acima |
| `HUB_URL` ou `HUB_META_URL` | Supabase do produto, se ele chama o Hub | `https://zzhkigjadsfultoynmha.supabase.co/functions/v1/...` |
| `HUB_PRODUCT_SLUG` | Supabase do produto, se ele chama o Hub | **Igual** a `produtos.slug` no Hub |
| `PRODUCT_DOMAIN`, `PRODUCT_NAME`, `SYSTEM_ADMIN_EMAIL` | Supabase do produto | Usados pela `tenant-provision` de referência |
| `RESEND_API_KEY`, `EMAIL_FROM` | Supabase do Hub | Já configurados; o produto não precisa |

Nunca use `VITE_` para nenhum desses: tudo que começa com `VITE_` vai para o navegador.

## No produto

- Tabelas core de `standards/arquitetura.md` (`tenants`, `tenant_members`, `subscriptions`, `tenant_settings`) no multi-tenant; no saas, a tabela de contas do produto.
- Cada item de `modulos[]` vira uma linha em `subscriptions` (`module`, `active`). O backend checa o módulo antes de executar, não só o menu (HUB-01).
- Rota pública `/welcome` que recebe o convite e pede a senha.
- Superadmin da SB Tech (`is_system_admin` no `app_metadata`) criado pela `tenant-provision`.

A implementação de referência completa está abaixo, em **Implementação de referência**.

## Checklist de pronto

- [ ] `tenant-provision` e `tenant-modules` publicadas e respondendo 401 sem o Bearer.
- [ ] `HUB_PROVISIONING_TOKEN` no produto e `<SLUG>_PROVISIONING_TOKEN` no Hub, com o mesmo valor.
- [ ] Produto cadastrado no Hub com `provision_endpoint` terminando em `/tenant-provision`.
- [ ] "Sincronizar do produto" na aba Módulos traz os módulos.
- [ ] Plano de teste criado; assinatura de teste provisionada; e-mail de convite chega; `/welcome` funciona.
- [ ] Provisionar de novo o mesmo cliente não duplica nada; trocar o plano ativa e desativa os módulos certos.
- [ ] Saas: cadastro no produto aparece em **Contas em app compartilhado** no Hub.

## Erros comuns

| Mensagem | Causa | Correção |
|---|---|---|
| `Token não configurado: <REF>` (Hub) | Falta o secret `<REF>` no Supabase do Hub | Criar o secret com o nome exato de `provisioning_token_ref` |
| `Secret '<REF>' não configurado` (`hub-register-account`) | Idem | Idem |
| `Token inválido` / 401 | Valores diferentes no Hub e no produto | Gerar um valor novo e gravar nos dois |
| `Produto não encontrado ou inativo` | `produto_slug` enviado diferente de `produtos.slug`, ou produto inativo | Conferir `HUB_PRODUCT_SLUG` (ex.: o catálogo usa `arena-hub`, não `arenahub`) |
| `Produto não é modelo SaaS` | `hub-register-account` chamado por produto `tenant` | Multi-tenant é provisionado pelo Hub, não se registra |
| Módulos não sincronizam | `provision_endpoint` não termina em `/tenant-provision` | Corrigir a URL no cadastro do produto |
| Mudança de plano não muda nada no produto | `tenant-provision` retorna `already_provisioned` sem atualizar `subscriptions` | Sincronizar módulos em toda chamada |

## Fonte

- `SBTech-Group/hub-admin`: `supabase/functions/hub-provision`, `hub-discover-modules`, `hub-register-account`, `hub-public-plans`; `supabase/migrations/0002_produtos.sql`, `0013_produto_modelo_saas.sql`.
- Produto de referência multi-tenant: ArenaHub HML, `supabase/functions/tenant-provision` e `tenant-modules`.

---

# Implementação de referência

> Movida de `standards/integracoes.md` (v0.4.0). Código de exemplo; confira contra o ArenaHub HML antes de copiar.

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

O campo `modulos: string[]` do payload do Hub mapeia **diretamente** para linhas na tabela `subscriptions` do produto (`standards/arquitetura.md > Tabelas core obrigatórias`).

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
- [ ] `AGENTS.md` do produto lista a integração

