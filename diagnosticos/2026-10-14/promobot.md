# Diagnóstico — Promobot — 2026-10-14

- Commit analisado: `45a0bf4` (branch `staging`) + working tree local
- SBAGENTS: v0.1.0
- Tipo: `saas` (inferido do `CLAUDE.md`, que descreve isolamento por `user_id`; não há `AGENTS.md`)
- Método: verificação manual assistida com os comandos de `standards/regras.md`. Linha de base para avaliar o agente `architect`.

## Resumo

2 bloqueantes · 7 importantes · 3 cosméticos. Corrigir primeiro os segredos: duas chaves de servidor estão no bundle público do frontend, e um arquivo com 11 segredos de Edge Functions está fora do `.gitignore`.

## Achados

### SEC-01-a — Token do Hub e chave da Evolution no bundle público

- Regra: SEC-01 · Severidade: bloqueante · Esforço: M
- Evidência:
  - `src/lib/hubProvisioning.ts:2` e `src/lib/hubEvolution.ts:5` leem `VITE_HUB_PROVISIONING_TOKEN`
  - `src/lib/hubEvolution.ts:9`, `src/modules/instancias/hooks/useInstancias.ts:242` leem `VITE_EVOLUTION_API_KEY` e chamam a Evolution direto do navegador (`DELETE /instance/delete/...`)
  - Os dois valores do `.env` local foram encontrados em `dist/assets/index-*.js`
- Impacto: quem abrir o app extrai o token de provisionamento (cadastra contas no Hub em nome do Promobot) e a chave da Evolution (controla instâncias de WhatsApp do servidor).
- Proposta: (0) pelo padrão atual (SEC-07), WhatsApp passa pelo Hub (`hub-meta-tenant`); a Evolution foi removida do Hub, então o Promobot é o último consumidor direto; (1) rotacionar as duas chaves; (2) criar Edge Functions `hub-register` e `evolution-proxy` no Supabase do Promobot que leem os segredos do ambiente e validam o usuário pelo JWT; (3) remover as variáveis `VITE_` correspondentes do `.env.example`.
- Risco da correção: fluxo de login (auto-cadastro no Hub) e gestão de instâncias; testar os dois de ponta a ponta.

### SEC-02-a — `supabase/.env.functions` com segredos fora do `.gitignore`

- Regra: SEC-02 · Severidade: bloqueante · Esforço: P
- Evidência: `git check-ignore supabase/.env.functions` → não ignorado; arquivo não rastreado com 11 variáveis preenchidas, incluindo `SUPABASE_SERVICE_ROLE_KEY`, `ML_CLIENT_SECRET`, `EVOLUTION_API_KEY`, `GEMINI_API_KEY`, `IG_ACCESS_TOKEN`. Não está no histórico do git.
- Impacto: um `git add .` publica todos esses segredos no GitHub.
- Proposta: adicionar `supabase/.env*` (e `.env.*` sem o sufixo `.local`) ao `.gitignore`; manter só um `supabase/.env.functions.example` sem valores.
- Risco da correção: nenhum.

### MT-01-a — `system_config` com RLS e sem policy

- Regra: MT-01 · Severidade: importante · Esforço: P
- Evidência: migrations criam `system_config` e habilitam RLS, mas nenhuma `create policy` a referencia.
- Impacto: só a service role lê. Se for intencional (config lida só por Edge Functions), falta registrar; se não, telas que leem essa tabela falham silenciosamente.
- Proposta: confirmar o uso; se for só servidor, comentar na migration e listar em "Pontos sensíveis".

### MT-03-a — `schedule_config` e `system_config` sem `user_id`

- Regra: MT-03 · Severidade: importante · Esforço: M
- Evidência: 15 de 17 tabelas têm `user_id`; faltam `schedule_config` e `system_config`.
- Impacto: se `schedule_config` guarda horário de disparo por usuário, todos compartilham a mesma configuração.
- Proposta: confirmar se são configs globais do sistema. Se forem por usuário, migration nova adicionando `user_id` + policy.

### DOC-01-a — Sem `AGENTS.md`

