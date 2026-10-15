# <Produto> — instruções para agentes

- Tipo: `multi-tenant` | `saas` | `interno` | `servico`
- Segue: SBAGENTS v0.4.0 (padrões em `../SBAGENTS/standards/00-index.md`, somente leitura)
- Branches: `hml` (homologação, recebe os PRs) · `main` (produção, só recebe PR de `hml`). Agentes trabalham em `agente/<nome>/<assunto>`.

## O que este sistema faz

<3 a 5 linhas: domínio, quem usa, como os tenants entram (Hub ou manual).>

## Como rodar e testar

```bash
npm install
npm run dev
npm run typecheck && npm run build && npm run test
```

Todo PR precisa passar nos três últimos.

## Módulos

| Chave | Label | Sempre ativo | Descrição |
|---|---|---|---|
| | | | |

## Integrações ativas

Marque as que o produto usa. Cada uma segue o guia em `../SBAGENTS/integracoes/`.

- [ ] Hub Admin (`integracoes/hub.md`)
- [ ] WhatsApp pela Meta, via Hub (`integracoes/whatsapp-meta.md`)
- [ ] Pagamento do consumidor final, Mercado Pago (`integracoes/pagamentos.md`)
- [ ] E-mail transacional, Resend (`integracoes/email.md`)

## Pontos sensíveis

| Área | Por que é sensível |
|---|---|
| `tenant-provision` | Idempotência; erro duplica tenant ou perde módulos |
| Migrations aplicadas | Nunca editar; criar migration nova |

## Contratos externos

Funções ou tabelas consumidas por outros sistemas. Não mudar o formato sem alinhar com o consumidor.

| Função/tabela | Consumidor |
|---|---|
| | |

## Regras locais

Regras deste produto que complementam o padrão (não o contrariam).

-

## Desvios aceitos do padrão

Cada desvio cita a regra do SBAGENTS e o ADR em `docs/adr/`.

| Regra | Desvio | ADR |
|---|---|---|
| | | |

## Não tocar

- `.env*`, chaves e certificados
- Migrations já aplicadas
- Workflows de deploy em `.github/workflows/`
