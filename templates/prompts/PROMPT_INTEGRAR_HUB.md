# Prompt — Implementar Integração com Hub Admin

> Cole este prompt no Claude Code **dentro do repositório do produto** que precisa integrar com o Hub Admin.
> Pré-requisito: produto já usa o template SaaS B2B da casa (tem `ARCHITECTURE.md`, `PLAYBOOKS.md`, tabelas core).

---

## Contexto

Este produto precisa ser provisionado pelo Hub Admin da SB Tech. O Hub é o painel centralizado que gerencia clientes, assinaturas e provisionamento de todos os produtos da casa.

Quando um operador do Hub cria uma assinatura para um cliente, o Hub chama automaticamente a Edge Function `tenant-provision` deste produto para criar o tenant, configurar os módulos contratados e convidar o admin.

Sua tarefa é implementar esta integração em cinco frentes:

1. **Supabase Auth** — configurar Site URL + Redirect URLs no Dashboard do produto
2. **Edge Function `tenant-modules`** — discovery de módulos (Hub importa automaticamente)
3. **Edge Function `tenant-provision`** — provisionamento e sincronização de módulos
4. **Gating de módulos** — bloquear módulos inativos no frontend e no banco
5. **Variáveis de ambiente** — documentar o que precisa ser configurado

> **Atenção (Supabase Auth):** antes de qualquer deploy, configure no Dashboard do produto:
> - `Authentication → URL Configuration → Site URL` → URL de produção do produto
> - `Authentication → URL Configuration → Redirect URLs` → adicionar `https://*.SEU_DOMINIO.com.br/**`
>
> Sem isso, os links gerados por `generateLink` em `tenant-provision` redirecionarão para localhost mesmo em produção.

---

## O que você precisa saber antes de começar

### Payload que o Hub envia ao provisionar

```json
{
  "slug": "novocliente",
  "nome": "Nome do Cliente LTDA",
  "plano": "pro",
  "modulos": ["admin", "student"],
  "admin_email": "admin@novocliente.com.br",
  "assinatura_id": "uuid-do-hub",
  "config": {
    "documento": "12.345.678/0001-99",
    "preco_mensal": 490.00,
    "ciclo": "mensal"
  }
}
```

`modulos[]` contém as chaves dos módulos que o cliente contratou — **mesmas chaves** que `tenant-modules` retorna. O produto deve ativar somente estes módulos para o tenant.

### Comportamento esperado de `tenant-provision`

- **Tenant novo**: criar tenant, settings, subscriptions dos módulos, convidar admin.
- **Tenant existente (mesmo slug)**: **sincronizar módulos** — desativar removidos, ativar novos, atualizar plano. Não duplicar nem retornar erro.
- **Idempotente**: qualquer número de chamadas com o mesmo slug produz o mesmo estado.

---

## Fase 1 — Leitura

Leia:
1. `PLAYBOOKS.md` seção **Integração com Hub** — contrato completo e implementação de referência
2. `ARCHITECTURE.md` seção **Módulos** — gating via router dinâmico e RLS
3. `ARCHITECTURE.md` seção **Tabelas core obrigatórias** — tabela `subscriptions`

Confirme que entendeu o contrato antes de implementar. Não precisa me mostrar resumo.

---

## Fase 2 — Levantamento

Me faça **todas** as perguntas de uma vez:

1. Quais módulos existem neste produto (`src/modules/`)? Liste com chave (nome da pasta) e label legível.
2. Algum módulo deve ser sempre ativo, sem gating (ex: `dashboard`, `auth`, `admin`)? Listar.
3. A tabela `subscriptions` já existe (migration já rodou)?
4. O `useSubscriptions()` hook já está implementado? Onde (`src/core/tenant/` ou outro local)?
5. O router (`src/app/router.tsx` ou equivalente) já filtra rotas por módulos ativos, ou está hardcoded?
6. `admin_email` pode vir nulo? Se sim, confirmar que skip do invite é aceitável.

---

## Fase 3 — Plano

Após o levantamento, me apresente o plano em formato de lista:

- Arquivos a criar
- Arquivos a editar (com o que muda)
- Migrations necessárias
- Variáveis de ambiente a adicionar

Aguarde minha aprovação antes de implementar.

---

## Fase 4 — Implementação