- Regra: DOC-01 · Severidade: importante · Esforço: P
- Evidência: só `CLAUDE.md` na raiz. O Codex não lê `CLAUDE.md`.
- Proposta: rodar o agente `onboarding`; mover o conteúdo do `CLAUDE.md` para `AGENTS.md` e deixar `@AGENTS.md` no `CLAUDE.md`.

### DOC-02-a — Modalidade `saas` não declarada e com resíduos de multi-tenant

- Regra: DOC-02 · Severidade: importante · Esforço: M
- Evidência: `CLAUDE.md` descreve isolamento por `user_id` (modalidade `saas`, ver `standards/modalidades.md`), mas o repo mantém `0001_core.sql` com tabelas de tenant, `TenantProvider` como wrapper e a Edge Function `tenant-provision` (`supabase/functions/tenant-provision/index.ts:16` trabalha com `tenant_id`). O `CLAUDE.md` ainda lista "Cobrança B2B via Asaas", que pela arquitetura é do Hub.
- Impacto: agentes e devs não sabem qual modelo vale; `tenant-provision` pode criar dados num modelo que o app não usa.
- Proposta: declarar `Tipo: saas` no `AGENTS.md` e decidir o que fica dos resíduos (`tenant-provision`, tabelas core), conforme a resposta em `modalidades.md > A confirmar`.

### GIT-01-a — Commits direto na linha principal

- Regra: GIT-01 · Severidade: importante · Esforço: P
- Evidência: nos últimos 100 commits de `staging` (branch padrão), 76 são diretos e 3 são merges de PR. Não há `develop` nem `main` locais.
- Proposta: decidir o fluxo (ver Perguntas), proteger o branch padrão no GitHub e exigir PR.

### GIT-02-a — Sem CI de PR

- Regra: GIT-02 · Severidade: importante · Esforço: P
- Evidência: único workflow é `.github/workflows/sync-server-branch.yml`; `package.json` não tem script `test` nem `lint`.
- Proposta: workflow `ci.yml` com `npm ci`, `npm run typecheck`, `npm run build` (base: o `ci.yml` do ArenaHub HML, que já inclui checagem de arquivos sensíveis).

### TST-01-a — Sem testes

- Regra: TST-01 (aplicada a single-user: isolamento por `user_id`) · Severidade: importante · Esforço: M
- Evidência: nenhum `*.test.*` ou `*.spec.*` fora de `node_modules`.
- Proposta: primeiro teste: usuário A não lê `links_convertidos`/`disparos` do usuário B.

### GIT-03-a — Artefatos na raiz

- Regra: GIT-03 · Severidade: cosmético · Esforço: P
- Evidência: `dev.err.log`, `dev.out.log`, `dev2.*.log`, `local_changes_backup.diff`, `local_changes_notes.md`, `output/`, `Chatbot (1)/`, `.playwright-mcp/` não rastreados e não ignorados.
- Proposta: `.gitignore` para `*.log`, `output/`, `.playwright-mcp/`; mover notas para `docs/`.

### FE-02-a — `sb-tech-base.css` diferente do template

- Regra: FE-02 · Severidade: cosmético · Esforço: P
- Evidência: `src/styles/sb-tech-base.css` difere do template em 5 linhas, todas comentários removidos. Valores idênticos.
- Proposta: copiar o arquivo do template de volta.

### FE-04-a — `strokeWidth` fora do padrão

- Regra: FE-04 · Severidade: cosmético · Esforço: P
- Evidência: usos de `strokeWidth` 2.2, 2.5 e 3; nenhum 1.75 encontrado por grep. 3 arquivos `.tsx` com emoji.
- Proposta: revisar junto com a próxima mudança visual, não em PR isolado.

## Fora das regras

- O `CLAUDE.md` tem uma regra muito boa: a lista de 7 pontos a tocar ao adicionar plataforma afiliada. Vale manter no `AGENTS.md`.
- `local_changes_notes.md` descreve um bug não resolvido (500 para `admin@admin.com`). Virar issue.

## Perguntas

1. ~~Promobot fica single-user?~~ Respondido em 2026-10-14: sim, modalidade `saas`. Falta decidir se `tenant-provision` e as tabelas core saem.
2. Qual o fluxo de branches: `staging` → `main`? Existe `main` no GitHub?
3. A build em `dist/` com as chaves foi publicada? Se foi, a rotação é imediata.
