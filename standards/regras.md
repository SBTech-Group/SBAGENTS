# Regras verificáveis

Lista fechada do que o agente arquiteto verifica. Cada regra tem ID estável, severidade padrão, a quais tipos de repo se aplica e como verificar. Achado sem regra aqui é **sugestão**, não violação.

Severidades: **bloqueante** (risco de segurança, vazamento entre tenants ou perda de dados: corrigir antes de qualquer feature nova) · **importante** (diverge do padrão de forma que custa manutenção ou confunde agentes) · **cosmético**.

Tipos: `mt` = multi-tenant · `saas` = saas (um tenant, isolamento por usuário) · `int` = interno · `todos`. Modalidades descritas em `modalidades.md`.

## Segurança

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| SEC-01 | Nenhum segredo em variável `VITE_*`. Tudo que começa com `VITE_` vai para o bundle público. Tokens do Hub, chaves da Evolution, service role, chaves de API privadas ficam em Edge Function. | bloqueante | todos | `grep -rnoE "VITE_[A-Z_]*(TOKEN|SECRET|SERVICE_ROLE|API_KEY|PRIVATE)" src .env.example` |
| SEC-02 | `.env*` (exceto `.env.example`), chaves (`*.pem`, `*.key`, `id_*`, arquivos `-----BEGIN ... PRIVATE KEY-----`) e dumps não ficam na pasta do repo sem estar no `.gitignore`, e nunca são versionados. | bloqueante | todos | `git ls-files`, `git status --short`, `grep -rl "PRIVATE KEY" --exclude-dir=node_modules .` |
| SEC-03 | `SUPABASE_SERVICE_ROLE_KEY` nunca em código de `src/`. | bloqueante | todos | `grep -rn "SERVICE_ROLE" src` (texto de documentação gerada não conta) |
| SEC-04 | Chamada a sistema de outro produto ou ao Hub, com token, só a partir de Edge Function. | bloqueante | todos | procurar `fetch(` para URLs do Hub/Evolution em `src/` |
| SEC-05 | Edge Function pública (`--no-verify-jwt`, webhooks) valida um segredo ou assinatura do remetente antes de alterar dados. | bloqueante | todos | `supabase/functions/*webhook*`: procurar leitura de header de segredo |
| SEC-06 | Edge Function que usa `SUPABASE_SERVICE_ROLE_KEY` autentica o chamador dentro da função (`auth.getUser` + papel, token de produto ou segredo de webhook). `verify_jwt` sozinho não basta: a chave anon pública é um JWT válido. | bloqueante | todos | para cada função com service role, procurar `getUser`/`requireAdmin`/comparação de token |
| SEC-07 | Produto não guarda segredo de provedor externo quando o Hub media a integração (WhatsApp Meta, Asaas…): chama o Hub, que chama o provedor. | importante | mt, saas | `contrato-integracao-produto.md`; procurar chaves de provedor no `.env.example` do produto |

## Dados e isolamento

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| MT-01 | Toda tabela tem RLS habilitado e pelo menos uma policy — ou RLS habilitado com `revoke all` de `anon`/`authenticated` quando só a service role acessa. | bloqueante | todos | migrations: `create table` × `enable row level security` × `create policy`. Atenção a laços `execute format('alter table ... enable row level security')` |
| MT-02 | Tabela de domínio tem `tenant_id uuid not null references tenants`, índice em `tenant_id` e policy com `current_tenant_id()`. | bloqueante | mt | migrations |
| MT-03 | Tabela de domínio tem `user_id` e policy `user_id = auth.uid()`. | bloqueante | saas | migrations |
| MT-04 | Tabelas core existem: `tenants`, `tenant_members`, `subscriptions`, `tenant_settings`, e as funções `current_tenant_id()` e `is_system_admin()`. | importante | mt | migrations |
| MT-05 | Superadmin é identificado só por `app_metadata.is_system_admin`. Outros nomes (`is_super_admin`) são legado a migrar. | importante | mt, saas | `grep -rn "is_super_admin" src supabase` |
| MT-06 | Configuração que varia por tenant fica em `tenant_settings`, não em tabela global sem `tenant_id`. Tabela global legível por qualquer autenticado não pode conter dado de um tenant. Escrita em tabela global só por `is_system_admin()`. | bloqueante | mt | policies de tabelas sem `tenant_id` |
| MT-07 | Migration aplicada nunca é editada; correção é migration nova. | importante | todos | `git log --follow` em migrations antigas; diff de arquivos de migration modificados |

