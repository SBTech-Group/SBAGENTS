# Integrações da SB Tech

Um guia por integração, todos no mesmo formato. Cada guia diz **o que o produto precisa fazer** para usar uma capacidade que a casa já tem. Quem implementa é uma pessoa ou o agente `integrador` (`agents/integrador/`).

A regra que vale para todas: **o produto fala com o Hub, o Hub fala com o provedor.** Produto não guarda credencial de Meta, Asaas ou emissor fiscal. As exceções estão escritas no guia de cada integração.

```
Produto ──(token do produto)──▶ Admin Hub ──(credenciais da SB Tech)──▶ Meta · Asaas · Resend · NFS-e
   ▲                                │
   └──────(eventos, mesmo token)────┘
```

## Qual guia usar

| Guia | Use quando | Obrigatória? | Situação no Hub |
|---|---|---|---|
| [`hub.md`](hub.md) | O produto vai ser vendido pelo Hub (catálogo, planos, provisionamento, módulos) | **Sim**, para todo produto do catálogo | Em produção |
| [`whatsapp-meta.md`](whatsapp-meta.md) | O produto envia ou recebe WhatsApp | Não | Em produção (app Meta ainda não publicado) |
| [`pagamentos.md`](pagamentos.md) | Cobrança da SB Tech ao cliente (B2B) ou do cliente ao consumidor final dele | B2B é sempre do Hub; o produto não implementa | B2B em produção (Asaas); consumidor final por produto |
| [`fiscal.md`](fiscal.md) | Nota fiscal de serviço (NFS-e) | Não se aplica ao produto | Manual no Hub |
| [`email.md`](email.md) | O produto precisa mandar e-mail | Não | Convite de provisionamento pelo Hub; transacional por produto |

## Formato de todo guia

Ao escrever ou atualizar um guia, mantenha estas seções, nesta ordem:

1. **Resumo**: o que é e em uma frase o que o produto faz.
2. **Quando usar / quando não usar**.
3. **Arquitetura**: desenho de quem chama quem e onde fica cada dado.
4. **Endpoints**: método, URL, autenticação, corpo e resposta, com exemplo real.
5. **Secrets e variáveis**: só os **nomes**, onde configurar e quem tem o valor. Nunca o valor.
6. **No produto**: tabelas, RLS, funções e telas que o produto precisa ter.
7. **Checklist de pronto**: o que conferir antes de dar como feito.
8. **Erros comuns**: mensagem, causa e correção.
9. **Fonte**: os arquivos de código que comprovam o guia (repo e caminho).

Um guia descreve o que está implementado. O que é plano fica numa seção **Ainda não implementado**, separada.

## Como adicionar uma integração

1. A capacidade existe no Hub (ou em um produto de referência) e funciona.
2. Escreva o guia no formato acima, conferindo cada endpoint e secret no código.
3. Inclua a linha na tabela "Qual guia usar".
4. Se a integração cria regra verificável, adicione em `standards/regras.md` com ID novo.
5. Suba `VERSION` (minor) e registre no `CHANGELOG.md`.
