# Prompt — Novo Produto a Partir do Template

> Cole este prompt no Claude Code **dentro do repositório recém-clonado** do template. O Claude Code vai customizar o template pra este produto: substituir placeholders, configurar tema, criar esqueleto dos módulos e validar o build.

---

## Contexto

Acabei de criar um repositório novo usando o template-base SaaS B2B (`Use this template` no GitHub). O repo tem na raiz: `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `PLAYBOOKS.md`, mais a estrutura padrão (`src/core`, `src/styles`, `src/modules`, `page-packs/`, `supabase/migrations/`, workflows do GitHub).

Sua tarefa é **customizar este template para o produto específico** que vou descrever, em quatro fases:

1. Leitura dos docs
2. Levantamento (você me pergunta tudo de uma vez)
3. Plano de mudanças (você me mostra o que vai fazer e espera meu OK)
4. Execução + validação (você roda, eu vejo o resultado)

## Fase 1 — Leitura

Leia, nesta ordem, os arquivos no root:

1. `README.md` — visão geral do template
2. `CLAUDE.md` — template per-produto com placeholders (você vai preencher)
3. `ARCHITECTURE.md` — decisões imutáveis (referência, não edite)
4. `PLAYBOOKS.md` — integrações opt-in (referência)

Confirme que entendeu o modelo dos três baldes (Core intocável / Esqueleto / Customizável) e o modelo de identidade visual em duas camadas (`sb-tech-base.css` intocável / `tokens.css` customizável). Não me mostre resumo dos docs — só confirme.

## Fase 2 — Levantamento

Me peça **em uma única mensagem** os dados abaixo. Não pergunte de um em um. Aceite que eu responda numa única mensagem em qualquer formato (tabela, lista, prosa).

### Dados do produto

| Campo | Exemplo |
|---|---|
| Nome do produto | `Arena Hub` |
| Slug | `arenahub` |
| Domínio raiz | `arenahub.com.br` |
| Descrição em 1 linha | `Gestão para arenas esportivas e academias` |
| Descrição detalhada (2–3 frases) | `Plataforma B2B para...` |

### Identidade visual

| Campo | Opções |
|---|---|
| Tema | `dark` (padrão SB Tech) \| `light` |
| Cor primary | `gold` (padrão da casa) \| outro HSL específico |

### Módulos iniciais

Para cada módulo, me peça:
- `id` (slug, ex: `alunos`)
- Descrição curta em uma frase
- Rotas iniciais que vai ter (você cria placeholder)
- Itens de menu (label, ícone Lucide)

### Integrações

| Integração | Pergunta |
|---|---|
| Catálogo do Hub | Este produto vai entrar no Hub Admin? (sim/não) |
| WhatsApp Evolution | Usa? (sim/não) |
| Mercado Pago | Usa? (sim/não, e em qual módulo) |

### Infraestrutura

| Campo | Pergunta |
|---|---|
| Projetos Supabase | Já criados ou criar depois? |
| `VITE_SUPABASE_URL` staging | (se já criado) |
| `VITE_SUPABASE_URL` prod | (se já criado) |

Aguarde minhas respostas antes de prosseguir. Não execute nada na Fase 2.

## Fase 3 — Plano de mudanças

Com base nas minhas respostas, me apresente um **plano resumido** antes de tocar em qualquer arquivo:

1. Quais arquivos serão **editados** (lista com 1 linha cada)
2. Quais arquivos serão **criados** (lista com 1 linha cada)
3. Quais page-packs serão **ativados** (copiados para `src/` ou `supabase/`)
4. Quais comandos serão **executados** (`npm install`, `npm run build`, etc.)

Aguarde meu "OK" antes de executar. Se eu pedir ajuste, recalcule e mostre o plano de novo.

## Fase 4 — Execução

Quando eu aprovar, execute na ordem:

### 4.1 — Substituir placeholders no `CLAUDE.md`

Preencha a seção "Configure antes de começar" com os valores reais. Atualize o título do arquivo (de `{{PRODUTO_NOME}}` para o nome real). Preencha "O que é este produto", "Módulos deste produto", "Integrações ativas" com base nas respostas.

Apague a tabela "Configure antes de começar" original (substituída pelos valores no corpo do doc).

### 4.2 — Configurar identidade visual

Se tema for `light`, edite `src/styles/tokens.css` comentando o bloco dark e descomentando o light.

Se cor primary não for `gold`, edite `--color-primary` em `tokens.css` para o HSL fornecido. Documente em comentário o motivo da troca.

**Não toque `sb-tech-base.css` em nenhuma circunstância.**

### 4.3 — Criar esqueleto dos módulos

Para cada módulo informado, crie:

```
src/modules/<id>/
├── pages/
│   └── <Id>Page.tsx          ← placeholder funcional
├── components/.gitkeep
└── index.ts                  ← exporta { id, routes, menuItems }
```

O `<Id>Page.tsx` deve ser um placeholder mínimo mas funcional:

```tsx
// ✏️ Edite este módulo conforme as necessidades do produto.

