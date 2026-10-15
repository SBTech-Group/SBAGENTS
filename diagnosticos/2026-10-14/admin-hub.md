# Diagnóstico — Admin Hub — 2026-10-14 (revisão 2)

- Commit analisado: `2208ddd` (branch `main`, atualizado do GitHub em 2026-10-14 às 23h23), sem alterações locais em arquivos rastreados
- Revisão anterior: `ce926c5` (13 commits e 69 arquivos atrás)
- SBAGENTS: v0.3.0
- Tipo: `interno` (declarado no `CLAUDE.md`). Regras MT-02, MT-04, HUB-01 e HUB-02 não se aplicam.
- Método: verificação manual assistida com os comandos de `standards/regras.md`. Linha de base para avaliar o agente `architect`.

## Situação em 2026-10-15

Corrigidos no branch local `agente/architect/fase1` (a partir de `hml`, ainda sem push): SEC-06-a (`bf77921`), SEC-02-a (`7ea31d9`, `.gitignore`; a chave em si precisa sair da pasta), GIT-02-a (`482c869`) e DOC-01-a (`da90286`).

## Resumo

2 bloqueantes · 4 importantes · 2 cosméticos. A versão nova melhorou bastante: webhook do Asaas agora valida token, tabelas novas (Meta, pagamentos, fiscal) bloqueiam `anon` e `authenticated`, funções Meta e fiscal checam se o usuário é admin, há testes Deno e o trabalho passou a entrar por PR. Os dois bloqueantes restantes: a chave SSH solta e três funções com service role que não verificam quem chama.

## O que mudou desde a revisão 1

