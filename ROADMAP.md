# Roadmap

| Fase | Entrega | Situação |
|---|---|---|
| 0 | Playbook, agentes `architect` e `onboarding`, diagnósticos de linha de base | Concluída em 2026-10-14 |
| 1 | Bloqueantes corrigidos e `AGENTS.md` nos repos | **Concluída em 2026-10-15, com ressalva** (abaixo) |
| 2 | Agentes rodando no GitHub Actions, com eventos de cada execução | **Concluída em 2026-10-15**: primeira execução abriu o PR #9 no Admin Hub |
| 3 | Tabelas `agent_runs` / `agent_events` no Hub e painel ligado a elas | **Concluída em 2026-10-15** |
| 4 | Fila de entrada (Trello ou Issues) e aprovações (Slack) | A fazer |
| 5 | "Novo produto" no Hub criando o repo (`architecture/novo-projeto-pelo-hub.md`) | **Implementada** (PR #12 do Admin Hub). Para ligar: App SBTech-Provisioner, repos de template, migration e publicação de `hub-create-project` |
| 6 | Escritório 3D | **No ar** desde 2026-10-15 (PR #7 do Admin Hub) |
| 7 | Guias de integração e agente `integrador` | **Entregue** na 0.5.0. Próximo: rodar o integrador no Promobot (`hub`, `whatsapp-meta`) |

## Ressalva da Fase 1

Marcada como concluída por decisão do Guilherme em 2026-10-15. O código está pronto, mas ainda falta, do lado dele:

- **Publicar** os branches locais `agente/architect/fase1` do Admin Hub (4 commits) e do Promobot (4 commits), com PR para `staging`.
- **Criar e proteger** `staging` e `main` no GitHub nos repos (ADR 0003).
- **Admin Hub:** tirar a chave `Adminsbtech123@` da pasta do repo; conferir que os operadores estão em `meta_admins`.
- **Promobot:** trocar a chave da Evolution; configurar os secrets `HUB_URL`, `HUB_PROVISIONING_TOKEN`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`; publicar `hub-bridge` e `whatsapp-evolution` sem `--no-verify-jwt`; remover as variáveis `VITE_EVOLUTION_API_KEY` e `VITE_HUB_PROVISIONING_TOKEN` do build no Coolify.
- **Pendentes de correção:** Promobot SEC-06-a e SEC-06-b (funções que leem o JWT sem verificar ou sem autenticação), ArenaHub inteiro (aguarda o repo oficial na SBTech-Group).

Até essas pendências fecharem, os diagnósticos continuam contando os bloqueantes como abertos.

## Encontrado ao escrever os guias (0.5.0)

Pontos do código real que divergem do padrão ou merecem atenção. Nenhum foi alterado.

| Onde | O quê | Gravidade |
|---|---|---|
| Hub, `hub-check-vencimentos` | Sem o secret `HUB_CRON_SECRET`, a função aceita qualquer chamada e pode cancelar assinaturas vencidas | Alta: confirmar que o secret existe |
| Hub, catálogo | `arena-hub` tem `provisioning_token_ref = "arenahub/provision-token"`, que não é um nome de secret no formato da casa (`ARENAHUB_PROVISIONING_TOKEN`). Confirmar se o provisionamento e o WhatsApp do ArenaHub funcionam | Alta |
| Hub, catálogo | Promobot não está cadastrado no Hub deste projeto Supabase; `hub-register-account` responderia "Produto não encontrado" | Média |
| ArenaHub HML | `HUB_PRODUCT_SLUG` tem padrão `arenahub`, mas o catálogo usa `arena-hub`. Precisa do secret configurado | Média |
| ArenaHub HML | Um único `MERCADOPAGO_ACCESS_TOKEN` para todas as arenas: o dinheiro de todas cai na mesma conta. O desenho prevê conta por cliente | Alta (negócio) |
| ArenaHub HML, `mercadopago-webhook` | Compara a assinatura sem tempo constante e escreve o hash esperado no log | Baixa |
| Hub, `hub-register-account` | Compara o token sem tempo constante | Baixa |
