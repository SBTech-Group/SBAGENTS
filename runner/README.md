# Runner dos agentes

O workflow `.github/workflows/agent-run.yml` roda um agente num repo de produto pelo GitHub Actions. Cada execução vira uma linha em `agent_runs` e uma sequência de `agent_events` no Hub, e aparece ao vivo no módulo **Escritório**. O resultado é sempre um PR para `staging`, nunca para `main` (ADR 0003).

## Fluxo

1. Você dispara o workflow (Actions → "Rodar agente" → Run workflow) com repo, sala do produto, agente, modo e, no integrador, a integração. Os agentes e modos disponíveis estão em `agents/README.md`; o runner lê os modos de cada agente em `agents/<agente>/runner.json`.
2. O job pega um token do GitHub App válido só para o repo alvo, clona o SBAGENTS e o alvo (a partir de `staging`).
3. `runner/run.mjs` cria o branch `agente/<agente>/<modo>[-<integracao>]-<data>-<id>`, avisa o Hub (`run.started`) e roda o Claude Code headless com o prompt do agente.
4. Durante a execução, manda no máximo um evento de ferramenta a cada 20 s (`tool.used`).
5. No fim: confere que nenhum caminho proibido foi tocado (`.github/workflows/`, `.env*`, chaves), empurra o branch, abre o PR para `staging` e marca a execução como `pr_opened` com custo e turnos. Sem alterações, marca `done`.
6. Se o job morrer no meio (tempo, cancelamento), `runner/fail.mjs` marca a execução como falha.

## Limites de segurança

| Limite | Onde |
|---|---|
| Token do GitHub App vale só para o repo alvo e por 1 hora | `create-github-app-token` com `repositories` |
| Ferramentas permitidas explícitas; qualquer outra é negada sem perguntar | `--allowedTools` + `--permission-prompts none` |
| Sem `git push`, `WebFetch` e `WebSearch` para o agente; o push é do runner | `--disallowedTools` |
| Teto de custo por execução (padrão US$ 5, só vale com chave da API) e de turnos (80) | `--max-budget-usd`, `--max-turns`, variável `AGENT_MAX_USD` |
| Tempo máximo de 45 min | `timeout-minutes` |
| Caminhos proibidos checados antes do push | `PROIBIDOS` em `run.mjs` |
| PR só para `staging`, e `staging` protegido exige revisão humana | `gh pr create --base staging` + proteção de branch |
| Um agente por repo por vez | `concurrency` |

O agente não recebe segredos do produto: nenhum banco, nenhuma chave de cliente.

## Configuração (uma vez)

**1. SBAGENTS no GitHub**, na organização `SBTech-Group` (privado).

**2. GitHub App** "SBAgents" na organização, instalado nos repos de produto, com permissões de repositório:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read

Sem permissão de Administration, Workflows ou Secrets.

**2b. Alternativa ao App:** um token fino (Settings da sua conta → Developer settings → Personal access tokens → Fine-grained tokens) com *Resource owner* `SBTech-Group`, só os repos de produto, e permissões Contents e Pull requests em *Read and write*. Salve como secret `AGENTS_GH_TOKEN`. O workflow usa o App quando `AGENTS_APP_ID` e `AGENTS_APP_PRIVATE_KEY` existem; senão, este token. Os PRs aparecem em seu nome.

**3. No repo SBAGENTS** (Settings → Secrets and variables → Actions):

| Nome | Tipo | Valor |
|---|---|---|
| `AGENTS_APP_ID` | variable | ID do GitHub App |
| `AGENTS_APP_PRIVATE_KEY` | secret | chave privada do App (.pem) |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | token da assinatura Claude (Pro, Max, Team ou Enterprise), gerado com `claude setup-token`; as execuções consomem a cota da assinatura |
| `ANTHROPIC_API_KEY` | secret | alternativa: chave da API (cobrança por uso). Se as duas existirem, a chave da API tem prioridade, então deixe só uma |
| `AGENT_EVENTS_URL` | variable | `https://<projeto-do-hub>.supabase.co/functions/v1/hub-agent-events` |
| `AGENT_EVENTS_TOKEN` | secret | segredo longo aleatório (`openssl rand -hex 32`) |
| `AGENT_MAX_USD` | variable (opcional) | teto por execução, padrão `5` |

**4. No Supabase do Hub:** aplicar a migration `20261015000100_agent_office.sql`, configurar o secret `AGENT_EVENTS_TOKEN` (mesmo valor) e publicar `hub-agent-events`.

**5. Nos repos alvo:** ter o branch `staging`.

## Primeiro teste

Rode `architect` em modo `diagnostico` no Promobot (`SBTech-Group/promobot`, sala `promobot`). Esperado: um PR para `staging` com `docs/diagnostico-<data>.md`, e no Escritório o arquiteto aparece trabalhando na sala do Promobot e depois aguardando revisão. Compare o diagnóstico com `diagnosticos/2026-10-14/promobot.md`.
