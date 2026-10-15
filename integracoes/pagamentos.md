# Pagamentos

## Resumo

Existem dois tipos de cobrança na SB Tech, com donos diferentes:

| Quem cobra quem | Dono | Provedor | O produto faz |
|---|---|---|---|
| **SB Tech → cliente** (mensalidade do produto, B2B) | Admin Hub | Asaas | **Nada.** Não cria fatura, não guarda chave do Asaas (HUB-03, SEC-07) |
| **Cliente → consumidor final dele** (aluno paga a arena, por exemplo) | Produto | Mercado Pago | Cria a cobrança e recebe o webhook, com a conta do cliente |

Se a dúvida é "isso é cobrança da SB Tech?", a resposta decide tudo: sendo, é do Hub.

## Quando usar / quando não usar

**B2B (Hub)**: sempre que um cliente paga a SB Tech por um produto. O operador gera a fatura no Hub.

**Consumidor final (produto)**: quando o produto tem um módulo financeiro que o cliente usa para cobrar os clientes dele.

**Não use** o Asaas da SB Tech para cobrar consumidor final, nem crie tabela de fatura B2B no produto.

## Arquitetura

### B2B, pelo Hub

```
 Operador no Hub                     Hub                                       Asaas
 ───────────────                     ───                                       ─────
 Faturamento → "Gerar cobrança" ─▶ hub-faturar ─────────────────────────────▶ /customers (cria se não existir)
   (assinatura, vencimento,          · grava faturas (asaas_cobranca_id,      /payments  (BOLETO | PIX | UNDEFINED)
    boleto | pix | cartão)             URLs de boleto, PIX e checkout)        /payments/{id}/pixQrCode
                                     · eventos_auditoria
                                   hub-asaas-webhook ◀──────────────────────── webhook (header asaas-access-token)
                                     · payment_events (uma vez por evento)
                                     · faturas.status: paga | vencida | cancelada
                                   hub-check-vencimentos ◀── agendador diário (x-cron-secret)
                                     · aviso antes do fim e corte da assinatura anual
```

- Cartão: o Hub cria a cobrança como `UNDEFINED` e manda o cliente para o **checkout hospedado do Asaas**. O Hub nunca vê número, CVV ou validade.
- Toda alteração de fatura passa por `payment_events` antes (deduplicado por `provider_event_id`).
- `payment_provider_accounts` registra a conta que recebe: `asaas` + `owner_type = sbtech` para o B2B.

### Consumidor final, no produto

```
 Usuário final (navegador)         Produto (Edge Functions)                     Mercado Pago
 ─────────────────────────         ────────────────────────                     ────────────
 "Pagar com PIX" ──JWT──▶  create-pix-payment
                            · valida sessão e dono do item
                            · POST /v1/payments ─────────────────────────────▶  cria PIX (expira em 30 min)
                              (X-Idempotency-Key, external_reference,
                               notification_url)
                            ◀── qr_code, qr_code_base64 ───────────────────────
                           mercadopago-webhook ◀──────────────────────────────── notificação
                            · valida x-signature (HMAC-SHA256)
                            · consulta o pagamento e atualiza o item
```

## Endpoints

### B2B (só o Hub usa)

| Função | Quem chama | Autenticação | Corpo |
|---|---|---|---|
| `hub-faturar` | Tela Faturamento do Hub | Operador (`meta_admins`) | `{ assinatura_id, vencimento: "AAAA-MM-DD", tipo?: "boleto" \| "pix" \| "cartao", descricao? }` |
| `hub-asaas-webhook` | Asaas | Header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN` | Payload do Asaas. Trata `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` (→ `paga`), `PAYMENT_OVERDUE` (→ `vencida`), `PAYMENT_DELETED` (→ `cancelada`) |
| `hub-check-vencimentos` | Agendador (pg_cron, diário) | Header `x-cron-secret` = `HUB_CRON_SECRET` | `{}` |

Produto não chama nenhuma delas.

### Consumidor final (no produto)

| Função | Quem chama | Autenticação | Faz |
|---|---|---|---|
| `create-pix-payment` (nome livre) | Frontend do produto | JWT do usuário + checagem de dono | Cria o pagamento no Mercado Pago |
| `mercadopago-webhook` | Mercado Pago | Assinatura `x-signature` (`verify_jwt = false`) | Atualiza o item pago |

Mercado Pago, criação de PIX:

```http
POST https://api.mercadopago.com/v1/payments
Authorization: Bearer <access token da conta que recebe>
X-Idempotency-Key: booking-<id>

{ "transaction_amount": 50.0, "payment_method_id": "pix", "description": "Reserva de quadra 2026-10-20",
  "date_of_expiration": "<agora + 30 min>", "external_reference": "<tenant_id>:<id do item>",
  "notification_url": "https://<projeto>.supabase.co/functions/v1/mercadopago-webhook",
  "payer": { "email": "<e-mail do pagador>" } }
