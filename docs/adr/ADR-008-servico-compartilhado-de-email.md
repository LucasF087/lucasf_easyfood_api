# ADR-008 — Serviço compartilhado de e-mail com provedor externo (MailerSend)

| Campo       | Valor                      |
|-------------|----------------------------|
| **Status**  | Aceito                     |
| **Data**    | 2026-11-12                 |
| **Autor**   | Lucas Ferreira da Silva (RA 129733) |

---

## Contexto

A [ADR-005](./ADR-005-comunicacao-direta-sem-eventos.md) previu o e-mail de boas-vindas após o cadastro de um restaurante, mas o envio era apenas **simulado com log**. Outros módulos também precisarão enviar e-mails (pedidos, recuperação de senha). Cada módulo implementar o seu próprio envio duplicaria código e espalharia a dependência do provedor.

---

## Alternativas consideradas

1. Cada módulo chama o provedor diretamente.
2. **Serviço compartilhado `email.service.js`** (módulo `shared`) chamado pelos módulos.
3. SMTP com Nodemailer.
4. Fila/eventos com consumidor dedicado de e-mail (adiado pela ADR-005).

---

## Decisão

Criar [`src/shared/email.service.js`](../../src/shared/email.service.js), um serviço **genérico** (`sendEmail({ to, toName, subject, header, body, footer })`, que monta o HTML internamente com `buildHtml` — conteúdo sempre escapado), que fala com a **API HTTP do MailerSend** usando o `fetch` nativo — sem dependência nova. O Restaurant Service continua independente: o e-mail de boas-vindas é disparado de forma **não bloqueante**; se falhar, apenas gera uma linha de log e o cadastro permanece válido.

Configuração por variáveis de ambiente (`EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`). **Sem elas, nada é enviado** e o sistema continua simulando com log, como na ADR-005.

---

## Justificativa

- **Reuso:** um único ponto de integração para todos os módulos.
- **Troca de provedor localizada:** mudar de MailerSend para outro afeta só um arquivo.
- **API HTTP em vez de SMTP:** exige apenas um token; não depende de uma conta pessoal de e-mail.
- **Segurança:** a chave vem do ambiente e nunca do código; mensagens de erro e logs não incluem o token; o conteúdo vindo do usuário é escapado no HTML.
- **Projeto roda sem credenciais:** bom para desenvolvimento, testes e CI.

---

## Consequências

### Positivas

- Código de e-mail centralizado e testado com `fetch` simulado (sem envio real).
- Falha do provedor não derruba o cadastro.

### Negativas

- Dependência de um serviço externo e de uma conta verificada no provedor.
- **Sem reenvio automático:** se o provedor estiver fora do ar, o e-mail é perdido (apenas registrado em log).
- O disparo continua acoplado ao Restaurant Service (consequência herdada da ADR-005).

---

## Critérios de revisão

- Necessidade de garantia de entrega ou reenvio → fila/eventos (retomar a ADR-005).
- Aumento de volume ou de tipos de e-mail → templates dedicados.
- Mudança de provedor, preço ou limites do plano.

## Atualização (nov/2026)

- A assinatura passou a ser exatamente a do enunciado: `to`, `toName`, `subject`,
  `header`, `body` e `footer`. O chamador não monta HTML.
- A **mesma função** envia os dois e-mails do cadastro de restaurante: boas-vindas
  ao dono e aviso ao time comercial (`COMMERCIAL_EMAIL`). Só o conteúdo muda.
- Sem `EMAIL_API_KEY`/`EMAIL_FROM`, ambos continuam só simulados em log.
