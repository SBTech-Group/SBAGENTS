#!/usr/bin/env node
// Runner dos agentes SBAGENTS no GitHub Actions.
//
// Roda um agente (architect, onboarding) em modo headless no repo alvo, que já
// está clonado em ./alvo a partir de `hml`, com o SBAGENTS em ./SBAGENTS
// (somente leitura). Cada passo vira evento no Hub (hub-agent-events), que
// alimenta o Escritório. No fim, empurra um branch agente/<nome>/... e abre PR
// para `hml` (ADR 0002). Nunca abre PR para `main`.
//
// Variáveis: AGENTE, MODO, ACHADOS, PRODUTO_SLUG, ALVO_REPO, CLAUDE_CODE_OAUTH_TOKEN ou ANTHROPIC_API_KEY,
// AGENT_EVENTS_URL, AGENT_EVENTS_TOKEN, GH_TOKEN, AGENT_MAX_USD (padrão 5),
// AGENT_MAX_TURNS (padrão 80).

import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const env = process.env
// Secret ausente no GitHub chega como string vazia; remove para o Claude Code
// cair na outra credencial (assinatura ou chave da API).
for (const k of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']) if (!env[k]) delete env[k]
if (!env.ANTHROPIC_API_KEY && !env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.error('Configure o secret CLAUDE_CODE_OAUTH_TOKEN (assinatura) ou ANTHROPIC_API_KEY no repo SBAGENTS.')
  process.exit(1)
}
const AGENTE = env.AGENTE || 'architect'
const MODO = env.MODO || 'diagnostico'
const ACHADOS = (env.ACHADOS || '').split(',').map((s) => s.trim()).filter(Boolean)
const PRODUTO = env.PRODUTO_SLUG
const ALVO_REPO = env.ALVO_REPO
const ROOT = resolve('.')
const ALVO = join(ROOT, 'alvo')
const PLAYBOOK = join(ROOT, 'SBAGENTS')
const STATE_FILE = join(ROOT, 'runner-state.json')
const LOG_URL = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
const RUN_ID = randomUUID()
const STAMP = new Date().toISOString().slice(0, 10)
const BRANCH = `agente/${AGENTE}/${MODO}-${STAMP}-${RUN_ID.slice(0, 6)}`

// Caminhos que um agente nunca pode alterar (checados antes do push).
const PROIBIDOS = [/^\.github\/workflows\//, /(^|\/)\.env($|\.)/, /\.(pem|key|p12|pfx)$/]

if (!PRODUTO || !ALVO_REPO) fail('PRODUTO_SLUG e ALVO_REPO são obrigatórios.')
if (!['architect', 'onboarding'].includes(AGENTE)) fail(`Agente desconhecido: ${AGENTE}`)
if (!['diagnostico', 'adequacao'].includes(MODO)) fail(`Modo desconhecido: ${MODO}`)
if (MODO === 'adequacao' && !ACHADOS.length) fail('Modo adequação exige a lista de achados aprovados.')
writeFileSync(STATE_FILE, JSON.stringify({ run_id: RUN_ID, produto_slug: PRODUTO, agente: AGENTE }))

function fail(msg) {
  console.error(`::error::${msg}`)
  process.exit(1)
}

// ── Eventos para o Hub ──────────────────────────────────────────────────────
// Falha ao emitir nunca derruba a execução: o log do Actions continua sendo a fonte.
async function emit(run, events = []) {
  if (['done', 'failed', 'pr_opened', 'cancelled', 'timeout'].includes(run.status)) {
    writeFileSync(STATE_FILE, JSON.stringify({ run_id: RUN_ID, produto_slug: PRODUTO, agente: AGENTE, ended: true }))
  }
  if (!env.AGENT_EVENTS_URL || !env.AGENT_EVENTS_TOKEN) return
  const body = {
    run: { id: RUN_ID, produto_slug: PRODUTO, agente: AGENTE, ...run },
    events: events.map((e) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...e })),
  }
  try {
    const res = await fetch(env.AGENT_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': env.AGENT_EVENTS_TOKEN },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.warn(`::warning::hub-agent-events respondeu ${res.status}: ${await res.text()}`)
  } catch (err) {
    console.warn(`::warning::falha ao emitir evento: ${err.message}`)
  }
}

const git = (...args) => execFileSync('git', args, { cwd: ALVO, encoding: 'utf8' }).trim()

function agentPrompt() {
  const raw = readFileSync(join(PLAYBOOK, 'agents', AGENTE, 'prompt.md'), 'utf8')
  const body = raw.replace(/^---[\s\S]*?\n---\s*\n/, '')
  const file = join(ROOT, `prompt-${AGENTE}.md`)
  writeFileSync(file, body)
  return file
}

function taskText() {
  if (AGENTE === 'onboarding') {
    return 'Prepare este repositório para agentes: gere ou atualize AGENTS.md e CLAUDE.md conforme o template do SBAGENTS em ../SBAGENTS. Não altere código. Não faça commit; o runner cuida disso.'
  }
  if (MODO === 'diagnostico') {
    return 'Rode o modo DIAGNÓSTICO neste repositório. O playbook está em ../SBAGENTS (somente leitura). Escreva só o relatório em docs/. Não faça commit; o runner cuida disso.'
  }
  return `Rode o modo ADEQUAÇÃO neste repositório para os achados aprovados: ${ACHADOS.join(', ')}. O branch de trabalho já foi criado a partir de hml; faça um commit por achado. Não faça push nem abra PR; o runner cuida disso. O playbook está em ../SBAGENTS (somente leitura).`
}

function allowedTools() {
  const base = ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)', 'Bash(git ls-files*)', 'Bash(ls *)', 'Bash(wc *)']
  if (MODO === 'adequacao') base.push('Bash(git add *)', 'Bash(git commit *)', 'Bash(git restore *)', 'Bash(git reset --soft *)', 'Bash(npm ci*)', 'Bash(npm run *)')
  return base
}

