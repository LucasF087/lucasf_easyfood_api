// Camada Shared
// Responsabilidade: otimizar e gravar imagens. É genérico de propósito — serve
// para pratos hoje e para logotipos ou fotos de perfil amanhã (ver ADR-007).
//
// Fluxo: recebe o arquivo em memória (Buffer) -> confirma que é imagem de
// verdade -> corrige a orientação (EXIF) -> reduz para até 800 px de largura
// (nunca amplia) -> converte para WebP -> grava com nome único -> devolve o
// caminho público.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const sharp = require("sharp");

const { badRequest } = require("./http-error");

const MAX_WIDTH = 800;
// Blindagem do Sharp (ideia do repositório do colega João): recusa imagens com
// mais de 25 megapixels (um PNG pequeno em disco pode virar gigabytes em
// memória — "decompression bomb") e trata avisos de decodificação como erro.
const MAX_INPUT_PIXELS = 25_000_000;
// Pastas aceitas: pratos hoje, fotos de perfil também (ADR-007 prometia o reuso).
const ALLOWED_FOLDERS = new Set(["dishes", "profiles"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
// Só nomes gerados por este serviço são aceitos na remoção (evita path traversal).
const GENERATED_NAME = /^[0-9a-f-]{36}\.webp$/;

// Lido a cada chamada para que testes e deploys possam mudar a pasta.
function uploadsRoot() {
  return path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, "..", "..", "uploads"));
}

function webpQuality() {
  const value = Number(process.env.IMAGE_QUALITY);
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 80;
}

async function optimizeAndSave(buffer, { folder = "dishes" } = {}) {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error(`Pasta de imagem inválida: ${folder}`);
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw badRequest("Arquivo de imagem vazio");
  }

  let optimized;

  try {
    // O mimetype enviado pelo cliente pode mentir; o formato real vem do conteúdo.
    const input = () => sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" });
    const metadata = await input().metadata();

    if (!ALLOWED_FORMATS.has(metadata.format)) {
      throw new Error("formato não permitido");
    }

    optimized = await input()
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: webpQuality() })
      .toBuffer();
  } catch {
    throw badRequest("O arquivo enviado não é uma imagem válida (use JPEG, PNG ou WebP, até 25 megapixels)");
  }

  const fileName = `${crypto.randomUUID()}.webp`;
  const directory = path.join(uploadsRoot(), folder);

  await fs.mkdir(directory, { recursive: true });
  // flag "wx": falha se o arquivo já existir, nunca sobrescreve outra imagem.
  await fs.writeFile(path.join(directory, fileName), optimized, { flag: "wx" });

  return {
    url: `/uploads/${folder}/${fileName}`,
    originalBytes: buffer.length,
    optimizedBytes: optimized.length
  };
}

// Apaga uma imagem antiga (troca de imagem do prato). Falhas aqui nunca
// devem derrubar a requisição: no pior caso sobra um arquivo órfão.
async function removeImage(url, { folder = "dishes" } = {}) {
  if (typeof url !== "string" || !ALLOWED_FOLDERS.has(folder)) return;

  const prefix = `/uploads/${folder}/`;
  if (!url.startsWith(prefix)) return;

  const fileName = url.slice(prefix.length);
  if (!GENERATED_NAME.test(fileName)) return;

  try {
    await fs.unlink(path.join(uploadsRoot(), folder, fileName));
  } catch {
    // arquivo já não existe: nada a fazer
  }
}

module.exports = { MAX_WIDTH, MAX_INPUT_PIXELS, ALLOWED_FOLDERS, uploadsRoot, optimizeAndSave, removeImage };
