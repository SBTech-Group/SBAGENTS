# Contrato padr?o de integra??o de produtos com o Hub Admin

Este contrato deve ser seguido por qualquer produto SBTech integrado ao Hub Admin.

## 1. Discovery de m?dulos

Endpoint recomendado:

```http
GET /functions/v1/tenant-modules
Authorization: Bearer <HUB_PROVISIONING_TOKEN>
```

Resposta m?nima:

```json
[
  {
    "chave": "admin",
    "label": "Painel Admin"
  }
]
```

Campos recomendados:

```json
{
  "chave": "whatsapp",
  "label": "WhatsApp oficial (Meta)",
  "descricao": "Envio e recebimento de mensagens via Meta.",
  "parent": "canais",
  "tipo": "integracao",
  "dependencias": ["admin"],
  "recursos": ["send-whatsapp", "whatsapp-webhook"]
}
```

O Hub Admin mant?m cache em `produto_modulos`, mas a fonte de verdade ? sempre o produto.

## 2. Provisionamento

Endpoint recomendado:

```http
POST /functions/v1/tenant-provision
Authorization: Bearer <HUB_PROVISIONING_TOKEN>
Content-Type: application/json
```

Payload para ambiente dedicado:

```json
{
  "slug": "cliente-demo",
  "nome": "Cliente Demo",
  "plano": "Pro",
  "modulos": ["admin", "alunos", "financeiro"],
  "admin_email": "cliente@example.com",
  "assinatura_id": "uuid",
  "config": {
    "documento": "00000000000000",
    "preco_mensal": 299,
    "ciclo": "mensal"
  }
}
```

Payload para conta em app compartilhado:

```json
{
  "modelo": "saas",
  "nome": "Cliente Demo",
  "plano": "Pro",
  "modulos": ["crm", "whatsapp"],
  "admin_email": "cliente@example.com",
  "assinatura_id": "uuid",
  "config": {
    "documento": "00000000000000"
  }
}
```

Resposta para ambiente dedicado:

```json
{
  "tenant_id": "uuid-do-produto",
  "subdomain_url": "https://cliente-demo.produto.sbtech-group.com",
  "invite_link": "https://...",
  "status": "provisioned"
}
```

Resposta para conta compartilhada:

```json
{
  "conta_ref": "cliente-demo",
  "access_url": "https://produto.sbtech-group.com/login",
  "invite_link": "https://...",
  "status": "provisioned"
}
```

## Regras obrigat?rias

- O provisionamento deve ser idempotente.
- O produto n?o deve cobrar o cliente B2B diretamente.
- O produto n?o deve armazenar secrets de provedores externos quando a integra??o puder ser mediada pelo Hub.
- O produto deve aplicar m?dulos no backend, n?o apenas esconder menu no frontend.
- O produto deve registrar o v?nculo com `assinatura_id` quando poss?vel.
- Falha de provisionamento deve retornar erro claro e n?o deixar dados duplicados.

## Integra??es transversais

Para WhatsApp Meta e integra??es semelhantes, o produto deve consumir endpoints do Hub Admin.

Fluxo recomendado:

```text
Produto ? Hub Admin ? Provedor externo
```

O produto envia apenas contexto da inst?ncia, por exemplo:

```json
{
  "produto_slug": "arena-hub",
  "tenant_ref": "cliente-demo",
  "acao": "send_message"
}
```
