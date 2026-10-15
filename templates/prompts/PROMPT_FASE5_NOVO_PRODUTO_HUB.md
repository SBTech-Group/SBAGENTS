# Prompt — Fase 5: "Novo produto" no Hub cria o repositório com os agentes

> Como usar: abra o Claude Code **na pasta do Admin Hub**, com o SBAGENTS ao lado:
>
> ```powershell
> cd "C:\Projetos\SB TECH\Admin Hub"
> git switch hml; git pull
> claude --add-dir ..\SBAGENTS
> ```
>
> Cole tudo abaixo da linha.

---

Você vai implementar a Fase 5 do roadmap da SB Tech: no Admin Hub, o operador clica em **Novo produto**, escolhe a modalidade (`saas` ou `multi-tenant`) e recebe um repositório no GitHub da organização `SBTech-Group` já pronto, com código base da modalidade, identidade visual SB Tech, `AGENTS.md` preenchido, CI, branches `hml`/`main` protegidos e acesso dos agentes. O produto fica registrado no Hub.

## Leia antes de qualquer coisa

1. `AGENTS.md` deste repo (regras do Hub: `ConfirmModal`, `eventos_auditoria`, SEC-06 com `_shared/auth.ts > hubAdminError`, sem cor hex, migration sempre nova).
2. `../SBAGENTS/architecture/novo-projeto-pelo-hub.md`: a especificação desta fase.
3. `../SBAGENTS/guias/novo-produto.md`: o passo a passo manual de hoje. O que você automatizar sai dele; o resto continua lá como checklist.
4. `../SBAGENTS/standards/modalidades.md`, `../SBAGENTS/standards/regras.md` (SEC, GIT, DOC, FE) e `../SBAGENTS/architecture/adr/0002-branches-producao-homologacao.md`.
5. `../SBAGENTS/templates/repo/` (`AGENTS.md`, `CLAUDE.md`, `styles/`) e `../SBAGENTS/agents/README.md`.
6. O que já existe no Hub e será reaproveitado: `src/lib/starterPack.ts`, `src/lib/templates*`, `src/modules/produtos/StarterPackModal.tsx`, `ProdutoModal.tsx`, `supabase/migrations/0002_produtos.sql` e `0013_produto_modelo_saas.sql`.

## Estado atual (confirme no código)

- `produtos` tem `modelo` (`saas` | `tenant`), mas `dominio_raiz` e `provision_endpoint` são `not null`, o que impede cadastrar o produto antes de existir Supabase e DNS.
- O Starter Pack gera um **zip** com `ARCHITECTURE.md`, `PLAYBOOKS.md`, prompts, `CLAUDE.md` e `.env.example`. Ele usa o formato antigo (`CLAUDE.md` como fonte, cópias de `ARCHITECTURE.md`). O padrão atual é `AGENTS.md` como fonte e o produto **apontando** para o SBAGENTS (DOC-01, DOC-03).
- Já existe o GitHub App **SBTech-Agents** (Contents e Pull requests, leitura e escrita). Ele serve aos agentes e **não deve** ganhar permissão de administração.
- Não existem ainda os repos de template na organização.

## O que entregar

### Parte A — Templates (repos de template no GitHub)

Proponha, e só crie depois do meu OK, dois repositórios marcados como *template* na organização:

| Repo | Base | Diferença |
|---|---|---|
| `SBTech-Group/template-multitenant` | pasta local `C:\Projetos\SB TECH\Template Saas` | `tenant_id` + `current_tenant_id()` + subdomínio + `/welcome` |
| `SBTech-Group/template-saas` | o mesmo, adaptado | isolamento por `user_id = auth.uid()`, domínio único |

Cada template precisa ter: `src/styles/sb-tech-base.css` idêntico ao do SBAGENTS; `tenant-provision` e `tenant-modules` conforme `../SBAGENTS/integracoes/hub.md`; CI de PR (`typecheck`, `build`, `test`) igual ao do Hub; `.gitignore` de segredos; `AGENTS.md` e `CLAUDE.md` com marcadores `{{...}}` que o Hub preenche. Rode o `architect` em modo diagnóstico em cada template e corrija os bloqueantes antes de marcar como template.

Se a pasta `Template Saas` não tiver algo necessário, pare e me diga o que falta.

### Parte B — Hub

1. **Migration nova** em `supabase/migrations/`:
   - `produtos.dominio_raiz` e `produtos.provision_endpoint` passam a aceitar nulo;
   - novas colunas em `produtos`: `repo_url text`, `repo_status text check (repo_status in ('pendente','criando','criado','falhou'))`, `repo_erro text`, `playbook_version text`;
   - nada de `tenant_id` (o Hub não é multi-tenant).
   Verifique antes quais funções e telas assumem `provision_endpoint` preenchido (`hub-provision`, `hub-discover-modules`, `hub-meta-webhook`) e faça cada uma responder com erro claro quando ele estiver vazio.

