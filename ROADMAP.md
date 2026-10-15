# Roadmap

| Fase | Entrega | Situação |
|---|---|---|
| 0 | Playbook, agentes `architect` e `onboarding`, diagnósticos de linha de base | Concluída em 2026-10-14 |
| 1 | Bloqueantes corrigidos e `AGENTS.md` nos repos | **Concluída em 2026-10-15, com ressalva** (abaixo) |
| 2 | Agentes rodando no GitHub Actions, com eventos de cada execução | Em andamento |
| 3 | Tabelas `agent_runs` / `agent_events` no Hub e painel ligado a elas | Em andamento (junto com a 2) |
| 4 | Fila de entrada (Trello ou Issues) e aprovações (Slack) | A fazer |
| 5 | "Novo produto" no Hub criando o repo (`architecture/novo-projeto-pelo-hub.md`) | Especificada |
| 6 | Escritório 3D | Em andamento: módulo "Escritório" no Admin Hub, lendo `agent_events` |

## Ressalva da Fase 1

Marcada como concluída por decisão do Guilherme em 2026-10-15. O código está pronto, mas ainda falta, do lado dele:

- **Publicar** os branches locais `agente/architect/fase1` do Admin Hub (4 commits) e do Promobot (4 commits), com PR para `hml`.
- **Criar e proteger** `hml` e `main` no GitHub nos repos (ADR 0002).
- **Admin Hub:** tirar a chave `Adminsbtech123@` da pasta do repo; conferir que os operadores estão em `meta_admins`.
- **Promobot:** trocar a chave da Evolution; configurar os secrets `HUB_URL`, `HUB_PROVISIONING_TOKEN`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`; publicar `hub-bridge` e `whatsapp-evolution` sem `--no-verify-jwt`; remover as variáveis `VITE_EVOLUTION_API_KEY` e `VITE_HUB_PROVISIONING_TOKEN` do build no Coolify.
- **Pendentes de correção:** Promobot SEC-06-a e SEC-06-b (funções que leem o JWT sem verificar ou sem autenticação), ArenaHub inteiro (aguarda o repo oficial na SBTech-Group).

Até essas pendências fecharem, os diagnósticos continuam contando os bloqueantes como abertos.
