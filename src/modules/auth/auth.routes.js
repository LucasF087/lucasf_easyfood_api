// Camada Routes (auth)
// Responsabilidade: definir os caminhos de autenticação.
//
// O rate limit fica aqui, e não em app.js, porque é uma proteção específica
// das rotas de credencial (/auth/register e /auth/login).

const express = require("express");

const controller = require("./auth.controller");
const authenticate = require("./auth.middleware");
const csrfProtection = require("./csrf.middleware");
const { uploadSingleImage } = require("../../middlewares/upload");
const { createAuthRateLimiter } = require("../../middlewares/rate-limit");

const router = express.Router();

const authRateLimiter = createAuthRateLimiter();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Cria uma conta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Credenciais'
 *               - type: object
 *                 required: [name]
 *                 properties:
 *                   name: { type: string, example: "Aluno EasyFood" }
 *     responses:
 *       201:
 *         description: Conta criada (senha nunca é devolvida)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Usuario' }
 *       400: { description: Dados inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: E-mail já cadastrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       429: { description: Muitas tentativas (rate limit) }
 */
router.post("/register", authRateLimiter, controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autentica e inicia a sessão
 *     description: >
 *       Devolve o token no corpo (para clientes de API) e também o grava em
 *       dois cookies: um httpOnly com o JWT e outro, legível por
 *       JavaScript, com o token CSRF que o front-end deve reenviar no header
 *       X-CSRF-Token em toda chamada POST/PUT/DELETE feita via cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Credenciais' }
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         headers:
 *           Set-Cookie:
 *             description: easyfood_token (httpOnly) e easyfood_csrf
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/Usuario' }
 *       400: { description: Dados inválidos }
 *       401: { description: Credenciais inválidas }
 *       429: { description: Muitas tentativas (rate limit) }
 */
router.post("/login", authRateLimiter, controller.login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Encerra a sessão baseada em cookie
 *     description: Apaga os cookies easyfood_token e easyfood_csrf. Idempotente — não exige estar autenticado.
 *     responses:
 *       204: { description: Cookies apagados }
 */
router.post("/logout", controller.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Confirma quem está autenticado
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Sessão válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/Usuario' }
 *       401: { description: Token ausente, inválido ou expirado }
 */
router.get("/me", authenticate, controller.me);

/**
 * @openapi
 * /auth/me/image:
 *   post:
 *     tags: [Auth]
 *     summary: Envia a foto de perfil (otimizada para WebP, até 800 px de largura)
 *     description: JPEG, PNG ou WebP, até 5 MB e 25 megapixels. A foto anterior é removida.
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: X-CSRF-Token
 *         required: false
 *         description: Obrigatório apenas quando a autenticação é por cookie.
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       200: { description: "Foto salva; devolve o perfil (com imageUrl) e, em image, os tamanhos antes/depois" }
 *       400: { description: Sem arquivo ou arquivo que não é imagem }
 *       401: { description: Não autenticado }
 *       413: { description: Imagem acima de 5 MB }
 *       415: { description: Tipo de arquivo não suportado }
 */
router.post("/me/image", authenticate, csrfProtection, uploadSingleImage, controller.uploadImage);

module.exports = router;
