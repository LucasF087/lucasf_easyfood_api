// Compara uma imagem original com a versão otimizada pela EasyFood
// (Atividade 7, Parte 15). Usa o MESMO serviço da API (image.service.js).
//
// Uso:  node scripts/compare-image.js caminho/da/foto.jpg
//
// Não precisa de banco nem de servidor: grava a imagem otimizada numa pasta
// temporária e imprime formato, tamanho e dimensões das duas versões.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sharp = require("sharp");

const arquivo = process.argv[2];

if (!arquivo || !fs.existsSync(arquivo)) {
  console.error("Uso: node scripts/compare-image.js <caminho-da-imagem>");
  process.exit(1);
}

process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "easyfood-compare-"));

const { optimizeAndSave } = require("../src/shared/image.service");

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

(async () => {
  const buffer = fs.readFileSync(arquivo);
  const antes = await sharp(buffer).metadata();
  const saved = await optimizeAndSave(buffer, { folder: "dishes" });
  const arquivoFinal = path.join(process.env.UPLOADS_DIR, saved.url.replace("/uploads/", ""));
  const depois = await sharp(arquivoFinal).metadata();

  console.log("Imagem original:");
  console.log(`  Formato:    ${antes.format}`);
  console.log(`  Tamanho:    ${kb(saved.originalBytes)} (${saved.originalBytes} bytes)`);
  console.log(`  Dimensões:  ${antes.width} x ${antes.height} px`);
  console.log("Imagem otimizada:");
  console.log(`  Formato:    ${depois.format}`);
  console.log(`  Tamanho:    ${kb(saved.optimizedBytes)} (${saved.optimizedBytes} bytes)`);
  console.log(`  Dimensões:  ${depois.width} x ${depois.height} px`);
  console.log(`Redução: ${(100 - (saved.optimizedBytes / saved.originalBytes) * 100).toFixed(1)}%`);

  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
})();