const describeTool = (block) => {
  const i = block.input || {}
  const alvo = i.file_path || i.path || i.pattern || i.command || ''
  return `${block.name}${alvo ? `: ${String(alvo).replace(ALVO + '/', '').slice(0, 120)}` : ''}`
}

async function runAgent() {
  const args = [
    '-p', taskText(),
    '--output-format', 'stream-json', '--verbose',
    '--append-system-prompt-file', agentPrompt(),
    '--add-dir', PLAYBOOK,
    '--max-turns', String(Number(env.AGENT_MAX_TURNS) || 80),
    '--max-budget-usd', String(Number(env.AGENT_MAX_USD) || 5),
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--allowedTools', ...allowedTools(),
    '--disallowedTools', 'Bash(git push*)', 'WebFetch', 'WebSearch',
  ]
  const child = spawn('claude', args, { cwd: ALVO, env, stdio: ['ignore', 'pipe', 'inherit'] })
  let result = null
  let lastToolEmit = 0
  const rl = createInterface({ input: child.stdout })
  for await (const line of rl) {
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content || []) {
        if (block.type !== 'tool_use') continue
        console.log(`· ${describeTool(block)}`)
        // No máximo um evento de ferramenta a cada 20 s, para o escritório não virar ruído.
        if (Date.now() - lastToolEmit > 20000) {
          lastToolEmit = Date.now()
          await emit({}, [{ tipo: 'tool.used', mensagem: describeTool(block) }])
        }
      }
    } else if (msg.type === 'result') {
      result = msg
    }
  }
  const code = await new Promise((r) => child.on('close', r))
  return { code, result }
}

