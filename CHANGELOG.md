# Changelog do playbook

## 0.6.2 — 2026-10-16

- Correção de texto: `standards/arquitetura.md` documenta o desenho do Coolify (projeto por produto, environments `homologação`/`produção`, servidor, branch e domínio de cada) e a Sentinela. O repo precisa ter `hml` e `main` antes do primeiro deploy.
- `templates/repo/AGENTS.md` ganha a seção "Ambientes" e deixa de fixar a versão do SBAGENTS; `architecture/sistemas.md` lista `hub-log-watch` e o Hub → Coolify. Nenhuma regra nova.

## 0.6.1 — 2026-10-16

- Correção de texto: o "Novo produto" do Hub passa a criar também o projeto no Coolify (dois environments, um app em cada, sem deploy; Admin Hub PR #16). `guias/novo-produto.md` (passo 5) e `architecture/novo-projeto-pelo-hub.md` deixam de dizer que o Coolify é manual.
- Documenta a Sentinela (`hub-log-watch`, sem IA): erros de log, deploy falho e app parado dos dois ambientes viram cards em Tarefas do Hub. Nenhuma regra nova em `standards/regras.md`.

## 0.6.0 — 2026-10-15

- Fase 5: **Novo produto** no Hub cria o repositório a partir de `template-multitenant` ou `template-saas` (Admin Hub, PR #12). `architecture/novo-projeto-pelo-hub.md` passa a "implementado"; `guias/novo-produto.md` atualizado.
- Templates de código da casa: identidade SB Tech, `tenant-provision`/`tenant-modules` no contrato de `integracoes/hub.md`, `/welcome`, CI de PR, testes; saas com `contas`/`conta_modulos` e cadastro direto (`conta-registrar` + `hub-register-account`).
- `templates/repo/tailwind.config.ts` ganha os tokens dos componentes shadcn (card, popover, secondary, accent, destructive, input, ring, sidebar), como no Hub.

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
