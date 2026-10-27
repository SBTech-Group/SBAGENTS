# SBAGENTS

Playbook da SB Tech: como todo produto da casa é construído, integrado e mantido, e os agentes de IA que ajudam nisso. É a fonte única: os repos de produto apontam para cá.

## Por onde começar

| Quero… | Leia |
|---|---|
| Criar um produto novo | [`guias/novo-produto.md`](guias/novo-produto.md) |
| Integrar um produto ao Hub, ao WhatsApp, a pagamentos ou e-mail | [`integracoes/`](integracoes/README.md) |
| Saber as regras que todo produto segue | [`standards/00-index.md`](standards/00-index.md) e [`standards/regras.md`](standards/regras.md) |
| Escolher entre `saas` e `multi-tenant` | [`standards/modalidades.md`](standards/modalidades.md) |
| Ver como os sistemas se conectam | [`architecture/sistemas.md`](architecture/sistemas.md) |
| Rodar, criar ou mudar um agente | [`agents/README.md`](agents/README.md) e [`runner/README.md`](runner/README.md) |
| Ver o que vem por aí | [`ROADMAP.md`](ROADMAP.md) |

## Rodar um agente (servidor)

Neste repo: **Actions → Rodar agente → Run workflow**. Escolha o repo, a sala no Escritório, o agente e o modo. O resultado é sempre um PR para `staging` no repo do produto, e a execução aparece ao vivo no Escritório do Admin Hub.

| Agente | Para |
|---|---|
| `architect` | "Está no padrão?" (`diagnostico`) e corrigir o que foi aprovado (`adequacao`) |
| `onboarding` | Gerar `AGENTS.md` e `CLAUDE.md` de um repo |
| `integrador` | Ligar o produto a uma integração (`plano`, depois `implementacao`) |

## Rodar um agente (seu Claude Code)

```powershell
cd "C:\Projetos\SB TECH\SBAGENTS"
powershell -ExecutionPolicy Bypass -File tools\instalar-agentes.ps1
cd "..\<pasta do produto>"
claude --add-dir ..\SBAGENTS
```

E peça, por exemplo: `Use o subagente architect em modo DIAGNÓSTICO.`

## Mudar o padrão

Edite, suba `VERSION`, registre em `CHANGELOG.md`. Regras para quem edita: [`AGENTS.md`](AGENTS.md).