### 4a. Edge Function `tenant-modules` (discovery)

O Hub chama este endpoint para importar automaticamente os módulos disponíveis. Sem ele, o operador teria que cadastrar as chaves manualmente no Hub.

```typescript
// supabase/functions/tenant-modules/index.ts
const HUB_TOKEN = Deno.env.get('HUB_PROVISIONING_TOKEN')!

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${HUB_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Lista de módulos deste produto — manter em sync com src/modules/
  const modules = [
    { chave: 'admin',   label: 'Painel Admin' },
    { chave: 'student', label: 'Área do Aluno' },
    { chave: 'teacher', label: 'Área do Professor' },
    // adicionar/remover conforme os módulos reais do produto
  ]

  return Response.json(modules)
})
```

> As chaves aqui **devem coincidir** com os `id` dos módulos em `src/modules/`.
> O Hub deriva a URL trocando o sufixo: `.../tenant-provision` → `.../tenant-modules`.

### 4b. Edge Function `tenant-provision`

Implementação de referência completa em `PLAYBOOKS.md > Edge Function tenant-provision`. Pontos críticos:

- Bloco `if (existing)` **deve sincronizar subscriptions**, não apenas retornar `already_provisioned`
- Persistir `assinatura_id` e `config` em `tenant_settings.config` (JSONB)
- Upsert em `tenant_settings` (não insert) para idempotência
- Usar `generateLink` + Resend para email (não `inviteUserByEmail` — template limitado ao plano Pro do Supabase)

### 4b.1 Email via Resend (obrigatório)

`inviteUserByEmail` envia email pelo Supabase com template fixo (customizável só no plano Pro). Use `generateLink` + Resend:

```typescript
// Gera link sem enviar email
const { data: linkData } = await supabase.auth.admin.generateLink({
  type: 'invite',
  email: admin_email,
  options: {
    data: { tenant_id, app_name: PRODUCT_NAME, workspace: nome },
    redirectTo: `${subdomain_url}/welcome`,
  },
})

// Envia email customizado via Resend
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'SB Tech <noreply@sbtech-group.com>',
    to: admin_email,
    subject: `Você foi convidado para o ${PRODUCT_NAME}`,
    html: buildInviteHtml(linkData.properties.action_link, PRODUCT_NAME, nome),
  }),
})
```

Variáveis novas:
```bash
RESEND_API_KEY=re_xxxx           # criar em resend.com
EMAIL_FROM=SB Tech <noreply@sbtech-group.com>
PRODUCT_NAME=NomeDoProduto
```

### 4c. Hook `useSubscriptions`

```typescript
// src/core/tenant/useSubscriptions.ts
export function useSubscriptions() {
  const { tenant } = useTenant()
  const { data } = useQuery({
    queryKey: ['subscriptions', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('module')
        .eq('tenant_id', tenant!.id)
        .eq('active', true)
      if (error) throw error
      return data.map(r => r.module) as string[]
    },
  })
  return { activeModules: data ?? [] }
}
```

**Remover qualquer fallback para `system_config.active_modules`** — com Hub integrado, `subscriptions` é fonte de verdade. Fallback cria tenant com tudo liberado acidentalmente.

### 4d. Router dinâmico

```typescript
// src/app/router.tsx
export function AppRouter() {
  const { activeModules } = useSubscriptions()
  const routes = ALL_MODULES
    .filter(m => m.alwaysActive || activeModules.includes(m.id))
    .flatMap(m => m.routes)
  return (
    <Routes>
      {routes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
    </Routes>
  )
}
```

Módulos com `alwaysActive: true` ficam ativos independente de subscriptions.

### 4e. Superadmin do sistema

`tenant-provision` deve garantir que `admin@sbtech-group.com` existe no auth deste produto e está adicionado como `superadmin` em **todo tenant** provisionado. Implementação de referência: função `ensureSystemAdmin` em `PLAYBOOKS.md`.

Variável obrigatória: `SYSTEM_ADMIN_EMAIL=admin@sbtech-group.com`

### 4f. Helper `is_system_admin()` + RLS

```sql
-- Migration: criar helper
create or replace function public.is_system_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean,
    false
  );
$$;
```

Todas as policies de tenant isolation devem incluir `OR public.is_system_admin()`:

