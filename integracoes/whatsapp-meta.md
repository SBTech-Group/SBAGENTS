# WhatsApp pela Meta

## Resumo

Na SB Tech, WhatsApp é **só pela API oficial da Meta (WhatsApp Cloud API)** e **sempre pelo Hub**. O Hub guarda o app da Meta, as credenciais de cada número (cifradas) e o histórico. O produto expõe para o cliente dele as telas de conexão, templates, envio e histórico, e repassa cada ação ao Hub pela função `hub-meta-tenant`. Mensagens recebidas e status de entrega chegam ao produto pela função `whatsapp-webhook` do próprio produto.

A Evolution API está **descontinuada**: as funções e secrets dela foram removidos do Hub. Produto novo não usa Evolution; produto que ainda usa migra para este guia.

## Quando usar / quando não usar

**Use** quando o cliente do produto conecta o número dele e manda ou recebe mensagens (avisos, cobrança, atendimento).

**Não use** para mensagens internas da SB Tech para o time (use e-mail) nem para disparo em massa: não há fila de envio em lote nesta versão.

## Arquitetura

```
 Navegador (admin do cliente)        Produto (Edge Functions)                 Hub                         Meta
 ────────────────────────────        ────────────────────────                 ───                         ────
 Tela WhatsApp → ação  ──JWT──▶  meta-whatsapp
                                  · valida sessão, papel admin,
                                    tenant ativo, módulo `whatsapp`
                                  · hubCall(tenant_ref, ação) ──Bearer token do produto──▶ hub-meta-tenant
                                                                                            · confere token, produto,
                                                                                              ambiente provisionado,
                                                                                              assinatura ativa
                                                                                            · meta_connections ─────▶ Graph API
                                                                                            · credencial cifrada
                                                                                              (AES-256-GCM)

 Mensagem recebida / status                                                                 hub-meta-webhook ◀── webhook Meta
                                  whatsapp-webhook ◀──Bearer token do produto─────────────── · valida X-Hub-Signature-256
                                  · grava no banco do produto                                 · grava e deduplica
                                                                                              · entrega ao produto
```

Onde fica cada dado:

| Dado | Onde | Quem lê |
|---|---|---|
| App Meta (App ID, Configuration ID, versão da Graph API) | Hub, `meta_settings` | Só o Hub |
| Token de acesso e PIN do número | Hub, `meta_credentials`, cifrados | Só funções do Hub (sem SELECT para `anon`/`authenticated`) |
| Conexão do cliente (WABA, número, status) | Hub, `meta_connections` (uma por produto + `tenant_ref`) | Hub; o produto recebe pela ação `state` |
| Templates | Hub, `meta_templates` (sincronizados com a WABA) | Produto pela ação `templates` |
| Mensagens enviadas e recebidas | Hub, `meta_messages` | Produto pela ação `messages` e pelos eventos do webhook |
| Cópia dos eventos no produto | Banco do produto (ex.: ArenaHub, RPC `receive_meta_event`) | Telas do produto |

## Endpoints

### `hub-meta-tenant` (o produto chama, sempre do backend)

```http
POST https://zzhkigjadsfultoynmha.supabase.co/functions/v1/hub-meta-tenant
Authorization: Bearer <HUB_PROVISIONING_TOKEN>
Content-Type: application/json

{ "produto_slug": "arena-hub", "tenant_ref": "arena-centro", "action": "<ação>", ...campos da ação }
```

- `produto_slug`: igual a `produtos.slug` no Hub.
- `tenant_ref`: o slug do tenant (multi-tenant) ou o `conta_ref` (saas), o mesmo que o Hub usou no provisionamento.
- O Hub recusa se o ambiente não estiver `provisioned` ou se a assinatura não estiver `ativa`.

