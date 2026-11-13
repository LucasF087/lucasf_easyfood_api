# Validação — evidências da entrega

Este arquivo separa o que foi **verificado** do que **depende de você** rodar no seu
ambiente. Nada aqui é estimado: o que não foi executado está marcado como pendente.

## 1. Verificado automaticamente (12/11/2026)

| Verificação | Resultado |
|-------------|-----------|
| `npm test` (`node --test`, Prisma simulado) | 141 testes: 140 passam, 1 é pulado, 0 falham |
| Sintaxe do `scripts/smoke-test.sh` (`bash -n`) | OK |
| Sintaxe do `ci.yml` | YAML válido |

Os testes cobrem, entre outros: CRUD de pratos e regra de posse, upload com Sharp
(800 px, WebP, limite de 25 megapixels, 413/415/400), foto de perfil, e-mail pelo
mesmo `sendEmail` com conteúdos diferentes, atividade persistida e consistência
entre `schema.prisma` e as migrations.

## 2. Pendente — precisa de PostgreSQL / credenciais reais

Marque e anote o resultado depois de rodar.

- [ ] `docker compose up -d` + `npx prisma migrate deploy` aplica as 5 migrations sem erro.
- [ ] `npm run prisma:check` (com `SHADOW_DATABASE_URL`) sem diferenças.
- [ ] `BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh` termina com "tudo certo".
- [ ] `SELECT * FROM "Activity" ORDER BY id DESC LIMIT 5;` mostra `restaurant.created`.
- [ ] E-mail real: com `EMAIL_API_KEY` e `EMAIL_FROM` preenchidos, cadastrar um restaurante e
      conferir a caixa de entrada do dono **e** a do `COMMERCIAL_EMAIL`.
      Resultado: ______ (anexe um print em `docs/img/`).
- [ ] Upload com uma foto **real** de celular: `node scripts/compare-image.js foto.jpg` e
      copiar os números para `docs/atividade-07-comparacao-de-imagens.md`.
- [ ] Imagem acima de 5 MB devolve `413` (teste manual com `curl -F image=@grande.jpg`).
- [ ] `docker build -t easyfood .` conclui (o CI também faz isso).
- [ ] Repositório no GitHub público, com histórico de commits.

## 3. Como registrar uma evidência

Escreva a data, o comando e o resultado real (copie a saída do terminal). Evidência
inventada ou arredondada vale menos que um item pendente.
