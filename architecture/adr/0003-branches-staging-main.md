# ADR 0003 — Branches `staging` (homologação) e `main` (produção)

- Data: 2026-10-27
- Status: aceito
- Escopo: global

## Contexto

O ADR 0002 escolheu `hml` como branch de homologação, mas os repos ativos (Admin Hub, ArenaHub, Promobot) e os apps de homologação no Coolify ficaram em `staging`, e o runner de agentes (`agent-run.yml`) quebrava ao procurar `hml`. A conta GitHub é gratuita: repo privado não tem proteção de branch. Cada sistema tem por enquanto um único projeto Supabase, de homologação.

## Decisão

Dois branches fixos: `staging` (homologação) e `main` (produção), com o mesmo fluxo do ADR 0002 trocando `hml` por `staging`:

- trabalho em `agente/<nome>/<assunto>`, `feature/*`, `fix/*` → PR para `staging`;
- `staging` → PR para `main` quando alguém decide promover; `hotfix/*` sai de `main` e volta para `main`, depois `main` é mesclado em `staging`;
- agente nunca abre PR para `main`;
- sem GitHub pago, `branch-policy.yml` sinaliza push direto e PR para `main` de origem errada (não bloqueia);
- Coolify publica o frontend dos dois branches (deploy nativo); Edge Functions e migrations saem só de `staging` para o Supabase de HML (`functions.yml`, `database.yml`) enquanto não houver projeto de produção.

## Alternativas descartadas

- Manter `hml` e renomear os branches dos repos — os apps do Coolify, os workflows e o histórico de PRs já estão em `staging`; o nome do ambiente continua "HML" no Coolify, nos domínios (`-hlg`) e no Hub, só o branch muda.
- Comprar GitHub pago agora para ter proteção de branch — adiado por custo; `branch-policy.yml` cobre o essencial até lá.

## Consequências

- `agent-run.yml`, `runner/run.mjs`, prompts dos agentes, padrões, guias e templates passam a usar `staging`.
- `hub-create-project` cria `staging` em produto novo; os templates disparam CI em `staging` e `main`.
- Quando existir Supabase de produção, `main` ganha seus workflows de funções e migrations e este ADR é revisto.
