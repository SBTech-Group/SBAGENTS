# Changelog do playbook

## 0.5.0 — 2026-10-15

- Novo `integracoes/`: um guia por integração no mesmo formato (resumo, arquitetura, endpoints, secrets, no produto, checklist, erros comuns, fonte), conferido contra o código do Hub e do ArenaHub HML:
  - `hub.md` (provisionamento, módulos, cadastro saas, cadastro do produto no Hub; inclui a implementação de referência que estava em `standards/integracoes.md`);
  - `whatsapp-meta.md` (ações de `hub-meta-tenant`, entrega em `whatsapp-webhook`, janela de 24 h, idempotência);
  - `pagamentos.md` (B2B no Hub com Asaas; consumidor final no produto com Mercado Pago);
  - `fiscal.md` (NFS-e manual no Hub) e `email.md` (Resend).
- `standards/integracoes.md` e `standards/contrato-integracao-produto.md` viram páginas de redirecionamento. A cópia do contrato tinha os acentos corrompidos.
- Novo agente `integrador` (modos `plano` e `implementacao`).
- Agentes passam a declarar os modos em `agents/<agente>/runner.json`; o runner não precisa de código novo para agente novo. Novo `agents/README.md` com o passo a passo para criar um agente.
- Novo `guias/novo-produto.md`: do zero ao primeiro cliente provisionado.
- Workflow "Rodar agente": agente `integrador`, modos `plano`/`implementacao` e campo `integracao`. PR mostra o valor "equivalente na API" em vez de "custo".

## 0.4.0 — 2026-10-15

- ADR 0002: dois branches fixos, `hml` (homologação) e `main` (produção). Agentes trabalham em `agente/<nome>/<assunto>` com PR para `hml`. Regra GIT-01, template de `AGENTS.md`, prompt do architect e seção de branches de `arquitetura.md` atualizados.

## 0.3.0 — 2026-10-14

- Incorporados do Admin Hub (`2208ddd`): `standards/arquitetura-hub.md` (conceitos de cliente, produto, instância, integração) e `standards/contrato-integracao-produto.md` (contrato de provisionamento, inclusive `modelo: saas`).
- Modalidades alinhadas aos nomes do Hub: `saas` = conta em app compartilhado (`produtos.modelo = 'saas'`), `multi-tenant` = ambiente dedicado (`'tenant'`).
- Novas regras SEC-06 (função com service role autentica o chamador) e SEC-07 (integração externa via Hub). MT-01 aceita RLS com `revoke` quando só a service role acessa. HUB-01 vale também para `saas`.
- Seção Evolution de `integracoes.md` marcada como obsoleta.

## 0.2.0 — 2026-10-14

- Duas modalidades oficiais de produto: `saas` (um tenant, isolamento por usuário) e `multi-tenant` (um tenant por empresa). Novo `standards/modalidades.md`; tipos renomeados em regras, templates e schema.
- Identidade visual SB Tech (FE-02) passa a valer para todos os produtos, sem desvio aceito; produtos fora dela migram gradualmente.

## 0.1.0 — 2026-10-14

- Playbook criado a partir do padrão informal que vivia copiado no `SB Template` e nos produtos (`ARCHITECTURE.md`, `PLAYBOOKS.md`, prompts de bootstrap).
- `standards/arquitetura.md` e `standards/integracoes.md` são cópias fiéis dos originais do `SB Template`; o conteúdo não mudou.
- Novo: `standards/regras.md` com regras de ID estável para o agente arquiteto verificar, incluindo SEC-05 (webhook público valida remetente), surgida no diagnóstico do Admin Hub.
- Novo: agentes `architect` e `onboarding`.
- Novo: diagnósticos de linha de base de Admin Hub, ArenaHub HML e Promobot.