| Achado anterior | Situação |
|---|---|
| SEC-05-a — webhook Asaas sem validação | **Resolvido**: compara `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN` em tempo constante |
| GIT-01-a — trabalho direto na `main` | **Melhorou**: os 4 últimos merges vieram de PR (#1–#4); falta a proteção no GitHub para garantir |
| DOC-02-a — contratos não documentados | **Resolvido em parte**: `docs/CONTRATO-INTEGRACAO-PRODUTO.md` e `docs/ARQUITETURA-SBTECH.md` (trazidos para o SBAGENTS) |
| SEC-02-a, GIT-02-a, DOC-01-a, FE-01-a, FE-03-a, GIT-03-a | Continuam |

## Achados

### SEC-02-a — Chave SSH privada na raiz do repo, fora do `.gitignore`

- Regra: SEC-02 · Severidade: bloqueante · Esforço: P
- Evidência: `Adminsbtech123@` (chave privada OpenSSH) e `.pub` na raiz, não rastreados, não ignorados; `.gitignore` não tem padrão para chaves.
- Impacto: um `git add .` publica a chave.
- Proposta: mover para `%USERPROFILE%\.ssh`; adicionar `*.pem`, `*.key`, `id_*` e `Adminsbtech*` ao `.gitignore`.

### SEC-06-a — `hub-provision`, `hub-faturar` e `hub-discover-modules` usam service role sem verificar quem chama

- Regra: SEC-06 · Severidade: bloqueante (confirmar com o teste abaixo) · Esforço: P
- Evidência:
  - `supabase/functions/hub-provision/index.ts:113-157`: lê `assinatura_id` do corpo e provisiona com `SUPABASE_SERVICE_ROLE_KEY` (linha 130); nenhuma checagem de usuário.
  - `hub-faturar/index.ts:40-61`: lê `assinatura_id`, `vencimento`, `tipo` e gera cobrança com service role; nenhuma checagem.
  - `hub-discover-modules/index.ts:12-29`: idem.
  - As três não estão em `supabase/config.toml`, então dependem só do `verify_jwt` da plataforma, que aceita qualquer JWT válido, inclusive a chave anon pública que vai no bundle do Hub. O `docs/CODEX-HANDOFF.md` ainda sugere `--no-verify-jwt` como comando genérico de deploy.
  - Contraste: `hub-fiscal` e `hub-meta-manage` já fazem certo com `requireAdmin` (`_shared/meta.ts:91`).
- Impacto: quem tiver a URL do Hub e a chave anon (visíveis no navegador) consegue disparar provisionamento de tenants e emissão de cobranças.
- Teste para confirmar: `curl -X POST https://<hub>.supabase.co/functions/v1/hub-faturar -H "Authorization: Bearer <anon key>" -d '{}'`. Se a resposta for erro de validação do corpo (e não 401), a função está aberta.
- Proposta: chamar `requireAdmin(db, req)` no início das três (o padrão já existe); trocar o comando genérico do handoff por deploy sem `--no-verify-jwt`.
- Risco da correção: baixo; os botões do Hub já mandam o JWT do usuário logado (`supabase.functions.invoke`). Conferir que os operadores estão em `meta_admins` ou criar uma tabela de admins do Hub.

### GIT-02-a — Sem CI de PR

- Regra: GIT-02 · Severidade: importante · Esforço: P
- Evidência: `.github/workflows/` só tem `staging.yml` e `production.yml`; `package.json` tem `typecheck` e `lint`, mas não `test`. Os testes Deno (`_shared/meta_test.ts`, `meta-security_test.ts`) não rodam em CI.
- Proposta: `ci.yml` com checagem de segredos, `npm ci`, `typecheck`, `build` e `deno test supabase/functions/_shared`.

### DOC-01-a — Sem `AGENTS.md`

- Regra: DOC-01 · Severidade: importante · Esforço: P
- Evidência: guia em `CLAUDE.md`; o time usa Codex (`docs/CODEX-HANDOFF.md`), que lê `AGENTS.md`, não `CLAUDE.md`.
- Proposta: rodar `onboarding`; levar o conteúdo de `CLAUDE.md` e do handoff para `AGENTS.md`.

### DOC-03-a — Duas referências de arquitetura dentro do repo

- Regra: DOC-03 · Severidade: importante · Esforço: P
- Evidência: `ARCHITECTURE.md` e `PLAYBOOKS.md` (cópias antigas, ensinam Evolution API) convivem com `docs/ARQUITETURA-SBTECH.md` e `docs/CONTRATO-INTEGRACAO-PRODUTO.md` (novos, Meta via Hub, modelo `saas` no provisionamento). O `starterPack.ts` ainda empacota os arquivos antigos.
- Proposta: os quatro passam a viver no SBAGENTS (já copiados para `standards/`); o repo mantém só um link. O Starter Pack passa a usar o SBAGENTS.

### FE-01-a — Módulo temporário dentro do Hub

- Regra: FE-01 (escopo de módulo) · Severidade: importante · Esforço: M
- Evidência: `src/modules/australia-whv/` ("Módulo TEMPORÁRIO Austrália WHV — descartável"), função `hub-australia-whv-monitor`, migrations 0018–0019.
- Proposta: definir data de remoção ou mover para o repo `australia`.

### FE-03-a — Cores fixas

- Regra: FE-03 · Severidade: cosmético · Esforço: M
- Evidência: 15 arquivos `.tsx` com hex (eram 20); `src/modules/whatsapp/meta-whatsapp.css` novo com 13 cores fixas fora dos tokens.
- Proposta: migrar para tokens quando as telas forem mexidas.

### GIT-03-a — Artefatos na raiz

- Regra: GIT-03 · Severidade: cosmético · Esforço: P
- Evidência: `ss_01_initial.png`, `e2e-test.mjs`, pasta `mnt/` não rastreados.

## Fora das regras

- RLS: as 26 tabelas têm RLS. As 11 tabelas novas de Meta, pagamentos e fiscal ligam RLS num laço `execute format(...)` e revogam `anon`/`authenticated`, o que é correto para dados que só a service role acessa. (A primeira passada do script não via o laço; a regra MT-01 foi ajustada.)
- `docs/CODEX-HANDOFF.md` aponta o repo oficial do ArenaHub como `SBTech-Group/Arena-Hub-HML`. A pasta local `ArenaHub - HML` aponta para `Correa-Gui/Arena-Hub-HML`, que o próprio handoff diz não ser o de deploy. O diagnóstico do ArenaHub foi feito nessa cópia.
- O handoff cita IDs de projeto Supabase e do app Meta; não são segredos, mas o arquivo é um bom lugar para a regra "nunca colar token aqui".

## Perguntas

1. Quem são os operadores do Hub: todos estão em `meta_admins`, ou precisa de uma tabela de admins do Hub para o SEC-06-a?
2. O módulo Austrália WHV tem data para sair?