```sql
-- Tabelas core
create policy "tenant_isolation" on public.<entidade>
  for all using (
    tenant_id = public.current_tenant_id()
    or public.is_system_admin()
  );

-- Tabelas de módulos opcionais
create policy "tenant_modulo_isolation" on public.<entidade>
  for all using (
    (
      tenant_id = public.current_tenant_id()
      and exists (
        select 1 from public.subscriptions
        where tenant_id = public.current_tenant_id()
          and module = '<chave_do_modulo>'
          and active = true
      )
    )
    or public.is_system_admin()
  );
```

### 4g. Router com bypass de superadmin

```typescript
const { activeModules, isSystemAdmin } = useSubscriptions()
// isSystemAdmin = (auth.jwt().app_metadata.is_system_admin === true)

const routes = ALL_MODULES
  .filter(m => isSystemAdmin || m.alwaysActive || activeModules.includes(m.id))
  .flatMap(m => m.routes)
```

---

## Checklist final

- [ ] **Supabase Auth — Site URL** configurado para a URL de produção do produto (ex: `https://arenahub.sbtech-group.com`)
- [ ] **Supabase Auth — Redirect URLs** inclui `https://*.<SEU_PRODUCT_DOMAIN>/**` — deve ser o mesmo domínio de `PRODUCT_DOMAIN`. Sem isso, o `redirectTo` do `generateLink` é ignorado e o admin vai parar no domínio raiz em vez do subdomínio do tenant
- [ ] Rota pública `/welcome` implementada — detecta token de invite no hash, exibe form de senha, chama `supabase.auth.updateUser({ password })` (ver `ARCHITECTURE.md > Invite flow`)
- [ ] `tenant-modules` deployada e retornando array correto
- [ ] `tenant-provision` deployada com sync de módulos no re-provisionamento
- [ ] Variáveis em `.env.example`: `HUB_PROVISIONING_TOKEN`, `PRODUCT_DOMAIN`
- [ ] `useSubscriptions()` sem fallback para `system_config`
- [ ] Router filtra rotas por `activeModules`
- [ ] RLS das tabelas de módulos opcionais verifica `subscriptions.active = true`
- [ ] `CLAUDE.md` atualizado: `[x] Hub` em **Integrações ativas**
- [ ] Variáveis em `.env.example`: `HUB_PROVISIONING_TOKEN`, `PRODUCT_DOMAIN`, `SYSTEM_ADMIN_EMAIL`
- [ ] `admin@sbtech-group.com` adicionado como `superadmin` em todo tenant (via `ensureSystemAdmin`)
- [ ] Helper `is_system_admin()` criado via migration
- [ ] Todas as RLS policies incluem `OR public.is_system_admin()`
- [ ] `useSubscriptions()` retorna `isSystemAdmin` + router libera todos módulos para superadmin
- [ ] Teste: criar tenant via Hub → verificar tenant + subscriptions + admin@sbtech-group.com criados
- [ ] Teste de re-provisionamento: mudar plano no Hub → subscriptions sincronizadas
- [ ] Teste de discovery: Hub clica "Sincronizar do produto" → módulos importados corretamente
- [ ] Teste superadmin: login com admin@sbtech-group.com → acessa todos módulos sem restrição

---

## Contrato de resposta de `tenant-provision`

```json
// Tenant criado (HTTP 200)
{
  "tenant_id": "uuid",
  "subdomain_url": "https://slug.produto.sbtech-group.com",
  "invite_link": "https://[ref].supabase.co/auth/v1/verify?token=...&type=invite&redirect_to=...",
  "admin_invite_sent_to": "email@cliente.com.br",
  "status": "provisioned"
}

// Tenant já existia, módulos sincronizados (HTTP 200)
{
  "tenant_id": "uuid",
  "subdomain_url": "https://slug.produto.sbtech-group.com",
  "invite_link": null,
  "status": "already_provisioned"
}

// Erro (HTTP 4xx/5xx)
{ "error": "mensagem descritiva" }
```

> `invite_link` é o que o Hub usa para enviar o e-mail de convite via Resend. O produto gera o link (`generateLink`) mas **não envia o e-mail**. Se for re-provisionamento ou admin já existente, retornar `invite_link: null` — Hub não reenvia.

Qualquer status não-2xx é interpretado como falha pelo Hub → tenant marcado como `failed` para retry manual.