## Integração com o Hub

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| HUB-01 | Produto no catálogo do Hub tem Edge Functions `tenant-provision` (idempotente, sincroniza módulos; em `saas` aceita `modelo: "saas"` e responde `conta_ref`) e `tenant-modules`, conforme `contrato-integracao-produto.md`. | importante | mt, saas | `supabase/functions/` + leitura do código |
| HUB-02 | Rota pública `/welcome` fora do guard de auth. | importante | mt | router |
| HUB-03 | Produto não grava cobrança B2B (é do Hub). | importante | mt, saas | tabelas `faturas_saas`, integração Asaas no produto |

## Frontend

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| FE-01 | Estrutura `src/core/`, `src/modules/<id>/index.ts` exportando `{ id, routes, menuItems }`, `src/app/router.tsx`. | importante | mt, saas, int | árvore de `src/` |
| FE-02 | Identidade em duas camadas: `src/styles/sb-tech-base.css` idêntico ao do template (`templates/repo/styles/`) e `tokens.css` do produto. | importante | todos | comparar hash do arquivo com o template |
| FE-03 | Cor só por token Tailwind (`bg-primary`, `text-money`…). Sem hex em `.tsx`. | cosmético | todos | `grep -rlE "#[0-9a-fA-F]{6}" src --include=*.tsx` |
| FE-04 | Ícones Lucide com `strokeWidth={1.75}`. Sem emoji na UI (exceto bolhas de chat de IA). | cosmético | todos | grep |

## Git, CI e higiene

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| GIT-01 | Dois branches fixos e protegidos: `hml` (homologação) e `main` (produção). Trabalho sai de `hml` e volta por PR; `main` só recebe PR de `hml` ou `hotfix/*`. Branch de agente: `agente/<nome>/<assunto>`, nunca com PR para `main`. Ver ADR 0002. | importante | todos | `git branch -a`; `git log --first-parent` (commits sem merge); proteção de branch no GitHub |
| GIT-02 | Workflow de CI em PR roda `typecheck`, `build` e `test`. | importante | todos | `.github/workflows/` |
| GIT-03 | Raiz do repo sem artefatos: logs, diffs, dumps, screenshots, `node_modules - Copia`. Estão no `.gitignore` ou removidos. | cosmético | todos | `ls`, `git status --short` |
| TST-01 | Existem testes automatizados para isolamento (tenant A não lê tenant B) e para `tenant-provision` (idempotência). | importante | mt | `*.test.ts`, `*.spec.ts`, `e2e/` |

## Documentação para agentes

| ID | Regra | Sev. | Tipos | Como verificar |
|---|---|---|---|---|
| DOC-01 | `AGENTS.md` na raiz é a fonte; `CLAUDE.md` contém `@AGENTS.md` e só complementos específicos do Claude Code, sem duplicar texto. | importante | todos | ler os dois |
| DOC-02 | `AGENTS.md` declara: tipo do repo, versão do SBAGENTS seguida, módulos, pontos sensíveis e a seção "Desvios aceitos" (cada desvio com ADR). | importante | todos | ler |
| DOC-03 | Sem cópia local de `ARCHITECTURE.md` / `PLAYBOOKS.md`; o produto referencia o SBAGENTS. Durante a transição, cópia só se idêntica à do SBAGENTS. | cosmético | todos | comparar hash com `standards/` |
