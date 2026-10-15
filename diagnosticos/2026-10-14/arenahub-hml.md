# Diagnóstico — ArenaHub HML — 2026-10-14

- Commit analisado: `58ffbf0` (branch `main`) + working tree local (101 arquivos modificados não commitados)
- SBAGENTS: v0.1.0
- Tipo: `multi-tenant` (declarado no `AGENTS.md`)
- Método: verificação manual assistida com os comandos de `standards/regras.md`. Linha de base para avaliar o agente `architect`.

## Resumo

2 bloqueantes · 6 importantes · 2 cosméticos. É o repo mais aderente na parte de dados e Hub: tabelas core, `current_tenant_id()`, `tenant-provision`, `tenant-modules`, `/welcome`, RLS em todas as 34 tabelas e um CI com checagem de segredos. Os dois bloqueantes são de isolamento: uma tabela aberta para acesso anônimo e uma configuração global que admins de qualquer arena podem alterar.

## Achados

### MT-06-a — `chatbot_sessions` aberta para leitura e escrita anônima

- Regra: MT-06 (e MT-02) · Severidade: bloqueante · Esforço: M
- Evidência: `supabase/migrations/20260417000001_add_chatbot_sessions.sql:30` — policy `chatbot_sessions_anon_all` `FOR ALL TO anon USING (true) WITH CHECK (true)`. A tabela guarda `phone`, `user_name`, `display_name`, `flow_data` e não tem `tenant_id`.
- Impacto: qualquer pessoa com a chave pública do Supabase (que está no frontend) lê e altera as conversas de todas as arenas, com telefone e nome. Exposição de dado pessoal (LGPD).
- Proposta: o backend do chatbot (FastAPI, servidor) passa a usar uma chave de servidor ou uma Edge Function dedicada; migration nova remove a policy `anon`, adiciona `tenant_id` e policy por tenant.
- Risco da correção: quebra o chatbot em produção se feito antes de ajustar o backend. Coordenar com o repo `ArenaHub Chatbot - PRD` (contrato externo).

### MT-06-b — `system_config` é global, mas guarda dados de arena e aceita escrita de qualquer admin

- Regra: MT-06 · Severidade: bloqueante · Esforço: G
- Evidência: `system_config` não tem `tenant_id`; policies `auth_read_system_config` (qualquer autenticado lê) e `admin_write_system_config` / `Admins can manage system config` (`has_role(auth.uid(), 'admin')`). `has_role` checa o papel no tenant atual, então o admin de qualquer arena passa. O `AGENTS.md` diz que a tabela guarda horários, preços, day use e nome da arena; `src/` tem 32 referências.
- Impacto: com mais de uma arena, todas compartilham preço, horário e nome; o admin de uma arena altera a configuração de todas.
- Proposta: migrar os campos por arena para `tenant_settings.config` (o `AGENTS.md` já chama `system_config` de legado); enquanto isso, restringir a escrita a `is_system_admin()`.
- Risco da correção: o chatbot lê esses campos via `chatbot-settings` (contrato externo). Migrar mantendo o formato de resposta.

### MT-05-a — Dois nomes para superadmin

- Regra: MT-05 · Severidade: importante · Esforço: P
- Evidência: `src/contexts/AuthContext.tsx:99-100` aceita `is_system_admin` ou `is_super_admin`; `:180` e `src/core/tenant/useSubscriptions.ts:14` só `is_super_admin`; migrations usam `is_system_admin()` (2 arquivos) e `is_super_admin` (1). O `tenant-provision` padrão grava `is_system_admin`.
- Impacto: o superadmin criado pelo Hub (`is_system_admin`) não recebe todos os módulos em `useSubscriptions`.
- Proposta: padronizar em `is_system_admin` no código e no SQL; manter leitura de `is_super_admin` só até migrar os usuários existentes.

### FE-02-a — Sem as camadas de identidade SB Tech

- Regra: FE-02 · Severidade: importante · Esforço: G
- Evidência: não existe `src/styles/`; `src/index.css` define paleta própria "Ocean/Sunset"; nenhuma ocorrência de `sb-gold` ou `Manrope`.
- Impacto: o produto não herda a identidade da casa; agentes que seguem `arquitetura.md` vão propor tokens que não existem aqui.
- Proposta: migração gradual para a identidade SB Tech (decidido em 2026-10-14: todos os produtos devem seguir). Primeiro passo: adicionar `src/styles/sb-tech-base.css` e `tokens.css` sem trocar telas; depois migrar tela por tela.

