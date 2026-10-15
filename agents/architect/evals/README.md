# Avaliação do architect

Gabarito para saber se uma mudança no prompt ou no padrão melhorou ou piorou o agente.

## Como avaliar

1. Rode o architect em modo DIAGNÓSTICO num repo deste gabarito, no commit indicado.
2. Compare os IDs de regra encontrados com os esperados abaixo.
3. Registre: encontrados corretamente, falsos positivos (achou o que não é) e faltantes.

Meta da fase 0: pelo menos 80% dos esperados encontrados e nenhum falso positivo bloqueante.

## Casos

Linha de base em `../../../diagnosticos/2026-10-14/`, feita com verificação manual assistida. Os achados marcados como confirmados viram gabarito depois que o dono do produto revisar.

| Repo | Commit | Regras que devem aparecer | Regras que não devem aparecer |
|---|---|---|---|
| Promobot | `45a0bf4` | SEC-01, SEC-02, MT-01, MT-03, DOC-01, DOC-02, GIT-01, GIT-02, TST-01 | MT-02 (é saas), MT-05 |
| Admin Hub | `2208ddd` | SEC-02, SEC-06, GIT-02, DOC-01, DOC-03, FE-01 | MT-01 (RLS via laço), SEC-05 (corrigido), MT-02, MT-04, HUB-01 (é interno), FE-02 |
| ArenaHub HML | `58ffbf0` | MT-06 (2 achados), MT-05, FE-02, GIT-01, DOC-01, DOC-02, TST-01 | SEC-01, HUB-01, HUB-02 |

Os achados SEC-01 e SEC-02 dependem do estado local (`.env`, `dist/`, arquivos não rastreados): numa cópia limpa do GitHub eles não aparecem. Avalie na mesma pasta.
