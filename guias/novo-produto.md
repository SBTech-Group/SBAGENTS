# Criar um produto novo

Do zero até o primeiro cliente provisionado. Cada passo diz **quem** faz: você, um agente ou o Hub. Os passos 2 e 3 são feitos pelo botão **Novo produto** do Hub (`architecture/novo-projeto-pelo-hub.md`); o resto aparece como checklist na tela do produto.

```
 1 Decidir ─▶ 2 Repo ─▶ 3 Código base ─▶ 4 Supabase ─▶ 5 Coolify ─▶ 6 Hub ─▶ 7 Integrações ─▶ 8 Conferir ─▶ 9 Vender
```

## 1. Decidir (você, 15 min)

| Pergunta | Resposta vira |
|---|---|
| Cada cliente é uma empresa que precisa de espaço próprio, usuários próprios ou endereço próprio? | Sim: `multi-tenant`. Não, cada cliente só tem a sua conta num app comum: `saas`. Ver `standards/modalidades.md` |
| Nome e slug | Slug em minúsculas com hífen (`agenda-pet`). Vira repo, `produtos.slug` e subdomínio |
| Domínio | `<slug>.sbtech-group.com` (saas) ou `*.<slug>.sbtech-group.com` (multi-tenant) |
| Módulos iniciais | Chaves curtas (`admin`, `agenda`, `financeiro`). Viram `tenant-modules` e os planos do Hub |
| Integrações | Quais guias de `integracoes/` entram: `hub` sempre; `whatsapp-meta`, `pagamentos` (consumidor final) e `email` se precisar |

Trocar `saas` por `multi-tenant` depois exige migrar todas as tabelas. Decida antes.

## 2. Repo no GitHub (Hub, 1 min)

**Hub → Produtos → Novo produto**: nome, slug, descrição, modalidade, módulos e integrações. O Hub cria `SBTech-Group/<slug>` a partir do template da modalidade, preenche `AGENTS.md` e os módulos, cria `hml` e protege `main` e `hml`. Acompanhe no card **Repositório** do produto.

Sem o Hub (à mão):


1. Crie `SBTech-Group/<slug>`, privado.
2. Crie os branches `main` e `hml` e proteja os dois: PR obrigatório e CI verde (ADR 0002, GIT-01).
3. Instale o GitHub App **SBTech-Agents** no repo (Settings da organização → GitHub Apps → SBTech-Agents → Configure).

## 3. Código base (já vem do template)

O template traz identidade SB Tech, login, `/welcome`, `tenant-provision`, `tenant-modules`, CI e testes. Depois do repo criado:

1. Rode o **architect** em `diagnostico` no repo novo (workflow "Rodar agente"). Corrija os bloqueantes com `adequacao` antes de seguir.
2. Desenvolva os módulos em `src/modules/<chave>/` e registre em `src/app/menu.tsx`. A lista que o Hub lê fica em `supabase/functions/_shared/modules.ts`.

Identidade visual não é opcional: `src/styles/sb-tech-base.css` idêntico ao do template, cores só por token (FE-02, FE-03).

## 4. Supabase (você, 20 min)

1. Crie dois projetos em `sa-east-1`: `<slug>-hml` e `<slug>-prd`.
2. Aplique as migrations do repo nos dois (`supabase db push` ou pelo painel). Confira RLS em todas as tabelas (MT-01).
3. Auth → URL Configuration:
   - Site URL: o domínio do produto;
   - Redirect URLs: `https://*.<dominio>/**` (multi-tenant) ou `https://<dominio>/**` (saas).
4. Secrets das Edge Functions (só nomes aqui; valores no cofre da empresa):
   - `HUB_PROVISIONING_TOKEN` (gere um valor novo: `openssl rand -hex 32`);
   - `PRODUCT_DOMAIN`, `PRODUCT_NAME`, `SYSTEM_ADMIN_EMAIL`;
   - os da integração escolhida, conforme o guia.
5. Publique as funções: `supabase functions deploy` (as públicas com `--no-verify-jwt` só quando o guia manda).

## 5. Coolify (o Hub cria; você preenche e faz o deploy, 5 min)

O Hub cria no Coolify, junto com o repo, um projeto com dois environments, cada um com um servidor e um branch, e um app em cada, **sem deploy**:

| Environment | Servidor | Branch | Domínio |
|---|---|---|---|
| `homologação` | Homologação | `hml` | `<slug>-hlg.sbtech-group.com` |
| `produção` | Produção | `main` | `<slug>.sbtech-group.com` |

