# ADR-009 — Atividade persistida, foto de perfil e blindagem do Sharp

| Campo       | Valor                               |
|-------------|-------------------------------------|
| **Status**  | Aceito                              |
| **Data**    | 2026-11-12                          |
| **Autor**   | Lucas Ferreira da Silva (RA 129733) |

---

## Contexto

Na análise da entrega final, três pontos ficaram abertos: o "registrar atividade"
da ADR-005 era só uma linha de log; a ADR-007 prometia reaproveitar o serviço de
imagens (por exemplo, para foto de perfil) sem prova no código; e o `image.service`
não limitava o tamanho da imagem decodificada. Dois repositórios de referência
(do professor e de um colega) já resolviam partes disso.

## Decisão

1. **Atividade persistida.** Nova tabela `Activity` (`action`, `details`, `createdAt`)
   e `src/shared/activity.service.js`. Sem relações de propósito: é trilha histórica
   e não some se o usuário ou o restaurante forem excluídos. Gravar é "dispare e siga"
   e nunca derruba a operação principal.
2. **Foto de perfil.** `User.imageUrl` e `POST /auth/me/image`, reaproveitando
   `image.service` com a pasta `profiles`. É a prova do reuso prometido na ADR-007.
3. **Blindagem do Sharp.** `limitInputPixels` de 25 megapixels, `failOn: "warning"`,
   escrita com `wx` e pastas permitidas fixas (`dishes`, `profiles`).
4. **CRUD completo de pratos.** `GET`, `PUT` e `DELETE /dishes/:id`, com a mesma regra
   de posse do restaurante; excluir o prato apaga também a imagem do disco.

## Consequências

**Positivas:** a trilha de atividades é consultável no banco; o serviço de imagens
serve a mais de um caso de uso; uploads maliciosos custam menos memória.

**Negativas:** mais uma tabela e mais uma migration; a trilha ainda não tem rota de
consulta (só SQL); fotos de perfil herdam a limitação de disco local da ADR-007.

## Não adotado

- `imageUrl` obrigatório com `""` (repositório do professor): o campo opcional
  (`null` quando não há imagem) representa melhor "sem imagem".
- E-mail do comercial fixo no código: continua vindo de `COMMERCIAL_EMAIL`.
- Dependência `mailersend` (SDK): o `fetch` nativo segue sendo suficiente (ADR-008).
