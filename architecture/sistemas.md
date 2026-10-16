# Mapa de sistemas

O **Admin Hub** é o centro: vende, provisiona, cobra e media as integrações externas (WhatsApp Meta, Asaas, fiscal). Cada produto tem seu próprio Supabase e expõe Edge Functions que o Hub chama com token por produto. Produtos nunca acessam o banco do Hub nem o de outro produto.

Levantado em 2026-10-14 a partir dos repos em `C:\Projetos\SB TECH`, com o Admin Hub em `2208ddd`. Linhas marcadas "a confirmar" foram inferidas de nomes de funções.

## Sistemas

| Sistema | Pasta local | Repo oficial | Modalidade | Observação |
|---|---|---|---|---|
| Admin Hub | `Admin Hub` | `SBTech-Group/hub-admin` | interno | Supabase `zzhkigjadsfultoynmha` |
| ArenaHub | `ArenaHub - HML` | `SBTech-Group/Arena-Hub-HML` (branch `integration/sbtech-meta-onboarding`) | multi-tenant | **A pasta local aponta para `Correa-Gui/Arena-Hub-HML`, que segundo `docs/CODEX-HANDOFF.md` do Hub não é o repo de deploy.** Supabase `pdrfebbuwhsprbmafbka` |
| ArenaHub (produção) | `ArenaHub - PRD` | sem remote local | multi-tenant | a confirmar |
| ArenaHub Chatbot | `ArenaHub Chatbot - PRD` | `arthursbessa/chatbot-beach-clubs` | serviço (FastAPI) | Consome funções `chatbot-*` do ArenaHub |
| Promobot | `Promobot` | `SBTech-Group/promobot` | saas | Branch padrão `staging` |
| SB Template / Template Saas | `SB Template`, `Template Saas` | sem git | templates | Base dos templates do "Novo produto" |

Os demais diretórios em `SB TECH` ainda não foram mapeados.

## Contratos entre sistemas

| De → Para | Chamada | Autenticação | Fonte |
|---|---|---|---|
| Hub → produto | `POST /functions/v1/tenant-provision` | `Bearer {PRODUTO}_PROVISIONING_TOKEN` | `integracoes/hub.md` |
| Hub → produto | `GET /functions/v1/tenant-modules` | mesmo token | idem |
| Produto → Hub | `POST hub-register-account` (cadastro de conta `saas`) | token do produto | Promobot `src/lib/hubProvisioning.ts` |
| Produto → Hub | `hub-meta-tenant` (WhatsApp Meta da instância) | token do produto + instância provisionada | `integracoes/whatsapp-meta.md` |
| Hub → produto | `POST /functions/v1/whatsapp-webhook` (mensagens e status recebidos) | token do produto | `integracoes/whatsapp-meta.md` |
| Agendador → Hub | `hub-log-watch` (Sentinela: logs, deploy e status dos dois environments do Coolify viram cards em Tarefas) | header `x-cron-secret` ou operador do Hub | Hub `AGENTS.md` |
| Hub → Coolify | `hub-create-project` (projeto, environments, apps, deploy) e `hub-log-watch` (leitura) | tokens `COOLIFY_API_TOKEN` e `COOLIFY_READ_TOKEN` nos secrets do Hub | `guias/novo-produto.md` |
| Runner SBAGENTS → Hub | `hub-agent-events` (execuções dos agentes, Escritório) | header `x-agent-token` | `runner/README.md` |
| Meta → Hub | `hub-meta-webhook` | assinatura da Meta | Hub `docs/META-WHATSAPP.md` |
| Asaas → Hub | `hub-asaas-webhook` | header `asaas-access-token` | Hub |
| Site → Hub | `hub-public-plans` (planos públicos) | aberto, só leitura | Hub |
| Chatbot → ArenaHub | `chatbot-settings`, `chatbot-intents`, `chatbot-availability-next` | a confirmar | ArenaHub `AGENTS.md` |

A Evolution API foi removida do Hub em 2026-09 (`94e365e`). Produtos que ainda chamam a Evolution direto (Promobot) estão fora do padrão (SEC-07).

## Regra de ouro

Mudou um contrato desta tabela? O PR do lado que expõe a função precisa citar os consumidores e o PR do outro lado. Agentes devem parar e perguntar antes de alterar qualquer função listada aqui.
