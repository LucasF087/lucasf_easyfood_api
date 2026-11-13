// Camada Routes
// Responsabilidade: caminhos do cardápio e middlewares de cada um.
// Montado na raiz do app (app.use(dishRoutes)) porque os caminhos começam em
// /restaurants/... e /dishes/....

const express = require("express");

const controller = require("./dish.controller");
const authenticate = require("../auth/auth.middleware");
const csrfProtection = require("../auth/csrf.middleware");
const { uploadSingleImage } = require("../../middlewares/upload");

const router = express.Router();

/**
 * @openapi
 * /restaurants/{restaurantId}/dishes:
 *   get:
 *     tags: [Cardápio]
 *     summary: Lista o cardápio de um restaurante (público)
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Pratos do restaurante, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Prato' } } } } }
 *       404: { description: Restaurante não encontrado }
 */
router.get("/restaurants/:restaurantId/dishes", controller.list);

/**
 * @openapi
 * /restaurants/{restaurantId}/dishes:
 *   post:
 *     tags: [Cardápio]
 *     summary: Cadastra um prato (só o dono do restaurante)
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: X-CSRF-Token
 *         required: false
 *         description: Obrigatório apenas quando a autenticação é por cookie.
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NovoPrato' }
 *     responses:
 *       201: { description: Criado, content: { application/json: { schema: { $ref: '#/components/schemas/Prato' } } } }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autenticado }
 *       403: { description: Não é o dono do restaurante }
 *       404: { description: Restaurante não encontrado }
 */
router.post("/restaurants/:restaurantId/dishes", authenticate, csrfProtection, controller.create);

/**
 * @openapi
 * /dishes/{dishId}:
 *   get:
 *     tags: [Cardápio]
 *     summary: Busca um prato pelo id (público)
 *     parameters:
 *       - in: path
 *         name: dishId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: O prato, content: { application/json: { schema: { $ref: '#/components/schemas/Prato' } } } }
 *       400: { description: Identificador inválido }
 *       404: { description: Prato não encontrado }
 *   put:
 *     tags: [Cardápio]
 *     summary: Atualiza nome, descrição e preço do prato (só o dono do restaurante)
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: dishId
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: X-CSRF-Token
 *         required: false
 *         description: Obrigatório apenas quando a autenticação é por cookie.
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NovoPrato' }
 *     responses:
 *       200: { description: Prato atualizado, content: { application/json: { schema: { $ref: '#/components/schemas/Prato' } } } }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autenticado }
 *       403: { description: Não é o dono do restaurante }
 *       404: { description: Prato não encontrado }
 *   delete:
 *     tags: [Cardápio]
 *     summary: Exclui o prato e a imagem dele (só o dono do restaurante)
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: dishId
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: X-CSRF-Token
 *         required: false
 *         description: Obrigatório apenas quando a autenticação é por cookie.
 *         schema: { type: string }
 *     responses:
 *       204: { description: Excluído }
 *       401: { description: Não autenticado }
 *       403: { description: Não é o dono do restaurante }
 *       404: { description: Prato não encontrado }
 */
router.get("/dishes/:dishId", controller.show);
router.put("/dishes/:dishId", authenticate, csrfProtection, controller.update);
router.delete("/dishes/:dishId", authenticate, csrfProtection, controller.remove);

/**
 * @openapi
 * /dishes/{dishId}/image:
 *   post:
 *     tags: [Cardápio]
 *     summary: Envia a imagem do prato (otimizada para WebP, até 800 px de largura)
 *     description: JPEG, PNG ou WebP, até 5 MB. Só o dono do restaurante pode enviar.
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: dishId
 *         required: true
 *         schema: { type: integer }
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
 *       200: { description: "Imagem salva; devolve o prato (com imageUrl) e, no campo extra image, os tamanhos antes/depois", content: { application/json: { schema: { $ref: '#/components/schemas/Prato' } } } }
 *       400: { description: Sem arquivo ou arquivo que não é imagem }
 *       401: { description: Não autenticado }
 *       403: { description: Não é o dono do restaurante }
 *       404: { description: Prato não encontrado }
 *       413: { description: Imagem acima de 5 MB }
 *       415: { description: Tipo de arquivo não suportado }
 */
router.post("/dishes/:dishId/image", authenticate, csrfProtection, uploadSingleImage, controller.uploadImage);

module.exports = router;
