# Novo projeto pelo Hub — especificação

Status: **implementado** em 2026-10-15 (Admin Hub, PR #12: `hub-create-project`, tela Novo produto). Templates: `SBTech-Group/template-multitenant` e `template-saas`. Abaixo, a especificação original; o que mudou na implementação está em "Como ficou".

## Como ficou

- GitHub App próprio, **SBTech-Provisioner** (Administration e Contents em escrita), separado do SBTech-Agents. Secrets no Hub: `GITHUB_PROVISIONER_APP_ID`, `GITHUB_PROVISIONER_PRIVATE_KEY`.
- O Hub preenche os marcadores `{{...}}` dos arquivos do template (`AGENTS.md`, `README.md`, `.env.example`, `src/config/produto.ts`) e gera `supabase/functions/_shared/modules.ts`, num único commit.
- Os agentes não são copiados para o repo: o produto aponta para o SBAGENTS (DOC-03) e os agentes rodam pelo workflow "Rodar agente".
- Proteção de branch em repo privado depende do plano do GitHub; sem ela, o Hub registra um aviso.
- Colunas em `produtos`: `repo_url`, `repo_status`, `repo_etapa`, `repo_erro`, `repo_avisos`, `playbook_version`, `integracoes`.

## Objetivo

No Hub, "Novo produto" + escolha da modalidade (`saas` ou `multi-tenant`) entrega, em um clique, um repositório no GitHub da SB Tech já com código base, `AGENTS.md` preenchido, agentes, CI e proteção de branch, e o produto registrado no Hub.

## O que já existe e será aproveitado

- `src/lib/starterPack.ts` + `src/modules/produtos/StarterPackModal.tsx`: geram hoje um **zip** com `ARCHITECTURE.md`, `PLAYBOOKS.md`, prompts, `CLAUDE.md` preenchido com os módulos e `.env.example`. A geração do conteúdo continua; muda o destino (repo no GitHub em vez de zip).
- Coluna `produtos.modelo` (`saas` | `tenant`), view `produto_instancias` e o contrato `docs/CONTRATO-INTEGRACAO-PRODUTO.md`: o Hub já distingue as duas modalidades.
- `Template Saas` (pasta local, sem git): template de código com `src/core/tenant`, `0001_core.sql` e page-packs. É a base do template `multi-tenant`.

## Fluxo

1. Operador preenche no Hub: nome, slug, descrição, **modalidade**, módulos iniciais, integrações (WhatsApp, Mercado Pago).
2. Botão "Criar produto" abre `ConfirmModal` (regra do Hub para ações com efeito externo).
3. Edge Function `hub-create-project`:
   1. cria o repo `SBTech-Group/<slug>` a partir do template da modalidade (API do GitHub "create repository using a template");
   2. faz um commit com os arquivos gerados: `AGENTS.md` (do `SBAGENTS/templates/repo`, com tipo, módulos, integrações e versão do SBAGENTS), `CLAUDE.md`, `.env.example`, `.claude/agents/*.md` (cópia dos agentes do SBAGENTS, marcada com a versão);
   3. aplica proteção na `main` (PR obrigatório, CI verde);
   4. grava em `produtos`: `modelo` (`saas` ou `tenant`, coluna que já existe), `repo_url`, `playbook_version`, status `criado`;
   5. registra em `eventos_auditoria`.
4. A tela mostra o link do repo e o checklist do que continua manual.

## O que continua manual (por enquanto)

Projetos Supabase (staging e produção), serviços no Coolify, DNS e segredos. São os passos da Fase 5 do `PROMPT_NOVO_PRODUTO.md`. Podem ser automatizados depois pelas APIs do Supabase e do Coolify.

## Pré-requisitos

| Item | Por quê | Quem |
|---|---|---|
| ~~Admin Hub atualizado com o GitHub~~ | Feito em 2026-10-14 | — |
| GitHub App instalado na organização `SBTech-Group` com permissão de criar repos e administrar branch protection | Credencial dedicada, nunca token pessoal | Guilherme |
| Dois repos de template na organização: `template-multitenant` (a partir do `Template Saas`) e `template-saas` (variante com `user_id`) | A modalidade escolhe o template | Agente + revisão |
| Migration no Hub: colunas `repo_url` e `playbook_version` em `produtos` (`modelo` já existe); `provision_endpoint` e `dominio_raiz` deixam de ser obrigatórios na criação (só existem depois do Supabase/DNS) | Hoje são `not null` | Agente |
| SBAGENTS no GitHub da organização | A Edge Function lê templates e agentes de lá | Guilherme |

## Fora do escopo desta entrega

Rodar o agente automaticamente no repo novo, Trello, Slack e o painel de agentes. Entram nas fases seguintes do roadmap.
