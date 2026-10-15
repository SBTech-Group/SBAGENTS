# Índice do padrão

Leia só o que a tarefa pede.

| Assunto | Arquivo | Seção |
|---|---|---|
| O que o arquiteto verifica (lista fechada) | `regras.md` | todas |
| Stack padrão | `arquitetura.md` | Stack padrão |
| Multi-tenant, RLS, `current_tenant_id()` | `arquitetura.md` | Multi-tenancy |
| Superadmin `admin@sbtech-group.com` | `arquitetura.md` | Superadmin do sistema |
| Módulos, router dinâmico, pastas de `src/` | `arquitetura.md` | Módulos |
| Identidade visual (duas camadas) | `arquitetura.md` | Identidade visual |
| Branches, CI/CD, Coolify | `arquitetura.md` | CI/CD e branches |
| Segredos e variáveis | `arquitetura.md` | Segredos e variáveis |
| Provisionamento pelo Hub (`tenant-provision`, `tenant-modules`, `/welcome`, cadastro saas) | `../integracoes/hub.md` | — |
| WhatsApp (Meta, sempre pelo Hub) | `../integracoes/whatsapp-meta.md` | — |
| Cobrança B2B (Hub/Asaas) e do consumidor final (Mercado Pago) | `../integracoes/pagamentos.md` | — |
| Nota fiscal | `../integracoes/fiscal.md` | — |
| E-mail (convite, transacional) | `../integracoes/email.md` | — |
| Criar um produto novo, passo a passo | `../guias/novo-produto.md` | — |
| Criar ou mudar um agente | `../agents/README.md` | — |
| Conceitos do Hub (cliente, produto, plano, instância, integração) | `arquitetura-hub.md` | — |
| Modalidades `saas` e `multi-tenant` | `modalidades.md` | — |
| Como os sistemas se conectam | `../architecture/sistemas.md` | — |

## Tipos de repositório

As regras dizem a quais tipos se aplicam. O `AGENTS.md` de cada produto declara o tipo. As duas modalidades de produto estão em `modalidades.md`.

| Tipo | Exemplo | Isolamento |
|---|---|---|
| `multi-tenant` | ArenaHub | `tenant_id` + RLS + subdomínio por empresa |
| `saas` | Promobot | Um tenant; `user_id = auth.uid()` + RLS, domínio único |
| `interno` | Admin Hub | Sem tenant; acesso só do time SB Tech |
| `servico` | ArenaHub Chatbot (FastAPI) | Fora do escopo das regras de frontend |
