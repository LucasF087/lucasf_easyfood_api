# ADR-007 — Processar as imagens dos pratos dentro da API (sem Serverless/FaaS por ora)

| Campo       | Valor                      |
|-------------|----------------------------|
| **Status**  | Aceito                     |
| **Data**    | 2026-11-12                 |
| **Autor**   | Lucas Ferreira da Silva (RA 129733) |

---

## Contexto

Com o cardápio (`dishes`), o restaurante passa a enviar uma imagem para cada prato. Fotos de celular chegam com vários MB e milhares de pixels de largura; entregá-las como estão deixa a página lenta e consome dados do cliente. Por isso a imagem precisa ser **reduzida e comprimida antes de ser disponibilizada**.

A pergunta arquitetural é: **onde esse processamento deve rodar?** O fluxo é: restaurante → upload → processamento → imagem otimizada.

---

## Alternativas consideradas

1. **Processar dentro da API EasyFood** (módulo `dishes` + serviço compartilhado `image.service.js`, com Multer e Sharp).
2. **Serviço independente de processamento** (um segundo processo/aplicação só para imagens, comunicando-se com a API).
3. **Função Serverless/FaaS** disparada por evento de upload em um storage de objetos (por exemplo, AWS Lambda + S3).

---

## Decisão

Adotar a **alternativa 1**: a API recebe o arquivo em memória (Multer, até 5 MB, JPEG/PNG/WebP), o `image.service.js` corrige a orientação, reduz para **até 800 px de largura** (sem ampliar), converte para **WebP** e grava em `uploads/dishes/` com nome único (UUID). O caminho fica em `Dish.imageUrl`.

---

## Justificativa

- **Simplicidade:** reaproveita a infraestrutura que já existe (um monólito modular, um processo, um deploy).
- **Baixo volume inicial:** o projeto está em fase acadêmica, com poucas imagens por dia.
- **Menos componentes:** não exige fila, storage de objetos, conta em provedor de nuvem nem configuração de permissões.
- **Facilidade de implementação e de teste:** tudo roda localmente e nos testes automatizados.
- **Reuso:** o `image.service.js` é genérico e poderá atender logotipos de restaurantes e fotos de perfil.

---

## Consequências

### Positivas

- Resposta imediata: ao fim do upload, a imagem já está otimizada e referenciada.
- Nenhuma dependência de provedor externo.
- Validação em duas camadas: tipo/tamanho no Multer e conteúdo real da imagem no Sharp (um arquivo que só *diz* ser PNG é recusado).

### Negativas

- **Consumo de CPU e memória da API:** o Sharp roda no mesmo processo que atende as demais requisições.
- **Impacto em outras requisições** se muitos uploads simultâneos acontecerem.
- **Armazenamento em disco local:** em hospedagens com disco efêmero (ou com mais de uma instância) as imagens se perdem ou ficam inconsistentes; seria necessário um storage externo.
- O usuário espera o processamento terminar (resposta síncrona).

---

## Análise por cenário

A mesma pergunta pode ter respostas diferentes conforme o volume e a exigência de
tempo. Atributos considerados: escalabilidade, desempenho (latência), custo,
manutenibilidade e dependência de tecnologia.

| Cenário | Melhor opção | Por quê |
|---|---|---|
| **A — poucas imagens por dia** | **Dentro da API** (a decisão deste ADR) | O custo de CPU é desprezível; zero componentes novos, zero custo extra e fácil de manter. Serverless só acrescentaria configuração e dependência de provedor. |
| **B — milhares de imagens, com picos de upload** | **Serverless/FaaS** (ou serviço independente com fila) | Os picos competiriam por CPU/memória com as demais rotas da API. FaaS escala sob demanda e cobra por uso. O preço é cold start, limites de execução e dependência do provedor. |
| **C — imagem disponível imediatamente após o envio** | **Dentro da API (síncrono)** | A resposta só volta quando a imagem já está pronta. Com FaaS assíncrono haveria uma janela (e o cold start) em que a imagem ainda não existe, exigindo estado "processando" na interface. |

Resumo: o cenário A é o contexto real do projeto; o B é o gatilho de revisão
(critérios 1 e 4 abaixo); o C é o argumento a favor de manter o fluxo síncrono
enquanto o volume permitir.

---

## Critérios de revisão

Reavaliar esta decisão se:

1. o volume de imagens crescer a ponto de afetar o tempo de resposta das demais rotas;
2. a API passar a rodar em mais de uma instância ou em disco efêmero;
3. surgirem outros tipos de processamento pesado (vídeo, PDFs);
4. houver necessidade de processamento assíncrono (o usuário não precisar esperar).

Nesses casos, avaliar o serviço independente ou Serverless/FaaS com storage de objetos.

---

## Plano de armazenamento persistente (atualização de nov/2026)

O risco acima — disco efêmero perde as imagens — agora tem plano explícito:

1. **Agora (entrega):** as imagens ficam em disco local, na pasta de `UPLOADS_DIR`
   (`uploads/dishes` e `uploads/profiles`). Em hospedagem, `UPLOADS_DIR` aponta para
   um **disco/volume persistente** (`/data/uploads` no `render.yaml`; volume
   `easyfood-uploads` no `docker run`). Passo a passo em [`docs/deploy.md`](../deploy.md).
2. **Gatilho para mudar:** mais de uma instância da API, ou hospedagem sem disco
   persistente. Disco local não é compartilhado entre instâncias.
3. **Depois:** trocar apenas o *destino* de gravação por armazenamento de objetos
   (S3 / Cloudflare R2). Como `optimizeAndSave` e `removeImage` são os únicos
   pontos que tocam o disco, a troca fica dentro de `image.service.js`; o banco
   continua guardando só a URL pública.

Também mudou desde a decisão original: o serviço é reaproveitado para a **foto de
perfil** (pasta `profiles`, ver [ADR-009](./ADR-009-atividade-persistida-e-foto-de-perfil.md)) e foi
blindado — recusa imagens com mais de 25 megapixels (`limitInputPixels`), trata
avisos de decodificação como erro (`failOn: "warning"`), só aceita as pastas
`dishes` e `profiles` e grava com a flag `wx` (nunca sobrescreve um arquivo).

---

## Notas

Esta decisão **não significa que Serverless seja inadequado**: significa que, neste contexto (acadêmico, baixo volume, simplicidade), o custo de operar mais componentes supera o benefício. FaaS continua sendo uma boa opção para cenários de pico de upload, com cobrança por uso — ao custo de *cold start*, limites de execução e dependência do provedor.

Implementação: [`image.service.js`](../../src/shared/image.service.js), [`upload.js`](../../src/middlewares/upload.js) e o módulo [`dishes`](../../src/modules/dishes/).
