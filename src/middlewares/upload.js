// Camada Middleware
// Responsabilidade: receber UM arquivo de imagem (multipart/form-data) em
// memória, com tipo e tamanho limitados, e traduzir os erros do Multer para os
// erros HTTP padrão do projeto.
//
// Limite: 5 MB. Tipos: JPEG, PNG e WebP. O campo do formulário se chama "image".

const multer = require("multer");

const { badRequest, payloadTooLarge, unsupportedMediaType } = require("../shared/http-error");

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(unsupportedMediaType("Tipo de arquivo não suportado. Use JPEG, PNG ou WebP"));
    }

    callback(null, true);
  }
}).single("image");

function uploadSingleImage(req, res, next) {
  uploader(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(payloadTooLarge("Imagem acima do limite de 5 MB"));
      }

      return next(badRequest("Envio de arquivo inválido: use um único arquivo no campo \"image\""));
    }

    next(error);
  });
}

module.exports = { uploadSingleImage, MAX_FILE_BYTES, ALLOWED_MIME_TYPES };