| `action` | Campos | Resposta | Uso |
|---|---|---|---|
| `state` | — | `{ connection, config }` | Mostrar status da conexão e se o Hub está pronto (`config.ready`) |
| `start_signup` | — | `{ session_id, expires_at }` | Abrir o Embedded Signup da Meta. Sessão vale 10 min e é de uso único |
| `complete_signup` | `session_id`, `code`, `waba_id`, `phone_number_id`, `coexistence?` | `{ connection }` | Fechar a conexão com o código OAuth devolvido pela Meta |
| `retry_activation` | — | `{ connection }` | Tentar de novo a ativação do número |
| `disconnect` | — | `{ disconnected: true }` | Apaga credencial e solta o número |
| `templates` | — | `{ templates }` | Sincroniza e lista os templates da WABA |
| `create_template` | `name` (`a-z0-9_`), `category` (`UTILITY` ou `MARKETING`), `language` (`pt_BR`), `body` (até 1024, variáveis `{{1}}…`), `examples` (um por variável) | `{ template }` | Criar template; a Meta aprova depois |
| `send` | `to` (DDI+DDD, só dígitos), `idempotency_key` (até 160), e `template: { name, language: { code }, components }` **ou** `text` (até 4096) e `image_url?` (https) | `{ message_id, status }` | Enviar mensagem |
| `messages` | — | `{ messages }` (últimas 100) | Histórico |

Regras do envio, aplicadas pelo Hub:

- **Texto livre só dentro da janela de 24 h**: precisa haver mensagem recebida daquele número nas últimas 24 h. Fora disso, só template com status `APPROVED`.
- **Idempotência**: a mesma `idempotency_key` com o mesmo conteúdo devolve o envio anterior (`deduplicated: true`); com conteúdo diferente, recusa. Gere a chave a partir do fato de negócio (ex.: `lembrete:<reserva_id>:<data>`), não aleatória.
- **Timeout**: se a Meta não confirma, o status fica `unknown` e **não há reenvio automático**. Confira o histórico antes de tentar de novo.
- Um número só pode estar ligado a um cliente. Para trocar de número, `disconnect` antes.

### `whatsapp-webhook` (o Hub chama, no produto)

URL: mesmo host da `provision_endpoint` do produto, caminho fixo `/functions/v1/whatsapp-webhook`. Publicada com `verify_jwt = false`; a autenticação é o Bearer.

```http
POST https://<projeto-do-produto>.supabase.co/functions/v1/whatsapp-webhook
Authorization: Bearer <HUB_PROVISIONING_TOKEN>

{ "event_key": "in:wamid.HBg…", "type": "message", "message_id": "wamid.HBg…",
  "phone": "5511999998888", "text": "Oi, quero reservar", "timestamp": "2026-10-15T12:00:00.000Z",
  "tenant_ref": "arena-centro", "connection_id": "uuid" }

{ "event_key": "status:wamid.HBg…:delivered", "type": "status", "message_id": "wamid.HBg…",
  "status": "delivered", "error": null, "timestamp": "…", "tenant_ref": "arena-centro", "connection_id": "uuid" }
```

- Responda **2xx** só depois de gravar. Qualquer outro código faz o Hub devolver 503 à Meta, que reenvia.
- `event_key` é único: grave com upsert/ignore para não duplicar.
- Status possíveis: `sent`, `delivered`, `read`, `failed`.

## Secrets e variáveis

| Nome | Onde | Valor |
|---|---|---|
| `HUB_PROVISIONING_TOKEN` | Supabase do produto | O mesmo token do provisionamento (`hub.md`) |
| `HUB_META_URL` | Supabase do produto | `https://zzhkigjadsfultoynmha.supabase.co/functions/v1/hub-meta-tenant` |
| `HUB_PRODUCT_SLUG` | Supabase do produto | Igual a `produtos.slug` no Hub (ex.: `arena-hub`) |
| `META_APP_SECRET`, `META_ENCRYPTION_KEY`, `META_VERIFY_TOKEN` | Supabase do **Hub** | Já configurados. O produto **nunca** tem nenhuma credencial da Meta (SEC-07) |

## No produto

