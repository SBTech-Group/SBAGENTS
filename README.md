# SBAGENTS

Playbook da SB Tech: padrões, agentes e templates de todos os produtos.

## Uso rápido (Windows)

1. Instale os agentes no seu Claude Code (uma vez, e de novo sempre que `agents/` mudar):

   ```powershell
   cd "C:\Projetos\SB TECH\SBAGENTS"
   powershell -ExecutionPolicy Bypass -File tools\instalar-agentes.ps1
   ```

2. Diagnostique um produto. Abra o terminal **na pasta do produto**:

   ```powershell
   cd "C:\Projetos\SB TECH\ArenaHub - HML"
   claude --add-dir ..\SBAGENTS
   ```

   E peça: `Use o subagente architect em modo DIAGNÓSTICO.`

   O resultado sai em `docs/diagnostico-AAAA-MM-DD.md` do produto. Nada mais é alterado.

3. Revise o diagnóstico. Marque os achados que aprova e peça:
   `Use o subagente architect em modo ADEQUAÇÃO para os achados SEC-01-a, MT-02-b.`

   Ele cria um branch, faz um commit por achado e roda build/testes. O PR quem abre é você.

## Produto sem AGENTS.md

Peça primeiro `Use o subagente onboarding.` Ele lê o repo e gera o rascunho de `AGENTS.md` e `CLAUDE.md` no formato do template.

## Mudar o padrão

Edite em `standards/`, suba `VERSION`, registre em `CHANGELOG.md`. Veja `AGENTS.md`.
