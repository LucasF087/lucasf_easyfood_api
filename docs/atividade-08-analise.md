# Atividade 08 — análise do bug e da implementação

## 1. Referência analisada

A análise foi feita comparando o histórico do repositório-base do professor
(`FelipeDiasR/easy-food`) com a implementação atual deste projeto. No histórico,
o commit `70e459efbdc880815f131ebe3e4c92e39efb6270` (mensagem: `fix at creat menu`)
concentra mudanças relacionadas ao cadastro e à autorização de pratos.

## 2. Causa identificada no cadastro do cardápio

O ponto central da correção é o vínculo entre restaurante, usuário proprietário e
pratos. O cadastro de prato não pode depender apenas de um `restaurantId`
recebido na URL: é necessário confirmar que o restaurante existe e que pertence
ao usuário autenticado.

No commit analisado, o modelo `Restaurant` passa a armazenar `ownerId`, com
relacionamento para `User`. As operações de criar, atualizar e remover pratos
passam a receber a identidade do usuário autenticado. O serviço valida os dados,
localiza o restaurante e verifica a propriedade antes de persistir o prato.
Assim, o cadastro fica associado ao restaurante correto e não permite que um
usuário gerencie o cardápio de outro proprietário.

Esta conclusão descreve o problema estrutural evidenciado pelo diff e pelo
histórico do repositório-base; não atribui ao projeto uma mensagem de erro em
tempo de execução que não tenha sido reproduzida.

## 3. Como a solução está organizada neste projeto

- **Autenticação:** o middleware valida o JWT e disponibiliza o usuário em
  `req.user`.
- **Controller de pratos:** recebe o identificador do restaurante e os dados
  validados, encaminhando a operação ao serviço.
- **Service de pratos:** `createDish(restaurantId, data, user)` chama
  `restaurantService.getOwnedRestaurant(restaurantId, user)` antes de criar
  o registro com `restaurantId`.
- **Persistência:** o Prisma grava o prato no PostgreSQL, mantendo a chave
  estrangeira para o restaurante.
- **Autorização:** a mesma regra de propriedade é aplicada às operações
  protegidas de edição, exclusão e upload de imagem.

## 4. Upload de imagens

A implementação também atende ao fluxo de imagens solicitado na atividade:

- `POST /auth/me/image` exige autenticação e recebe o arquivo no campo
  `image`.
- `POST /dishes/:dishId/image` exige autenticação e valida a propriedade do
  restaurante associado ao prato.
- O middleware compartilhado de upload usa Multer para limitar e filtrar o
  arquivo recebido.
- `src/shared/image.service.js` valida o conteúdo real, corrige a orientação,
  redimensiona sem ampliar e converte para WebP.
- Os serviços de autenticação e pratos atualizam `imageUrl` no banco depois de
  salvar a imagem otimizada; em caso de falha na atualização do banco, removem
  o novo arquivo.
- O Express disponibiliza os arquivos pelo caminho `/uploads`, permitindo que
  o endereço persistido seja consultado por HTTP.

## 5. Arquivos principais envolvidos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` e `prisma/migrations/` | Relacionamentos e campos `imageUrl` |
| `src/modules/dishes/dish.controller.js` | Entrada HTTP para operações de pratos |
| `src/modules/dishes/dish.service.js` | Cadastro, validação de propriedade e imagem do prato |
| `src/modules/restaurants/restaurant.service.js` | Consulta e validação do restaurante proprietário |
| `src/modules/auth/auth.middleware.js` | Validação do JWT |
| `src/modules/auth/auth.routes.js` e `auth.controller.js` | Endpoint de foto de perfil |
| `src/modules/auth/auth.service.js` | Persistência do perfil e de `imageUrl` |
| `src/middlewares/upload.js` | Recebimento e validação do arquivo |
| `src/shared/image.service.js` | Processamento e armazenamento compartilhado |
| `src/app.js` | Publicação dos arquivos estáticos em `/uploads` |
| `tests/dishes.test.js` e `tests/profile.test.js` | Testes automatizados dos fluxos |

## 6. Resultado esperado da correção

Com essa organização, o cadastro do prato só ocorre quando o restaurante
existe e pertence ao usuário autenticado. As imagens de perfil e de pratos
passam pelo mesmo serviço de processamento, os caminhos são persistidos no
PostgreSQL e os arquivos resultantes podem ser acessados pelo endereço HTTP
retornado pela API.
