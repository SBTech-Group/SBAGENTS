# Arquitetura SBTech para produtos, inst?ncias e integra??es

Este documento ? a refer?ncia operacional para qualquer IA ou pessoa integrar novos produtos ao Hub Admin sem perder governan?a.

## Conceitos oficiais

| Conceito | O que significa | Onde vive |
| --- | --- | --- |
| Cliente | Empresa que compra um ou mais produtos SBTech. | Hub Admin |
| Produto | Sistema vend?vel e provision?vel, normalmente com reposit?rio e Supabase pr?prios por ambiente. | Hub Admin + reposit?rio do produto |
| Plano | Pacote comercial de um produto, formado por m?dulos. | Hub Admin |
| M?dulo | Capacidade vend?vel dentro de um produto. Deve fazer sentido comercialmente. | Produto como fonte de verdade; Hub mant?m cache |
| Inst?ncia do produto | O acesso real entregue ao cliente ap?s comprar um produto. | Hub Admin |
| Ambiente dedicado | Inst?ncia com subdom?nio pr?prio, ex: `cliente.produto.sbtech-group.com`. | Produto multi-tenant |
| Conta em app compartilhado | Inst?ncia onde o cliente entra em um app comum, com conta pr?pria. | Produto compartilhado |
| Integra??o | Conex?o transversal que pode atender v?rios produtos, ex: WhatsApp Meta, Asaas, Mercado Pago, IA. | Hub Admin |

Evite chamar apenas o modelo compartilhado de ?SaaS?. Os dois modelos s?o SaaS; a diferen?a operacional ? se o cliente recebe um ambiente dedicado ou uma conta dentro de um app compartilhado.

## Camadas da arquitetura

```text
Cliente
 ?? Assinatura
     ?? Produto
         ?? Inst?ncia do produto
             ?? M?dulos ativos
             ?? Integra??es conectadas
```

## Responsabilidades do Hub Admin

O Hub Admin ? a fonte de governan?a da SBTech. Ele deve centralizar:

- cadastro de clientes;
- cat?logo de produtos;
- planos e pre?os;
- m?dulos contrat?veis;
- assinaturas;
- provisionamento de inst?ncias;
- status de provisionamento;
- integra??es transversais;
- auditoria;
- faturamento B2B;
- vis?o HML/PRD dos produtos.

Produtos n?o devem decidir cobran?a B2B, plano comercial ou quais m?dulos o cliente comprou. Eles recebem essas decis?es do Hub Admin.

## Responsabilidades de cada produto

Cada produto deve expor, no m?nimo:

| Contrato | Obrigat?rio | Finalidade |
| --- | --- | --- |
| `tenant-provision` ou equivalente | Sim | Criar/atualizar a inst?ncia do cliente. |
| `tenant-modules` ou equivalente | Sim | Informar ao Hub quais m?dulos existem no produto. |
| Health check | Recomendado | Permitir monitoramento central. |
| Integra??o com Hub | Conforme necessidade | Consumir integra??es oficiais sem armazenar secrets do provedor. |

O produto deve ser idempotente: chamar o provisionamento duas vezes para a mesma assinatura n?o pode criar clientes/tenants duplicados.

## Modelos de entrega

### Ambiente dedicado

Use quando o cliente deve ter subdom?nio pr?prio e isolamento claro por tenant.

Exemplo:

```text
demo-meta.arenahub.sbtech-group.com
```

No banco atual do Hub, esse modelo ainda usa `produtos.modelo = 'tenant'` e registros em `tenants_provisionados`.

### Conta em app compartilhado

Use quando o produto ? uma aplica??o ?nica onde cada cliente tem uma conta pr?pria.

No banco atual do Hub, esse modelo ainda usa `produtos.modelo = 'saas'` e registros em `saas_contas`.

### Vis?o unificada

Para governan?a, sempre pense nos dois casos como **inst?ncias do produto**. A view `produto_instancias` unifica os registros atuais sem quebrar compatibilidade.

## Integra??es

Integra??es n?o s?o produtos. Elas s?o capacidades transversais conectadas a uma inst?ncia do produto.

Exemplos:

- WhatsApp oficial Meta;
- Asaas;
- Mercado Pago;
- provedores de IA;
- e-mail transacional.

O padr?o recomendado ?:

```text
Produto ? chama Hub Admin ? Hub Admin chama provedor externo
```

Assim, os produtos n?o precisam armazenar secrets de provedores externos e o Hub mant?m auditoria e governan?a.

## Padr?o para novos produtos

1. Criar o produto no Hub Admin.
2. Definir modelo de entrega: ambiente dedicado ou conta em app compartilhado.
3. Expor endpoint de provisionamento idempotente.
4. Expor endpoint de discovery de m?dulos.
5. Cadastrar planos no Hub usando as chaves de m?dulos descobertas.
6. Testar cria??o de assinatura.
7. Verificar se a inst?ncia aparece em `produto_instancias`.
8. Conectar integra??es necess?rias pelo Hub.

## Nomenclatura recomendada na UI

| Valor t?cnico legado | Nome de UI recomendado |
| --- | --- |
| `tenant` | Ambiente dedicado |
| `saas` | Conta em app compartilhado |
| `tenants_provisionados` | Inst?ncias: ambientes dedicados |
| `saas_contas` | Inst?ncias: contas compartilhadas |
| WhatsApp | Integra??o WhatsApp Meta |

## Evolu??o planejada

Curto prazo:

- usar a view `produto_instancias` para governan?a;
- manter tabelas existentes por compatibilidade;
- padronizar documenta??o e nomes na UI;
- centralizar cat?logo de m?dulos por produto.

M?dio prazo:

- criar configura??o por ambiente (`hml`/`prd`) para endpoint, dom?nio e token;
- criar health check padr?o por produto;
- validar depend?ncias entre m?dulos em planos;
- criar p?gina ?Cliente 360?.

Longo prazo:

- migrar tabelas espec?ficas para uma tabela can?nica `produto_instancias`;
- criar SDK/boilerplate oficial para novos produtos;
- monitorar drift entre Hub e produto.
