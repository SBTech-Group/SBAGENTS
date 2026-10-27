# ADR 0002 — Dois branches fixos: `main` (produção) e `hml` (homologação)

- Data: 2026-10-15
- Status: substituído por 0003 (o branch de homologação é `staging`)
- Escopo: global

## Contexto

Cada repo seguia um fluxo: o padrão antigo pedia `feature/*` → `develop` → `main`; o ArenaHub usava só `main`; o Admin Hub trabalhava direto na `main`; o Promobot usa `staging`. Com agentes abrindo branches e PRs, o fluxo precisa ser o mesmo em todos e impedir que trabalho não revisado chegue a produção.

## Decisão

Todo repo tem dois branches fixos, ambos protegidos:

| Branch | Ambiente | Recebe PR de | Aprovação |
|---|---|---|---|
| `hml` | Homologação (deploy automático) | branches de trabalho (pessoas e agentes) | CI verde + 1 revisão humana |
| `main` | Produção (deploy após aprovação) | só `hml`, ou `hotfix/*` | CI verde + aprovação no environment `production` |

Branches de trabalho saem de `hml` e voltam para `hml` por PR:

- pessoas: `feature/<assunto>`, `fix/<assunto>`
- agentes: `agente/<nome-do-agente>/<assunto>` (ex.: `agente/architect/adequacao-2026-10-15`)
- urgência em produção: `hotfix/<assunto>` sai de `main`, volta para `main` por PR e, logo depois, `main` é mesclado em `hml`

Ninguém (pessoa ou agente) faz push direto em `hml` ou `main`. Agente nunca abre PR para `main`.

## Alternativas descartadas

- Só `main` com PR (como o ArenaHub fazia) — sem ambiente para validar com o cliente antes de produção.
- Nome `develop` ou `staging` — o Hub e os domínios já usam "HML" e "PRD" (`admin-hlg`, docs do Hub); `hml` mantém o mesmo vocabulário.

## Consequências

- Migração por repo: ArenaHub cria `hml` a partir da `main`; Admin Hub cria `hml` e passa o `staging.yml` de `develop` para `hml`; Promobot renomeia `staging` para `hml` e cria `main` a partir da versão em produção.
- Workflows: `staging.yml` dispara em push para `hml`; `production.yml` em push para `main` com environment `production`; `ci.yml` em PR para `hml` e `main`.
- O painel de agentes pode mostrar "PR aberto em hml" e "promovido a produção" como dois eventos distintos.