### GIT-01-a — Fluxo de branches diverge do padrão sem ADR, e há commits diretos

- Regra: GIT-01 · Severidade: importante · Esforço: P
- Evidência: `AGENTS.md` e `CLAUDE.md` mandam PR direto para `main` e proíbem `develop`; o padrão é `feature/*` → `develop` → `main`. Nos últimos 100 commits de `main`, 23 são merges de PR e 77 diretos (o mais recente direto: `98c4b4c`, 2026-08-27). `staging.yml` só roda manualmente.
- Proposta: se o fluxo só com `main` for o desejado (é mais simples com agentes), ADR global trocando o padrão; e proteção de `main` no GitHub para barrar push direto.

### DOC-01-a — `CLAUDE.md` duplica e repete o `AGENTS.md`

- Regra: DOC-01 · Severidade: importante · Esforço: P
- Evidência: `CLAUDE.md` começa com `@AGENTS.md` (correto), mas repete três vezes a instrução de seguir o `AGENTS.md` e duplica módulos, integrações e variáveis.
- Proposta: deixar `@AGENTS.md` + regras do graphify e do Claude Code.

### DOC-02-a — `AGENTS.md` sem versão do playbook e sem "Desvios aceitos"

- Regra: DOC-02 · Severidade: importante · Esforço: P
- Evidência: o `AGENTS.md` é o mais completo dos três repos (pontos sensíveis, contratos externos, fonte de verdade), mas não declara tipo, versão do SBAGENTS nem desvios.
- Proposta: acrescentar as três seções do template; os desvios são exatamente FE-02-a e GIT-01-a, se aceitos.

### TST-01-a — Sem teste de isolamento entre tenants nem de `tenant-provision`

- Regra: TST-01 · Severidade: importante · Esforço: M
- Evidência: há 2 testes unitários (`src/test/tenant-host.test.ts`, `whatsapp-payload.test.ts`), 2 specs e2e de diagnóstico e `supabase/functions/_shared/meta-hub_test.ts`. Nenhum testa RLS entre tenants ou a idempotência do provisionamento.
- Proposta: teste SQL ou e2e: usuário do tenant A tenta ler `bookings` do tenant B; chamar `tenant-provision` duas vezes com o mesmo slug.

### DOC-03-a — Cópias locais divergentes de `ARCHITECTURE.md` e `PLAYBOOKS.md`

- Regra: DOC-03 · Severidade: cosmético · Esforço: P
- Evidência: hashes diferentes do SBAGENTS (`ARCHITECTURE.md` com 493 linhas, original com 627; `PLAYBOOKS.md` e `PROMPT_INTEGRAR_HUB.md` também divergem).
- Proposta: antes de apagar, levar para o SBAGENTS o que for melhor na versão do ArenaHub (ex.: WhatsApp oficial Meta via Hub, que não está no playbook).

### GIT-03-a — Artefatos e trabalho não commitado

- Regra: GIT-03 · Severidade: cosmético · Esforço: P
- Evidência: `node_modules - Copia/`, `dev.log`, `relatorios/`, `trilha-de-testes-completa.pdf` na raiz; 101 arquivos modificados em `main` sem commit.
- Proposta: commitar ou descartar o trabalho em andamento num branch antes de qualquer adequação por agente; ignorar ou remover os artefatos.

## Fora das regras

- O `ci.yml` com "Check tracked secrets" é bom e deve virar padrão em `standards/` para todos os produtos.
- Há branches com nome de agente (`CEO`, `DBA`, `Design`, `Bug-Hunter`, `Bug-Fixer`, auditorias). Vale registrar quais agentes já existem e o que cada um faz, para trazer os bons para o SBAGENTS.
- WhatsApp oficial (Meta) via Hub é uma integração que o playbook ainda não descreve.

## Perguntas

1. ~~Paleta própria ou identidade SB Tech?~~ Respondido em 2026-10-14: migrar para a identidade SB Tech.
2. O fluxo só com `main` vale para todos os produtos? Se sim, eu atualizo o padrão.
3. Quem mantém o backend do chatbot, para coordenar MT-06-a?