1. **Módulo `whatsapp`** em `tenant-modules`, com dependência de `admin`.
2. **Função `meta-whatsapp`** (proxy autenticado), como no ArenaHub HML:
   - valida o JWT do usuário com `auth.getUser`;
   - confere que ele é admin do tenant (ou dono da conta, no saas);
   - confere tenant ativo e módulos `admin` e `whatsapp` ativos em `subscriptions`;
   - aceita só as ações da tabela acima;
   - **remove** `produto_slug`, `tenant_ref` e `connection_id` do corpo recebido e põe os valores do servidor (o navegador nunca escolhe o tenant);
   - chama o Hub com `HUB_PROVISIONING_TOKEN`, timeout de 55 s.
3. **Função `whatsapp-webhook`** que valida o Bearer, acha o tenant por `tenant_ref` e grava o evento de forma idempotente.
4. **Telas**: Conexão (botão "Conectar com a Meta", que usa o Embedded Signup com o `config` devolvido em `state`), Templates, Enviar e Histórico. O login da Meta só abre em HTTPS.
5. Envios automáticos do produto (lembretes, cobrança) chamam a ação `send` a partir do backend com template aprovado e `idempotency_key` de negócio.

## Checklist de pronto

- [ ] Produto provisionado no Hub com assinatura ativa e módulo `whatsapp` no plano.
- [ ] `HUB_META_URL`, `HUB_PRODUCT_SLUG` e `HUB_PROVISIONING_TOKEN` configurados no produto; nenhum segredo com `VITE_`.
- [ ] Domínio HTTPS do painel cadastrado no app Meta (pedir ao responsável pelo app no Hub).
- [ ] Conexão de um número de teste concluída; `state` mostra `connected`.
- [ ] Template criado e aprovado; envio por template funciona; resposta do contato chega no histórico do produto.
- [ ] Envio com a mesma `idempotency_key` não duplica.
- [ ] Usuário de outro tenant recebe 403 ao tentar a ação.

## Erros comuns

| Mensagem | Causa | Correção |
|---|---|---|
| `Integração com o Hub Admin ainda não configurada.` (produto) | Falta `HUB_META_URL` ou `HUB_PROVISIONING_TOKEN` | Configurar os secrets do produto |
| `Credencial do produto inválida.` | Token diferente entre produto e Hub, ou `produtos.provisioning_token_ref` aponta para secret inexistente | Gravar o mesmo valor nos dois lados |
| `Cliente ainda não provisionado neste produto.` | `tenant_ref` errado ou ambiente não `provisioned` no Hub | Usar o slug/conta do provisionamento; provisionar pelo Hub |
| `Assinatura inativa.` | Assinatura cancelada ou vencida no Hub | Regularizar no Hub |
| `Configure o Login do Facebook para Empresas no Hub Admin.` | `meta_settings` incompleto ou secrets da Meta ausentes no Hub | Configurar na tela WhatsApp do Hub |
| `Fora da janela de 24 horas: envie um template aprovado pela Meta.` | Texto livre sem mensagem recebida nas últimas 24 h | Usar template |
| `Selecione um template aprovado pela Meta.` | Template inexistente ou ainda `PENDING` | Aguardar aprovação ou corrigir nome/idioma |
| `Sessão utilizada ou expirada.` | Passaram 10 min ou a sessão já foi usada | Chamar `start_signup` de novo |
| `Este número já está vinculado a outro cliente.` | Número ligado em outra conexão | Desconectar na outra conta |
| Hub responde 503 para a Meta | `whatsapp-webhook` do produto falhou | Ver logs da função no produto; a Meta reenviará |

## Ainda não implementado

- Renovação automática do token da Meta (o token do Embedded Signup vale 60 dias; hoje é preciso reconectar).
- Fila de envio em massa.
- App Meta publicado: enquanto não estiver, a Meta só entrega webhooks de teste do painel.

## Fonte

- `SBTech-Group/hub-admin`: `supabase/functions/hub-meta-tenant`, `hub-meta-webhook`, `hub-meta-manage`, `_shared/meta.ts`, `_shared/meta-security.ts`; `supabase/migrations/20260924000100_meta_whatsapp.sql`; `docs/META-WHATSAPP.md`.
- Produto de referência: ArenaHub HML, `supabase/functions/meta-whatsapp`, `whatsapp-webhook`, `_shared/meta-hub.ts`.
