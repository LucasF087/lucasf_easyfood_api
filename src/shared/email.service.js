// Camada Shared
// Responsabilidade: serviço GENÉRICO de envio de e-mail. Qualquer módulo
// (restaurantes, pedidos, recuperação de senha...) chama sendEmail() sem saber
// qual provedor está por trás (ADR-008).
//
// Provedor: API HTTP do MailerSend, chamada com o fetch nativo do Node (sem
// dependência nova). Trocar de provedor significa mudar só este arquivo.
//
// Configuração por variáveis de ambiente (ver .env.example):
//   EMAIL_API_KEY    token do provedor (NUNCA versionar)
//   EMAIL_FROM       remetente verificado no provedor
//   EMAIL_FROM_NAME  nome do remetente (padrão: EasyFood)
//
// Sem EMAIL_API_KEY/EMAIL_FROM o serviço continua funcionando em modo
// "não configurado": nada é enviado e o resultado informa { skipped: true }.
// Assim o projeto roda e os testes passam sem nenhuma credencial.

const DEFAULT_API_URL = "https://api.mailersend.com/v1/email";

function read(name) {
  return String(process.env[name] ?? "").trim();
}

function getConfig() {
  return {
    apiKey: read("EMAIL_API_KEY"),
    fromEmail: read("EMAIL_FROM"),
    fromName: read("EMAIL_FROM_NAME") || "EasyFood",
    apiUrl: read("EMAIL_API_URL") || DEFAULT_API_URL,
    timeoutMs: Number(read("EMAIL_TIMEOUT_MS")) || 5000
  };
}

function isConfigured() {
  const { apiKey, fromEmail } = getConfig();
  return Boolean(apiKey && fromEmail);
}

// Dados vindos do usuário (nome do restaurante, por exemplo) entram no HTML
// do e-mail: sem escape, seriam uma porta para injeção de HTML.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Monta o HTML padrão dos e-mails da EasyFood a partir das três partes do
// enunciado: header (título), body (conteúdo) e footer (encerramento).
// Tudo é escapado: o corpo é TEXTO (quebras de linha viram <br>), nunca HTML
// cru — assim nome de restaurante digitado por usuário não injeta HTML.
function buildHtml({ header = "", body = "", footer = "Equipe EasyFood" }) {
  const paragraphs = escapeHtml(body).replace(/\r?\n/g, "<br>");

  return (
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">` +
    `<h2>${escapeHtml(header)}</h2><p>${paragraphs}</p>` +
    `<hr><small>${escapeHtml(footer)}</small></div>`
  );
}

function buildText({ header = "", body = "", footer = "" }) {
  return [header, body, footer].filter(Boolean).join("\n\n");
}

// Serviço GENÉRICO: não sabe para quê o e-mail serve, só recebe as partes.
//
//   to       e-mail do destinatário
//   toName   nome do destinatário (opcional; padrão: o próprio e-mail)
//   subject  assunto
//   header   cabeçalho (título dentro do corpo)
//   body     corpo (conteúdo principal, texto)
//   footer   encerramento (rodapé)
async function sendEmail({ to, toName, subject, header, body, footer }) {
  if (!to || !subject || !header || !body || !footer) {
    throw new Error("sendEmail exige to, subject, header, body e footer");
  }

  if (!isConfigured()) {
    return { sent: false, skipped: true, reason: "provedor de e-mail não configurado" };
  }

  const config = getConfig();

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      from: { email: config.fromEmail, name: config.fromName },
      to: [{ email: to, name: toName || to }],
      subject,
      html: buildHtml({ header, body, footer }),
      text: buildText({ header, body, footer })
    }),
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  // O MailerSend responde 202 Accepted. A mensagem de erro não inclui o corpo
  // da resposta nem a chave, para nada sensível chegar ao log.
  if (!response.ok) {
    throw new Error(`Provedor de e-mail respondeu com status ${response.status}`);
  }

  return { sent: true, skipped: false, status: response.status };
}

module.exports = { isConfigured, buildHtml, buildText, escapeHtml, sendEmail };