export function AlunosPage() {
  return (
    <div className="p-8">
      <p className="sb-eyebrow">Módulo</p>
      <h1 className="sb-h1 mt-2">Alunos</h1>
      <p className="sb-p mt-4 text-muted-foreground">
        Placeholder do módulo "alunos". Substitua por conteúdo real.
      </p>
    </div>
  )
}
```

O `index.ts` segue o contrato em `ARCHITECTURE.md > Contrato de um módulo`.

### 4.4 — Importar módulos no router

Edite `src/app/router.tsx` adicionando os imports e referências na lista `ALL_MODULES`. **Não invente** — siga literalmente o padrão que está no arquivo.

### 4.5 — Ativar integrações opt-in

**Se catálogo do Hub = sim:**
- Copie `page-packs/hub-integration/functions/tenant-provision/` para `supabase/functions/tenant-provision/`
- Copie `page-packs/hub-integration/functions/tenant-modules/` para `supabase/functions/tenant-modules/`
- Crie `src/pages/WelcomePage.tsx` — rota pública `/welcome` que trata token de convite (ver `ARCHITECTURE.md > Invite flow`). Adicione ao router como rota pública (fora do guard de auth).
- Adicione ao `.env.example`:
  ```bash
  HUB_PROVISIONING_TOKEN=   # token compartilhado com o Hub Admin
  PRODUCT_DOMAIN=           # ex: arenahub.sbtech-group.com (domínio dos subdomínios de tenant)
  PRODUCT_NAME=             # nome legível, ex: Arena Hub
  SYSTEM_ADMIN_EMAIL=admin@sbtech-group.com
  ```
- Marque o item no `CLAUDE.md > Integrações ativas`

**Se WhatsApp = sim:**
- Adicione `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` em `.env.example`
- Marque o item em `CLAUDE.md`
- Lembre o usuário de seguir o playbook completo de WhatsApp depois

**Se Mercado Pago = sim:**
- Marque o item em `CLAUDE.md`
- Não scaffold a integração agora (depende do módulo escolhido)

### 4.6 — Atualizar metadados gerais

- `package.json` — `name` = slug do produto
- `index.html` — `<title>` = nome do produto
- `README.md` da raiz — apague o conteúdo do template e crie um README mínimo do produto (1 parágrafo de descrição + link para `CLAUDE.md` como ponto de entrada)
- `.env.example` — adicione `VITE_DEV_TENANT_SLUG` (já existe?) com comentário de uso em dev
- Crie `.env` copiando de `.env.example`, com placeholders vazios. Adicione comentário no topo: `# Não commitar este arquivo.`

### 4.7 — Validar

Execute na ordem, conserte qualquer erro antes de seguir:

```bash
npm install
npm run typecheck
npm run build
npm run dev    # apenas confirme que sobe sem erro, mate em seguida
```

Se algum falhar, conserte antes de reportar conclusão. Não me chame pra ver até passarem limpos.

## Fase 5 — Wrap-up

Quando terminar, me reporte:

1. **Lista de arquivos tocados** (criados/editados/copiados)
2. **Comandos executados** com status
3. **Próximos passos manuais** que eu preciso fazer:
   - Criar projetos Supabase (staging + prod, sa-east-1)
   - Rodar `0001_core.sql` em ambos
   - Configurar wildcard DNS `*.{{DOMINIO_RAIZ}}`
   - Subir serviços no Coolify (staging + prod)
   - Configurar GitHub branch protection em `main` e `develop`
   - Criar environment `production` no GitHub com revisor
   - Configurar secrets do GitHub (`COOLIFY_WEBHOOK_*`, `COOLIFY_TOKEN_*`)
   - Preencher `.env` com URLs e chaves do Supabase
   - (Se Hub) **Supabase Auth do produto — configurar antes do primeiro provisionamento:**
     - Site URL → `https://<dominio-raiz-do-produto>`
     - Redirect URLs → adicionar `https://*.<PRODUCT_DOMAIN>/**`
   - (Se Hub) Registrar produto no catálogo do Hub Admin
   - (Se Hub) Gerar token único → adicionar como `HUB_PROVISIONING_TOKEN` no produto e como `{PRODUTO}_PROVISIONING_TOKEN` nos secrets do Hub
   - (Se Hub) Sincronizar módulos: Hub → Produto → aba Módulos → "Sincronizar do produto"

4. **Mensagem sugerida pro primeiro commit** — só sugira, não execute:
   ```
   chore: bootstrap {{PRODUTO_NOME}} a partir do template SaaS

   - placeholders preenchidos em CLAUDE.md
   - tema e identidade visual configurados
   - módulos iniciais: {{lista}}
   - integrações opt-in: {{lista}}
   ```

## Restrições importantes

- **Não execute** Fase 3 ou 4 sem meu OK explícito após o plano.
- **Não toque** `sb-tech-base.css`, `ARCHITECTURE.md`, `PLAYBOOKS.md`, conteúdo de `src/core/`, ou workflows do GitHub. Esses são Balde 1 (intocáveis).
- **Não invente** módulos, integrações ou configurações que eu não pedi. Pergunte se em dúvida.
- **Não rode** `git add`/`git commit` automaticamente. Só sugira.
- **Não crie** projetos Supabase, configure Coolify, ou registre no Hub — isso é manual (passos listados na Fase 5).
- **Se algo do template parecer faltar** (arquivo esperado ausente, workflow mal configurado), pare e me avise antes de continuar.

Pronto. Comece pela Fase 1.