2. **Edge Function `hub-create-project`**:
   - autentica o operador com `hubAdminError` (SEC-06); `verify_jwt` normal;
   - corpo: `{ produto_id }`. Lê o produto (slug, nome, `modelo`, módulos, integrações escolhidas);
   - autentica no GitHub com um **GitHub App próprio para isso** (sugestão: `SBTech-Provisioner`), instalado só na organização. Confirme na documentação da API do GitHub as permissões mínimas para gerar repo a partir de template, escrever conteúdo e proteger branch (esperado: *Administration* e *Contents* em escrita) e liste no plano. Gera um token de instalação de curta duração a partir de `GITHUB_PROVISIONER_APP_ID` e `GITHUB_PROVISIONER_PRIVATE_KEY` (secrets do Supabase do Hub; nunca no frontend nem em `VITE_*`);
   - passos, cada um **idempotente** (se o repo já existe, segue do ponto onde parou):
     1. `POST /repos/SBTech-Group/template-<modalidade>/generate` → `SBTech-Group/<slug>`, privado, `include_all_branches: false`;
     2. preenche e commita (Contents API) `AGENTS.md`, `CLAUDE.md` e `.env.example`, com tipo, módulos, integrações e a versão atual do SBAGENTS (`VERSION`);
     3. cria o branch `hml` a partir de `main`;
     4. protege `main` e `hml`: PR obrigatório, CI (`verify`) obrigatório, sem push direto;
     5. garante que o App **SBTech-Agents** alcança o repo novo. Um App não consegue se adicionar a um repo; se o SBTech-Agents estiver instalado em "Only select repositories", proponha instalá-lo em "All repositories" ou inclua este passo no checklist manual;
   - a cada passo atualiza `produtos.repo_status` / `repo_erro` e grava em `eventos_auditoria` (`produto.repo_criado`, `produto.repo_falhou`);
   - nunca apaga repo existente; em falha, para e registra.
   - Testes Deno em `supabase/functions/_shared` para o preenchimento de `AGENTS.md` e para a montagem das chamadas, sem rede.

3. **Tela** (módulo `produtos`):
   - "Novo produto" passa a pedir: nome, slug, descrição, **modalidade** (`saas` ou `multi-tenant`, com a explicação de `modalidades.md`), módulos iniciais e integrações (`whatsapp-meta`, `pagamentos` consumidor final, `email`);
   - botão **Criar repositório** abre `ConfirmModal` explicando o que será criado;
   - mostra o andamento (`repo_status`), o link do repo e, no fim, o **checklist do que continua manual**, tirado de `guias/novo-produto.md` (Supabase, Coolify, DNS, secrets, cadastro de `provision_endpoint`);
   - o Starter Pack (zip) continua disponível, mas atualizado para o formato `AGENTS.md` + referência ao SBAGENTS, ou é removido. Pergunte qual eu prefiro.
   - Identidade do Hub: tokens, Lucide `strokeWidth={1.75}`, sem hex.

### Parte C — Playbook

Ao final, proponha (sem aplicar) as mudanças no SBAGENTS: `architecture/novo-projeto-pelo-hub.md` de "proposta" para "implementado", `guias/novo-produto.md` com os passos 2 e 3 trocados por "Hub → Novo produto", e a entrada no `CHANGELOG.md`.

## Como trabalhar

1. **Primeiro, só o plano.** Leia tudo acima, confira o estado atual no código e me mostre: arquivos a criar e mudar, a migration, a lista de permissões do GitHub App novo, riscos e perguntas. Não escreva código antes do meu OK.
2. Branch `agente/architect/fase5-novo-produto` a partir de `hml`. Um commit por etapa (`feat(produtos): ...`, `feat(hub-create-project): ...`).
3. Depois de cada etapa: `npm run typecheck && npm run build` e `deno test --allow-env --no-lock supabase/functions/_shared`.
4. PR para `hml`, nunca para `main`.

## O que eu faço (diga quando precisar)

- Criar o GitHub App `SBTech-Provisioner` com as permissões que você listar, instalar na organização e salvar `GITHUB_PROVISIONER_APP_ID` e `GITHUB_PROVISIONER_PRIVATE_KEY` nos secrets do Supabase do Hub.
- Aprovar a criação dos repos de template.
- Aplicar a migration e publicar `hub-create-project` (ou autorizar você a fazer).

## Nunca

- Dar permissão de administração ao App SBTech-Agents, nem usar token pessoal meu.
- Gravar chave do App ou token em tabela, código, log ou `VITE_*`.
- Apagar ou sobrescrever repositório existente.
- Editar migration já aplicada.
- Automatizar Supabase, Coolify ou DNS nesta fase (fica para depois, listado no checklist manual).
- Mudar o contrato de `tenant-provision` / `tenant-modules` (`../SBAGENTS/integracoes/hub.md`).