```

Validação do webhook: o header `x-signature` traz `ts=…,v1=…`. Monte `id:<data.id da query>;request-id:<x-request-id>;ts:<ts>;`, calcule HMAC-SHA256 com `MERCADOPAGO_WEBHOOK_SECRET` e compare com `v1` em tempo constante. Depois **consulte** `GET /v1/payments/{id}` antes de marcar como pago; não confie só no corpo da notificação.

## Secrets e variáveis

| Nome | Onde | Uso |
|---|---|---|
| `ASAAS_API_KEY` | Supabase do Hub | Chave da conta Asaas da SB Tech |
| `ASAAS_BASE_URL` | Supabase do Hub | `https://api.asaas.com/v3` em produção. **Sem ela, o Hub usa o sandbox** |
| `ASAAS_WEBHOOK_TOKEN` | Supabase do Hub **e** painel do Asaas (configuração de Webhook) | Mesmo valor nos dois |
| `HUB_CRON_SECRET` | Supabase do Hub e o agendamento pg_cron | Protege `hub-check-vencimentos` |
| `MERCADOPAGO_ACCESS_TOKEN` | Supabase do produto | Hoje um por produto (ver "Ainda não implementado") |
| `MERCADOPAGO_WEBHOOK_SECRET` | Supabase do produto e painel do Mercado Pago | Valida `x-signature` |

## No produto

**B2B**: nada a implementar. Não crie `faturas`, `invoices_saas` nem integração Asaas. O estado da assinatura é do Hub; o produto respeita os módulos que o Hub envia no provisionamento.

**Consumidor final**:

1. Tabela do que é cobrado (reserva, mensalidade do aluno) com `tenant_id`, `payment_id`, `status` e RLS por tenant.
2. Função de criação com `X-Idempotency-Key` derivada do item e `external_reference` que identifica **tenant e item**.
3. Webhook com validação de assinatura e consulta ao pagamento antes de alterar o item.
4. Nenhum token do Mercado Pago no frontend nem em `VITE_*`.

## Checklist de pronto

- [ ] B2B: nenhuma tabela de cobrança B2B ou chave Asaas no produto.
- [ ] Consumidor final: PIX gerado em ambiente de teste e QR exibido.
- [ ] Webhook recusa chamada sem `x-signature` válida (401) e aceita a do Mercado Pago.
- [ ] Pagar o PIX de teste muda o item para pago uma única vez, mesmo com notificação repetida.
- [ ] `external_reference` permite achar o tenant do pagamento.

## Erros comuns

| Sintoma | Causa | Correção |
|---|---|---|
| Fatura B2B gerada no sandbox em produção | `ASAAS_BASE_URL` ausente no Hub | Configurar a URL de produção |
| `Webhook não autorizado` no Hub | Token do painel Asaas diferente de `ASAAS_WEBHOOK_TOKEN` | Gravar o mesmo valor nos dois |
| Webhook do Asaas responde `ignored: true` | Cobrança criada fora do Hub | Gerar cobranças B2B só pelo Hub |
| PIX duplicado para o mesmo item | Falta `X-Idempotency-Key` | Usar chave derivada do item |
| Pagamento não acha o tenant | `external_reference` só com o ID do item | Incluir o tenant |

## Ainda não implementado

- **Conta Mercado Pago por cliente.** O desenho do Hub prevê que cada cliente conecte a própria conta por OAuth, com a referência registrada em `payment_provider_accounts` (`provider = mercadopago`, `owner_type = tenant`) e o token num secret gerenciado, nunca em tabela. Hoje o ArenaHub usa **um único** `MERCADOPAGO_ACCESS_TOKEN` para todas as arenas, ou seja, todo pagamento cai numa conta só. Produto novo deve seguir o desenho por cliente; o ArenaHub precisa migrar.
- Mercado Pago no B2B: `hub-faturar` só aceita `asaas`.
- Aviso genérico ao produto quando a assinatura vence ou é cancelada. Hoje `hub-check-vencimentos` chama um webhook específico do monitor Austrália (`/australia-access`), que não é contrato para outros produtos.

## Fonte

- `SBTech-Group/hub-admin`: `supabase/functions/hub-faturar`, `hub-asaas-webhook`, `hub-check-vencimentos`; `supabase/migrations/0007_faturamento.sql`, `20261003182328_payments_fiscal_core.sql`; `docs/PAYMENTS-FISCAL.md`.
- Produto de referência (consumidor final): ArenaHub HML, `supabase/functions/create-pix-payment`, `mercadopago-webhook`.
