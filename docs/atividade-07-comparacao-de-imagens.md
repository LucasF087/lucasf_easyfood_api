# Atividade 7 — Parte 15: comparação entre a imagem original e a otimizada

Medição feita com `scripts/compare-image.js`, que chama o **mesmo**
`image.service.js` usado pela API (redimensiona para até 800 px de largura,
corrige a orientação e converte para WebP com qualidade 80). A API também
devolve `originalBytes` e `optimizedBytes` na resposta de
`POST /dishes/:dishId/image`.

> **Como reproduzir com a sua própria foto:**
> `node scripts/compare-image.js caminho/da/foto.jpg`
> e substitua os números da tabela abaixo pelos da sua foto de prato.

## Medições

| | Foto grande (exemplo) | Imagem pequena (contra-exemplo) |
|---|---|---|
| **Original — formato** | JPEG | JPEG |
| **Original — tamanho** | 3925,0 KB (4.019.153 bytes) | 1,9 KB (1.902 bytes) |
| **Original — dimensões** | 4000 × 3000 px | 300 × 200 px |
| **Otimizada — formato** | WebP | WebP |
| **Otimizada — tamanho** | 12,0 KB (12.274 bytes) | 3,4 KB (3.474 bytes) |
| **Otimizada — dimensões** | 800 × 600 px | 300 × 200 px |
| **Variação** | −99,7% | +82,6% (ficou maior) |

**Atenção ao ler os números:** as duas imagens foram **geradas por código**
(uma "foto" sintética de 4000×3000 e uma imagem pequena de baixa qualidade)
porque este repositório não inclui fotos reais. A redução de 99,7% é
exagerada: fotos reais de pratos têm muito mais detalhe e costumam cair
algo na faixa de 70% a 95%. Rode o script com uma foto de celular para
registrar o valor real.

## Respostas

**1. A imagem otimizada ficou menor?**
No caso da foto grande, sim: de ~3,9 MB para ~12 KB. No caso da imagem
pequena, não: ela cresceu de 1,9 KB para 3,4 KB.

**2. Qual transformação foi realizada?**
Dois passos: (a) **redimensionamento** de 4000 px para 800 px de largura
(`resize({ width: 800, withoutEnlargement: true })`, mantendo a proporção e
sem ampliar imagens menores) e (b) **conversão de formato** de JPEG/PNG para
WebP com qualidade 80. Antes disso, `rotate()` aplica a orientação EXIF.

**3. Por que isso melhora a experiência do usuário?**
Arquivos menores transferem mais rápido, a página do cardápio abre antes e o
cliente gasta menos franquia de dados no celular. Também reduz o custo de
armazenamento e de banda do servidor.

**4. O arquivo sempre ficará menor?**
Não. O resultado depende da imagem original e da configuração: uma imagem
já pequena e muito comprimida pode crescer ao ser recodificada em WebP com
qualidade 80, como mostra a coluna da direita. O redimensionamento é o que
mais pesa na redução; quando não há o que reduzir (largura ≤ 800 px), o
ganho some e pode virar perda.

## Falha no upload não apaga o prato

Se o envio da imagem falhar (arquivo que não é imagem, acima de 5 MB, sem
arquivo), o prato **continua cadastrado**, sem imagem, e o usuário pode tentar
de novo. Isso é verificado em `tests/dishes.test.js` (teste "falha no upload
NÃO apaga o prato"). É o mesmo princípio da Atividade 6: uma falha em uma
operação secundária não invalida a operação principal já concluída.

## Formato da resposta do upload

`POST /dishes/:dishId/image` responde `200` com o **prato direto**, como mostra o
enunciado: `{ "id": 1, "name": "...", "imageUrl": "/uploads/dishes/<uuid>.webp", ... }`.
Os tamanhos usados na comparação acima vêm num campo extra, `image`
(`{ "originalBytes": ..., "optimizedBytes": ... }`), que não atrapalha quem lê só o
prato. (Até a V5 o prato vinha dentro de `dish`; mudou na entrega final.)
