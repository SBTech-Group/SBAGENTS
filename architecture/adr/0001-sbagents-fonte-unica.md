# ADR 0001 — SBAGENTS é a fonte única dos padrões

- Data: 2026-10-14
- Status: aceito
- Escopo: global

## Contexto

`ARCHITECTURE.md`, `PLAYBOOKS.md` e os prompts de bootstrap eram copiados do `SB Template` para cada produto. As cópias já divergem: ArenaHub HML tem versões próprias dos dois arquivos, enquanto Admin Hub e Promobot ainda têm a original. Agentes que leem a cópia local seguem regras diferentes em cada repo.

## Decisão

O SBAGENTS guarda os padrões. Cada produto mantém só o que é dele (`AGENTS.md`, `CLAUDE.md`, `docs/`) e declara no `AGENTS.md` a versão do SBAGENTS que segue. Agentes leem o SBAGENTS montado em `../SBAGENTS`, somente leitura.

## Alternativas descartadas

- Manter cópias e sincronizar com script — continua gerando divergência entre sincronizações e duplica contexto para os agentes.
- Submódulo git em cada produto — fixa versão, mas complica clone, CI e uso no Lovable.

## Consequências

- As cópias locais viram achado DOC-03 até serem removidas.
- Mudança de padrão passa a ter versão e changelog.
- Regras específicas de um produto que contrariem o padrão precisam de ADR no próprio produto e entrada em "Desvios aceitos".
