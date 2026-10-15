# SBAGENTS — instruções para agentes

Este repositório é o **playbook da SB Tech**: os padrões de arquitetura, as regras verificáveis, os agentes e os templates usados por todos os produtos. Ele é a fonte única desses padrões. Os repositórios de produto apontam para cá, não mantêm cópias.

## Como este repositório é usado

- Em tarefas sobre um produto, este repo é montado **somente leitura** ao lado do repo alvo (`../SBAGENTS`).
- Só se edita este repo quando a tarefa é mudar o padrão. Toda mudança de padrão:
  1. sobe a versão em `VERSION` (semver: regra nova ou mais rígida = minor; correção de texto = patch; quebra de contrato = major);
  2. registra a mudança em `CHANGELOG.md`;
  3. se for uma decisão com alternativa descartada, ganha um ADR em `architecture/adr/`.

## Mapa

| Caminho | Conteúdo |
|---|---|
| `standards/00-index.md` | Por onde começar: qual arquivo ler para qual assunto |
| `standards/modalidades.md` | As duas modalidades de produto: `saas` e `multi-tenant` |
| `standards/regras.md` | Regras com ID (SEC-01, MT-01…) — o que o arquiteto verifica |
| `standards/arquitetura.md` | Arquitetura padrão dos produtos SaaS B2B (texto de referência) |
| `standards/integracoes.md` | Integrações opt-in: Hub, Evolution, Mercado Pago |
| `architecture/sistemas.md` | Quais sistemas existem e como se conectam |
| `architecture/novo-projeto-pelo-hub.md` | Especificação do "Novo produto" no Hub criando o repo |
| `architecture/adr/` | Decisões globais |
| `agents/` | Definição dos agentes (fonte). `tools/instalar-agentes.*` copia para o Claude Code |
| `templates/` | Template de repo novo, de docs e prompts de bootstrap |
| `diagnosticos/` | Diagnósticos de referência (linha de base e gabarito de avaliação) |

## Regras para quem edita este repo

- Padrão é curto e normativo: "deve / não deve", com o motivo e um exemplo real.
- Toda regra verificável vive em `standards/regras.md` com ID estável. Não reaproveite IDs removidos.
- Não escreva regra que nenhum produto consegue cumprir sem dizer o caminho de migração.
- Exemplos de código vêm de produtos reais da casa, citando o repo de origem.