async function main() {
  git('switch', '-c', BRANCH)
  await emit(
    { status: 'running', modo: MODO, repo: ALVO_REPO, branch: BRANCH, log_url: LOG_URL, started_at: new Date().toISOString() },
    [{ tipo: 'run.started', mensagem: `${AGENTE} começou ${MODO === 'adequacao' ? `a adequação (${ACHADOS.join(', ')})` : MODO} em ${ALVO_REPO}` }],
  )

  const { code, result } = await runAgent()
  const custo = Number(result?.total_cost_usd) || 0
  const turnos = Number(result?.num_turns) || 0
  const resumo = typeof result?.result === 'string' ? result.result.slice(0, 1500) : undefined

  if (code !== 0 || !result || result.is_error) {
    await emit(
      { status: 'failed', custo_usd: custo, turnos, resumo, ended_at: new Date().toISOString() },
      [{ tipo: 'run.failed', mensagem: `Execução falhou (saída ${code}${result?.subtype ? `, ${result.subtype}` : ''}). Veja o log.` }],
    )
    process.exit(1)
  }

  // Diagnóstico e onboarding: o runner commita o que o agente escreveu.
  if (MODO === 'diagnostico' || AGENTE === 'onboarding') {
    git('add', '-A')
    if (git('status', '--porcelain')) {
      git('-c', 'user.name=sbagents[bot]', '-c', 'user.email=agents@sbtech-group.com', 'commit', '-m',
        `${AGENTE === 'onboarding' ? 'docs(agentes): AGENTS.md e CLAUDE.md' : `docs(arq): diagnóstico ${STAMP}`}\n\nGerado pelo agente ${AGENTE} (SBAGENTS). Execução: ${LOG_URL}`)
    }
  }

  const changed = git('diff', '--name-only', 'origin/hml...HEAD').split('\n').filter(Boolean)
  if (!changed.length) {
    await emit(
      { status: 'done', custo_usd: custo, turnos, resumo, ended_at: new Date().toISOString() },
      [{ tipo: 'run.done', mensagem: 'Concluído sem alterações para propor.' }],
    )
    return
  }
  const proibido = changed.find((f) => PROIBIDOS.some((re) => re.test(f)))
  if (proibido) {
    await emit(
      { status: 'failed', custo_usd: custo, turnos, resumo, ended_at: new Date().toISOString() },
      [{ tipo: 'run.failed', mensagem: `O agente alterou um caminho proibido (${proibido}); nada foi publicado.` }],
    )
    process.exit(1)
  }

  git('push', 'origin', `HEAD:refs/heads/${BRANCH}`)
  const title = AGENTE === 'onboarding'
    ? 'docs(agentes): AGENTS.md e CLAUDE.md'
    : MODO === 'diagnostico' ? `Diagnóstico de arquitetura ${STAMP}` : `Adequação: ${ACHADOS.join(', ')}`
  const prBody = `${resumo ?? ''}\n\n---\nAberto pelo agente \`${AGENTE}\` (SBAGENTS). Execução: ${LOG_URL}\nCusto estimado: US$ ${custo.toFixed(2)} · ${turnos} turnos.`
  const prUrl = execFileSync('gh', ['pr', 'create', '--repo', ALVO_REPO, '--base', 'hml', '--head', BRANCH, '--title', title, '--body', prBody], { cwd: ALVO, encoding: 'utf8' }).trim()

  await emit(
    { status: 'pr_opened', pr_url: prUrl, custo_usd: custo, turnos, resumo, ended_at: new Date().toISOString() },
    [{ tipo: 'pr.opened', mensagem: `PR aberto para hml: ${title}`, payload: { url: prUrl, arquivos: changed.length } }],
  )
  console.log(`PR: ${prUrl}`)
}

main().catch(async (err) => {
  console.error(err)
  await emit({ status: 'failed', ended_at: new Date().toISOString() }, [{ tipo: 'run.failed', mensagem: `Erro no runner: ${err.message}`.slice(0, 480) }])
  process.exit(1)
})
