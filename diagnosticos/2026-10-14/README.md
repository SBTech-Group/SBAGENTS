# Diagnósticos de linha de base — 2026-10-14

Seis bloqueantes em três repos, todos de segurança ou isolamento. Nenhum exige reescrever arquitetura: são chaves no lugar errado, policies abertas e um webhook sem validação. O ArenaHub HML é de fato o mais aderente na parte de dados e Hub; o Promobot é o mais distante.

Feito por verificação manual assistida com as regras de `standards/regras.md` (SBAGENTS v0.1.0), sem alterar nenhum repo. Serve de gabarito para avaliar o agente `architect` (ver `agents/architect/evals/`).

| Repo | Tipo | Bloqueantes | Importantes | Cosméticos | Relatório |
|---|---|---|---|---|---|
| Admin Hub (rev. 2, `2208ddd`) | interno | 2 | 4 | 2 | [admin-hub.md](admin-hub.md) |
| ArenaHub HML | multi-tenant | 2 | 6 | 2 | [arenahub-hml.md](arenahub-hml.md) |
| Promobot | saas | 2 | 7 | 3 | [promobot.md](promobot.md) |

**Atenção:** o diagnóstico do ArenaHub foi feito na pasta local, que aponta para `Correa-Gui/Arena-Hub-HML`. O repo oficial é `SBTech-Group/Arena-Hub-HML` (branch `integration/sbtech-meta-onboarding`). Refazer na cópia oficial.

## Ordem sugerida

| # | Achado | Repo | Por quê primeiro | Esforço |
|---|---|---|---|---|
| 1 | SEC-01-a — token do Hub e chave Evolution no bundle | Promobot | Segredo possivelmente já público; exige rotação | M |
| 2 | MT-06-a — `chatbot_sessions` aberta para anônimo | ArenaHub HML | Telefones e conversas de todas as arenas legíveis com a chave pública | M |
| 3 | SEC-02-a — chave SSH na raiz | Admin Hub | Um `git add .` publica | P |
| 4 | SEC-02-a — `.env.functions` fora do `.gitignore` | Promobot | Um `git add .` publica 11 segredos | P |
| 5 | SEC-06-a — `hub-provision`/`hub-faturar` sem checar quem chama | Admin Hub | Provisionamento e cobrança disparáveis com a chave anon | P |
| 6 | MT-06-b — `system_config` global com escrita de qualquer admin | ArenaHub HML | Vira problema com a segunda arena | G |

Depois dos bloqueantes: CI com checagem de segredos nos três repos (copiar o `ci.yml` do ArenaHub HML) e `AGENTS.md` no Admin Hub e no Promobot (agente `onboarding`).

## Decisões pendentes que mudam o padrão

1. **Fluxo de branches.** O padrão diz `feature/*` → `develop` → `main`; o ArenaHub usa só `main` com PR; o Admin Hub trabalha direto na `main`; o Promobot usa `staging`. Escolher um e atualizar `standards/arquitetura.md`.
2. ~~Identidade visual~~ — decidido: todos os produtos migram para a identidade SB Tech.
3. ~~Modelo do Promobot~~ — decidido: modalidade `saas` (`standards/modalidades.md`). Falta decidir o destino dos resíduos de tenant.

## Antes de pedir adequação a um agente

ArenaHub HML (101 arquivos) e Promobot (13) têm trabalho não commitado; o Admin Hub está limpo desde a atualização. O agente para se a working tree não estiver limpa. Commite ou guarde esse trabalho num branch primeiro.
