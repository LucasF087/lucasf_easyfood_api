// Camada Service (notifications)
// Responsabilidade: as três reações previstas no cenário da ADR-005 quando um
// restaurante é cadastrado:
//   1) e-mail de boas-vindas ao dono;
//   2) registro de atividade PERSISTIDO no banco (tabela Activity);
//   3) aviso ao time comercial, pela MESMA função sendEmail (serviço genérico
//      da ADR-008): só mudam destinatário, assunto, header, body e footer.
//
// Sem provedor de e-mail configurado (EMAIL_API_KEY + EMAIL_FROM), os dois
// e-mails viram simulação em log — o projeto roda e os testes passam sem
// credenciais. Com provedor, os dois são enviados de verdade.
//
// O destinatário do aviso comercial vem de COMMERCIAL_EMAIL; o padrão usa o
// domínio reservado ".example", que não existe na internet (nada de e-mail
// pessoal fixo no código).
//
// Se/quando a decisão da ADR-005 for revista (eventos, fila, broker), este é
// o módulo que passa a ser um consumidor de `restaurant.created` em vez de
// ser chamado diretamente pelo Restaurant Service.

const logger = require("../../shared/logger");
const emailService = require("../../shared/email.service");
const activityService = require("../../shared/activity.service");

const DEFAULT_COMMERCIAL_EMAIL = "comercial@easyfood.example";

// Lido a cada chamada (e não no carregamento do módulo) para que testes e
// ambientes possam ligar/desligar sem reiniciar o processo.
function isEnabled() {
  const raw = String(process.env.NOTIFICATIONS_ENABLED ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

function commercialEmail() {
  const configured = String(process.env.COMMERCIAL_EMAIL ?? "").trim();
  return configured || DEFAULT_COMMERCIAL_EMAIL;
}

function simulate(action, payload) {
  if (!isEnabled()) {
    return { action, skipped: true };
  }

  logger.info(`[simulação] ${action}`, payload);

  return { action, skipped: false, payload };
}

// Envia (ou simula) um e-mail pelo serviço compartilhado. "Dispare e siga":
// o cadastro NÃO espera o provedor e uma falha dele só vira linha de log.
function dispatchEmail(action, message) {
  if (!isEnabled()) {
    return { action, skipped: true };
  }

  if (!emailService.isConfigured()) {
    return simulate(action, {
      to: message.to,
      assunto: message.subject,
      corpo: message.body
    });
  }

  emailService
    .sendEmail(message)
    .then(() => logger.info(`E-mail enviado (${action})`, { to: message.to }))
    .catch((error) => {
      logger.error(`Falha ao enviar o e-mail (${action})`, { to: message.to, motivo: error?.message });
    });

  return { action, skipped: false, async: true };
}

// 1) E-mail de boas-vindas para quem cadastrou o restaurante.
function sendWelcomeEmail({ to, name, restaurantName }) {
  return dispatchEmail("email.boas-vindas", {
    to,
    toName: name ?? to,
    subject: `Bem-vindo(a) à EasyFood, ${name ?? "parceiro(a)"}!`,
    header: "Bem-vindo(a) à EasyFood",
    body: `O restaurante "${restaurantName}" foi cadastrado com sucesso.`,
    footer: "Equipe EasyFood"
  });
}

// 2) Registro de atividade: linha persistida na tabela Activity.
// Não espera o banco (dispare e siga) e nunca lança: ver activity.service.
function registerActivity({ action, restaurantId, restaurantName, userId }) {
  if (!isEnabled()) {
    return { action: "atividade.registrada", skipped: true };
  }

  activityService.log(action, {
    restaurantId,
    restaurantName,
    userId: userId ?? null
  });

  return { action: "atividade.registrada", skipped: false, persisted: true, async: true };
}

// 3) Aviso ao time comercial — MESMA função sendEmail, outro conteúdo.
function notifyCommercialTeam({ restaurantId, restaurantName, category, ownerEmail }) {
  const to = commercialEmail();

  return dispatchEmail("comercial.novo-restaurante", {
    to,
    toName: "Time comercial EasyFood",
    subject: `Novo restaurante cadastrado: ${restaurantName}`,
    header: "Novo restaurante na plataforma",
    body:
      `Restaurante: ${restaurantName} (id ${restaurantId})\n` +
      `Categoria: ${category ?? "não informada"}\n` +
      `Responsável: ${ownerEmail ?? "não informado"}`,
    footer: "Aviso automático da EasyFood"
  });
}

// Orquestra as três reações do cenário da ADR-005.
//
// Uma falha em qualquer uma delas NÃO pode derrubar o cadastro do
// restaurante, que já foi gravado no banco. Essa é justamente a consequência
// negativa registrada na ADR-005: com chamada direta e síncrona, quem chama
// precisa se proteger sozinho de quem é chamado.
function notifyRestaurantCreated({ restaurant, owner }) {
  const results = [];

  try {
    results.push(
      registerActivity({
        action: "restaurant.created",
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        userId: owner?.id
      })
    );

    if (owner?.email) {
      results.push(
        sendWelcomeEmail({
          to: owner.email,
          name: owner.name,
          restaurantName: restaurant.name
        })
      );
    }

    results.push(
      notifyCommercialTeam({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        category: restaurant.category,
        ownerEmail: owner?.email
      })
    );
  } catch (error) {
    logger.error("Falha ao notificar o cadastro do restaurante", {
      restauranteId: restaurant?.id,
      motivo: error?.message
    });
  }

  return results;
}

module.exports = {
  DEFAULT_COMMERCIAL_EMAIL,
  isEnabled,
  commercialEmail,
  sendWelcomeEmail,
  registerActivity,
  notifyCommercialTeam,
  notifyRestaurantCreated
};
