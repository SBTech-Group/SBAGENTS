#!/usr/bin/env node
// Marca a execução como falha no Hub quando o job morre antes do runner
// conseguir avisar (timeout do job, cancelamento, erro de instalação).
import { readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = process.env
if (!existsSync('runner-state.json') || !env.AGENT_EVENTS_URL || !env.AGENT_EVENTS_TOKEN) process.exit(0)
const state = JSON.parse(readFileSync('runner-state.json', 'utf8'))
if (state.ended) process.exit(0) // o runner já registrou o fim
const { ended, ...runState } = state
const motivo = env.JOB_STATUS === 'cancelled' ? 'cancelled' : 'failed'
const res = await fetch(env.AGENT_EVENTS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-agent-token': env.AGENT_EVENTS_TOKEN },
  body: JSON.stringify({
    run: { id: runState.run_id, produto_slug: runState.produto_slug, agente: runState.agente, status: motivo === 'cancelled' ? 'cancelled' : 'failed', ended_at: new Date().toISOString() },
    events: [{ id: randomUUID(), tipo: 'run.failed', mensagem: motivo === 'cancelled' ? 'Execução cancelada ou estourou o tempo.' : 'O job falhou antes do fim. Veja o log.' }],
  }),
}).catch(() => null)
console.log(`fail.mjs: ${res ? res.status : 'sem resposta'}`)
