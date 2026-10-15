# Modalidades de produto

Todo produto da SB Tech é de uma de duas modalidades. A modalidade é escolhida ao criar o produto no Hub, declarada no `AGENTS.md` do repo e decide quais regras de `regras.md` valem.

Os nomes seguem o que o Hub Admin já usa (`produtos.modelo` e `arquitetura-hub.md`). As duas modalidades são SaaS; o que muda é se o cliente recebe um ambiente dedicado ou uma conta num app compartilhado.

| | `saas` | `multi-tenant` |
|---|---|---|
| Nome na UI do Hub | Conta em app compartilhado | Ambiente dedicado |
| Valor em `produtos.modelo` (Hub) | `saas` | `tenant` |
| Registro da instância no Hub | `saas_contas` | `tenants_provisionados` |
| Para quem | Clientes que usam o mesmo app, cada um com sua conta | Empresas que precisam de espaço próprio, com seus usuários |
| Exemplo | Promobot | ArenaHub (inclui o app mobile dos alunos) |
| Tenants no produto | Um só | Um por empresa |
| Isolamento de dados | `user_id = auth.uid()` + RLS | `tenant_id = current_tenant_id()` + RLS |
| Endereço | Domínio único (`produto.sbtech-group.com/login`) | Subdomínio por empresa (`cliente.produto.sbtech-group.com`) |
| Provisionamento pelo Hub | `tenant-provision` com `"modelo": "saas"`, responde `conta_ref` e `access_url` | `tenant-provision` com `slug`, responde `tenant_id` e `subdomain_url`; convite em `/welcome` |
| Regras específicas | MT-03 | MT-02, MT-04, MT-06, HUB-02, TST-01 |

As duas compartilham: stack, identidade visual SB Tech (FE-02, obrigatória em todos), `tenant-modules`, integrações via Hub (SEC-07), segurança, CI e documentação para agentes. Contrato completo em `contrato-integracao-produto.md`.

Uma terceira categoria, `interno`, cobre sistemas da própria SB Tech que não são vendidos (Admin Hub).

## Como escolher

- O cliente é uma empresa que precisa separar os dados dela dos de outras empresas, ter seus próprios usuários ou endereço próprio? → `multi-tenant`.
- Cada cliente só precisa da própria conta dentro de um app comum? → `saas`.
- Na dúvida: trocar de `saas` para `multi-tenant` depois exige migrar todas as tabelas para `tenant_id`.

## A confirmar

- Produto `saas` mantém as tabelas core (`tenants`, `subscriptions`…) com um tenant único, ou não as cria? Hoje o Promobot mantém.
