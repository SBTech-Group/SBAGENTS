# Nota fiscal (NFS-e)

## Resumo

A NFS-e da SB Tech (serviço de software cobrado do cliente) é emitida **pelo Hub**, ligada a uma fatura B2B paga. Hoje a emissão é **manual** no Emissor Nacional NFS-e; o Hub prepara o documento e guarda número, código de verificação e links. **O produto não emite nota em nome da SB Tech.**

## Quando usar / quando não usar

**Use** o módulo Notas fiscais do Hub para toda fatura B2B paga.

**Não use** para nota que o cliente do produto emite para os clientes dele: isso, se um dia existir, é funcionalidade do produto e precisa de guia próprio.

## Arquitetura

```
 Fatura B2B paga (pagamentos.md)
        │
        ▼
 Hub → Notas fiscais → "Preparar" ─▶ hub-fiscal (prepare_document) ─▶ fiscal_documents (pending)
        │
        ▼
 Operador emite no Emissor Nacional NFS-e (site do governo)
        │
        ▼
 Hub → "Registrar emissão" ─▶ hub-fiscal (record_manual_issue) ─▶ fiscal_documents (issued:
                                                                    número, id, código de verificação,
                                                                    URLs do XML e do PDF)
 Cancelamento ─▶ hub-fiscal (cancel_document) ─▶ cancelled
```

- `fiscal_issuer_profiles`: dados do emissor (SB Tech) e `emission_mode` (`manual` hoje; `api` quando houver credenciamento).
- `fiscal_documents`: uma nota por fatura, com status `pending`, `issued`, `cancelled` ou `error`.

## Endpoints

| Função | Quem chama | Autenticação | Ações |
|---|---|---|---|
| `hub-fiscal` | Tela Notas fiscais do Hub | Operador (`meta_admins`) | `overview`, `save_profile`, `prepare_document` (só fatura `paga`), `record_manual_issue`, `cancel_document` |

Produto não chama.

## Secrets e variáveis

| Nome | Onde | Situação |
|---|---|---|
| `NATIONAL_NFSE_CREDENTIALS` | Supabase do Hub | Só depois do credenciamento na API nacional. Não existe hoje |

## No produto

Nada. Regra: produto não emite documento fiscal da SB Tech.

## Checklist de pronto

- [ ] Perfil do emissor preenchido no Hub.
- [ ] Toda fatura `paga` tem documento `issued` ou um motivo registrado.

## Erros comuns

| Sintoma | Causa | Correção |
|---|---|---|
| "Preparar" recusa a fatura | Fatura não está `paga` | Aguardar a confirmação do Asaas |
| Nota emitida duas vezes | Emissão manual repetida | Conferir o documento no Hub antes de emitir; ele guarda o número |

## Ainda não implementado

- Emissão automática pela API nacional (`emission_mode = api`). Quando vier, precisa ser idempotente por fatura e nunca reemitir documento `issued`.

## Fonte

- `SBTech-Group/hub-admin`: `supabase/functions/hub-fiscal`; `supabase/migrations/20261003182328_payments_fiscal_core.sql`; `docs/PAYMENTS-FISCAL.md`.
