# E-mail

## Resumo

E-mail na SB Tech sai pelo **Resend**, com remetente do domínio `sbtech-group.com`. O e-mail de **convite do provisionamento** é enviado pelo Hub: o produto só devolve o `invite_link`. E-mail transacional do próprio produto (lembrete, recibo, redefinição de senha) é responsabilidade do produto.

## Quando usar / quando não usar

| Caso | Quem envia |
|---|---|
| Convite do admin do cliente ao provisionar | **Hub** (`hub-provision`) |
| Aviso ao time SB Tech (vencimento, falha) | **Hub** |
| Redefinição de senha e confirmação de conta | Supabase Auth do produto |
| E-mail de negócio do produto (lembrete de reserva, recibo) | Produto, com Resend |

**Não use** `inviteUserByEmail` do Supabase para o convite do provisionamento: use `generateLink({ type: 'invite' })` e devolva o link ao Hub (`hub.md`).

## Arquitetura

```
 hub-provision ──▶ tenant-provision do produto ──▶ { invite_link }
       │
       └──▶ api.resend.com/emails (from: EMAIL_FROM, to: e-mail do cliente)

 Produto (e-mail de negócio) ──▶ Edge Function do produto ──▶ api.resend.com/emails
```

## Endpoints

Resend:

```http
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json

{ "from": "SB Tech <noreply@sbtech-group.com>", "to": "cliente@exemplo.com",
  "subject": "Sua reserva foi confirmada", "html": "<p>…</p>" }
```

Sempre a partir de uma Edge Function (SEC-04), nunca do navegador.

## Secrets e variáveis

| Nome | Onde | Uso |
|---|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Supabase do Hub | Já configurados (convites e avisos) |
| `SYSTEM_ADMIN_EMAIL` ou `ADMIN_EMAILS` | Supabase do Hub | Destino dos avisos internos |
| `RESEND_API_KEY`, `EMAIL_FROM` | Supabase do produto | Só se o produto envia e-mail de negócio |

## No produto

- Rota `/welcome` que recebe o `invite_link` (ver `hub.md`).
- Para e-mail de negócio: uma função de envio, com o HTML em template versionado no repo e identidade SB Tech.

## Checklist de pronto

- [ ] Provisionamento de teste entrega o convite e o link abre `/welcome`.
- [ ] E-mail de negócio (se houver) sai pela função, não pelo frontend.

## Erros comuns

| Sintoma | Causa | Correção |
|---|---|---|
| Convite não chega | `tenant-provision` não devolveu `invite_link`, ou o admin já existia (`invite_link: null`) | Conferir resposta do produto; admin existente recebe só aviso de acesso |
| Link do convite abre a tela de login | `redirectTo` sem `/welcome` ou rota protegida pelo guard | Ajustar `redirectTo` e deixar `/welcome` pública (HUB-02) |

## Fonte

- `SBTech-Group/hub-admin`: `supabase/functions/hub-provision` (envio do convite), `hub-check-vencimentos` (avisos internos).