**Pré-requisito, uma vez por Hub:** os secrets `COOLIFY_URL`, `COOLIFY_API_TOKEN` (abilities `write` e `deploy`), `COOLIFY_GITHUB_APP_UUID`, `COOLIFY_SERVER_HML_UUID` e `COOLIFY_SERVER_PRD_UUID` no Supabase do Hub, mais `COOLIFY_READ_TOKEN` (`read` e `read:sensitive`) para a Sentinela. Lista completa e função de cada um em `AGENTS.md` do Admin Hub, seção "Segredos do Hub". Sem eles, a tela do produto mostra quais faltam.

Se a criação falhar, a tela explica o motivo e o botão "Criar ambientes" continua de onde parou (idempotente). **Enquanto o Hub não tiver os secrets, crie à mão** o mesmo desenho no Coolify:

- duas aplicações a partir do repo, com GitHub App: homologação no branch `hml`, produção no `main`;
- Nixpacks, site dinâmico, `npm install`, `npm run build`, publicar `/dist`, porta 3000, `NIXPACKS_NODE_VERSION=20`;
- um domínio por ambiente, conforme a tabela.

Depois siga os passos abaixo, que valem para os dois caminhos.

1. Variáveis de build, **nos dois environments**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, cada um com o Supabase do seu ambiente. **Nenhum token** com `VITE_` (SEC-01).
2. DNS: apontar cada domínio para o servidor do ambiente. No multi-tenant, o wildcard `*.<dominio>` no DNS e no Coolify.
3. Conferir que a fonte GitHub do Coolify enxerga o repo novo (se ela não estiver em "All repositories").
4. Primeiro deploy: botão "Deploy" de cada ambiente na tela do produto (pede confirmação).
5. Depois: merge em `hml` publica homologação; PR de `hml` para `main` publica produção.

A Sentinela (`hub-log-watch` no Admin Hub) passa a vigiar os dois ambientes: erro nos logs, deploy falho e app parado viram cards em Tarefas, ligados ao produto.

## 6. Cadastro no Hub (você, 10 min)

Siga `integracoes/hub.md`, seção "Cadastro do produto no Hub":

1. **Produtos → Novo**: slug, modelo (`tenant` ou `saas`), `provision_endpoint` (terminando em `/tenant-provision`), `provisioning_token_ref` (`<SLUG>_PROVISIONING_TOKEN`), domínio.
2. Supabase **do Hub** → Edge Functions → Secrets: crie `<SLUG>_PROVISIONING_TOKEN` com o mesmo valor do passo 4.
3. Aba **Módulos** → "Sincronizar do produto".
4. **Planos**: crie os planos com os módulos.

A sala do produto aparece no Escritório quando um agente trabalhar nele.

## 7. Integrações (agente integrador + você)

Para cada integração além do `hub`:

1. Rode o **integrador** em modo `plano` com a integração. Ele escreve `docs/integracao-<nome>.md` com o que falta e os passos fora do código.
2. Revise e mescle o PR.
3. Rode o **integrador** em modo `implementacao`. Revise o PR, faça os passos fora do código que ele listar (secrets, cadastro no app Meta) e mescle.

## 8. Conferir (você)

- [ ] Checklist de pronto de cada guia de `integracoes/` usado.
- [ ] Assinatura de teste no Hub provisionada; convite chega; `/welcome` funciona.
- [ ] Provisionar de novo não duplica; mudar o plano muda os módulos.
- [ ] Usuário de um cliente não vê dados de outro (teste de isolamento, TST-01).
- [ ] Architect em `diagnostico` sem bloqueantes.

## 9. Vender

Plano publicado no Hub, assinatura real, "Provisionar". A cobrança B2B sai pelo Hub (`integracoes/pagamentos.md`); o produto não cobra a SB Tech.

## Resumo de quem guarda cada segredo

| Segredo | Produto | Hub | Coolify | GitHub (SBAGENTS) |
|---|---|---|---|---|
| Token do produto | `HUB_PROVISIONING_TOKEN` | `<SLUG>_PROVISIONING_TOKEN` | — | — |
| Chaves Meta, Asaas, Resend da SB Tech | **nunca** | sim | — | — |
| Mercado Pago do cliente (consumidor final) | sim (ver `pagamentos.md`) | — | — | — |
| URL e anon key do Supabase | — | — | `VITE_SUPABASE_*` | — |
| Token dos agentes, App e eventos do Escritório | — | `AGENT_EVENTS_TOKEN` | — | `CLAUDE_CODE_OAUTH_TOKEN`, `AGENTS_APP_*`, `AGENT_EVENTS_*` |
