import nodemailer from 'nodemailer';
import { isNonReceivingEmailDomain } from '@/lib/invalid-email-domains';
import { SUPPORT_WHATSAPP_HREF } from '@/lib/support-links';

const BASE_URL = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';

type NotificationEntry = { enabled?: boolean; to?: string };
type NotificationMap = Record<string, NotificationEntry>;

function getNotificationMap(): NotificationMap {
  const raw = process.env.EMAIL_NOTIFICATIONS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as NotificationMap;
  } catch {
    // ignore invalid JSON
  }
  return {};
}

function getTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10) || 587;
  const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureRaw === 'true' || secureRaw === '1';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const auth = user && pass ? { user, pass } : undefined;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });
}

function getFrom(): string {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER?.trim();
  if (user) return user;
  return 'noreply@localhost';
}

let transportCache: nodemailer.Transporter | null | undefined = undefined;

function getTransportCached(): nodemailer.Transporter | null {
  if (transportCache === undefined) transportCache = getTransport();
  return transportCache;
}

type Attachment = { filename: string; content: Buffer };

function maskEmailForLog(email: string): string {
  const [local, host] = email.split('@');
  if (!host) return '***';
  const maskedLocal = local.length <= 2 ? '***' : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${host}`;
}

async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransportCached();
  if (!transport) {
    console.warn('Email not sent: SMTP not configured (SMTP_HOST required).');
    return { ok: false, error: 'Email service not configured' };
  }
  const from = getFrom();
  try {
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({ filename: a.filename, content: a.content })) ?? [],
    });
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    const response = err && typeof err === 'object' && 'response' in err ? (err as { response: string }).response : '';
    console.error('[SMTP] Send failed:', message, code ? `(code: ${code})` : '', response ? `response: ${String(response).slice(0, 200)}` : '');
    if (err instanceof Error && err.stack) console.error(err.stack);
    return { ok: false, error: message };
  }
}

/**
 * Sends a password reset email with a one-time link.
 * Requires SMTP env (SMTP_HOST, etc.) and EMAIL_NOTIFICATIONS["password_reset"].enabled === true.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const map = getNotificationMap();
  if (map['password_reset']?.enabled !== true) {
    return { ok: false, error: 'Notification disabled by configuration' };
  }
  const transport = getTransportCached();
  if (!transport) {
    console.warn('Email not sent: SMTP not configured.');
    return { ok: false, error: 'Email service not configured' };
  }

  const resetLink = `${BASE_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `
    <p>Recibiste este correo porque solicitaste restablecer tu contraseña.</p>
    <p><a href="${resetLink}" style="color: #0f0f0f; font-weight: 600;">Restablecer contraseña</a></p>
    <p>Si no solicitaste este cambio, puedes ignorar este mensaje. El enlace expira en 1 hora.</p>
  `.trim();

  return sendMail({
    to,
    subject: 'Restablecer tu contraseña',
    html,
  });
}

export interface IPMachRegistrationParams {
  to: string;
  reference: string;
  name: string;
  email: string;
  message?: string;
}

/**
 * Sends an internal notification email for an IPMach registration (no order created).
 * Requires SMTP env and EMAIL_NOTIFICATIONS["ipmach_registration"].enabled === true.
 * Recipient: config.to from map if set, otherwise params.to.
 */
export async function sendIPMachRegistrationNotification(
  params: IPMachRegistrationParams
): Promise<{ ok: boolean; error?: string }> {
  const map = getNotificationMap();
  if (map['ipmach_registration']?.enabled !== true) {
    return { ok: false, error: 'Notification disabled by configuration' };
  }
  const transport = getTransportCached();
  if (!transport) {
    console.warn('Email not sent: SMTP not configured.');
    return { ok: false, error: 'Email service not configured' };
  }

  const recipient = (map['ipmach_registration']?.to?.trim() || params.to).trim();
  if (!recipient) {
    return { ok: false, error: 'No recipient configured' };
  }

  const safeRef = params.reference.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeName = params.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeEmail = params.email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeMessage = (params.message ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const html = `
    <p><strong>Nueva solicitud IPMach (registro)</strong></p>
    <ul>
      <li><strong>Referencia:</strong> ${safeRef}</li>
      <li><strong>Nombre:</strong> ${safeName}</li>
      <li><strong>Email:</strong> ${safeEmail}</li>
      ${safeMessage ? `<li><strong>Mensaje:</strong><br>${safeMessage}</li>` : ''}
    </ul>
    <p><em>No se creó ninguna orden; solo notificación.</em></p>
  `.trim();

  return sendMail({
    to: recipient,
    subject: `[IPMach] Solicitud: ${safeRef} - ${safeName}`,
    html,
  });
}

function escapeHtml(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface ClientRegistrationNotificationParams {
  userId: number;
  email: string;
  clientName: string | null;
  identification: string | null;
  isCompany: boolean | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  country: string | null;
  stateOrDepartment: string | null;
  city: string | null;
  address: string | null;
  marketingSource: string | null;
  clientType: number | null;
  filipoSyncOk: boolean;
  filipoSyncError?: string | null;
}

/**
 * Sends an internal notification when a client account is created via POST /api/auth/register.
 * Requires SMTP env and EMAIL_NOTIFICATIONS["client_registration"].enabled === true.
 * Set client_registration.to in EMAIL_NOTIFICATIONS to the admin inbox (e.g. proshel@proshelcorp.com).
 */
export async function sendClientRegistrationNotification(
  params: ClientRegistrationNotificationParams
): Promise<{ ok: boolean; error?: string }> {
  const map = getNotificationMap();
  if (map['client_registration']?.enabled !== true) {
    return { ok: false, error: 'Notification disabled by configuration' };
  }
  const transport = getTransportCached();
  if (!transport) {
    console.warn('Email not sent: SMTP not configured.');
    return { ok: false, error: 'Email service not configured' };
  }

  const recipient = map['client_registration']?.to?.trim() ?? '';
  if (!recipient) {
    return { ok: false, error: 'No recipient configured (set client_registration.to in EMAIL_NOTIFICATIONS)' };
  }

  const safeEmail = escapeHtml(params.email);
  const filipoLine = params.filipoSyncOk
    ? '<li><strong>Filipo sync:</strong> OK</li>'
    : `<li><strong>Filipo sync:</strong> failed — ${escapeHtml(params.filipoSyncError ?? 'unknown')}</li>`;

  const html = `
    <p><strong>New client registration (platform)</strong></p>
    <ul>
      <li><strong>User ID:</strong> ${params.userId}</li>
      <li><strong>Email:</strong> ${safeEmail}</li>
      <li><strong>Display name:</strong> ${escapeHtml(params.clientName)}</li>
      <li><strong>Company account:</strong> ${params.isCompany === true ? 'yes' : 'no'}</li>
      <li><strong>Identification:</strong> ${escapeHtml(params.identification)}</li>
      <li><strong>Client type:</strong> ${params.clientType ?? '—'}</li>
      <li><strong>Phone:</strong> ${escapeHtml(params.phoneCountryCode)} ${escapeHtml(params.phoneNumber)}</li>
      <li><strong>Location:</strong> ${escapeHtml(params.city)}, ${escapeHtml(params.stateOrDepartment)}, ${escapeHtml(params.country)}</li>
      <li><strong>Address:</strong> ${escapeHtml(params.address)}</li>
      <li><strong>Marketing source:</strong> ${escapeHtml(params.marketingSource)}</li>
      ${filipoLine}
    </ul>
    <p><em>You can parameterize this account in the admin panel.</em></p>
  `.trim();

  const subjectLabel = params.clientName?.trim() || params.email;
  return sendMail({
    to: recipient,
    subject: `[Proshel] New client: ${subjectLabel}`,
    html,
  });
}

/**
 * Sends a welcome email to the client after platform registration.
 * Requires SMTP env and EMAIL_NOTIFICATIONS["client_registration_welcome"].enabled === true.
 */
export async function sendClientRegistrationWelcomeEmail(
  to: string,
  clientDisplayName: string | null
): Promise<{ ok: boolean; error?: string }> {
  const map = getNotificationMap();
  if (map['client_registration_welcome']?.enabled !== true) {
    return { ok: false, error: 'Notification disabled by configuration' };
  }
  const transport = getTransportCached();
  if (!transport) {
    console.warn('Email not sent: SMTP not configured.');
    return { ok: false, error: 'Email service not configured' };
  }

  if (isNonReceivingEmailDomain(to)) {
    console.warn(
      `[Client welcome] Skipped: ${maskEmailForLog(to)} — domain cannot receive inbound mail (welcome would bounce).`
    );
    return { ok: false, error: 'Recipient domain cannot receive mail' };
  }

  const trimmed = clientDisplayName?.trim();
  const greetingName = trimmed ? escapeHtml(trimmed) : null;
  const loginUrl = `${BASE_URL.replace(/\/$/, '')}/login`;

  const html = `
    <p>${greetingName ? `Hola, <strong>${greetingName}</strong>` : 'Hola'},</p>
    <p>Te damos la bienvenida a <strong>PROSHEL CORP (IPMACH)</strong>. Este mensaje confirma que tu registro en nuestra plataforma se completó correctamente.</p>
    <p>Desde ya puedes iniciar sesión, explorar el catálogo, buscar referencias y armar cotizaciones con tu cuenta. La interfaz está pensada para que encuentres piezas, revises disponibilidad y organices tu trabajo de compra en un solo lugar.</p>
    <p><strong>Importante sobre precios:</strong> los valores que ves en línea pueden no reflejar aún las condiciones comerciales finales para tu país. Nuestro ejecutivo de cuenta debe completar la <strong>parametrización de tu cuenta</strong> (listas, márgenes y condiciones locales) para que obtengas el mejor esquema posible. Hasta entonces, considera las cotizaciones como orientativas.</p>
    <p>Si tienes dudas o necesitas acompañamiento, escríbenos por WhatsApp usando el botón de contacto en la web o este enlace directo: <a href="${SUPPORT_WHATSAPP_HREF}" style="color:#0f0f0f;font-weight:600;">Contactar por WhatsApp</a>.</p>
    <p>Para entrar a la plataforma: <a href="${loginUrl}" style="color:#0f0f0f;font-weight:600;">Iniciar sesión</a></p>
    <p>Saludos,<br/>Equipo Proshel</p>
  `.trim();

  console.log(`[Client welcome] Sending to ${maskEmailForLog(to)}`);
  const result = await sendMail({
    to,
    subject: 'Bienvenido a PROSHEL CORP (IPMACH) — confirmación de registro',
    html,
  });
  if (result.ok) {
    console.log(`[Client welcome] Sent successfully to ${maskEmailForLog(to)}`);
  }
  return result;
}

/**
 * Sends an order confirmation email to the client with the order PDF attached.
 * Requires SMTP env and EMAIL_NOTIFICATIONS["order_confirmation"].enabled === true.
 */
export async function sendOrderConfirmationEmail(
  to: string,
  clientName: string,
  orderId: number,
  pdfBuffer: Buffer
): Promise<{ ok: boolean; error?: string }> {
  const map = getNotificationMap();
  if (map['order_confirmation']?.enabled !== true) {
    console.warn('[Order confirmation email] Skipped: EMAIL_NOTIFICATIONS.order_confirmation.enabled is not true. Check .env EMAIL_NOTIFICATIONS JSON.');
    return { ok: false, error: 'Order confirmation email disabled by configuration' };
  }
  const transport = getTransportCached();
  if (!transport) {
    console.warn('[Order confirmation email] Skipped: SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env).');
    return { ok: false, error: 'Email service not configured' };
  }

  const safeName = String(clientName || 'Cliente').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const filename = `orden-${orderId}.pdf`;

  const html = `
    <p>Hola ${safeName},</p>
    <p>Te confirmamos que hemos recibido tu orden <strong>#${orderId}</strong>.</p>
    <p>En el adjunto encontrarás el detalle de la orden en PDF.</p>
    <p>Si tienes alguna pregunta, contáctanos.</p>
    <p>Saludos,<br/>Proshel Corp</p>
  `.trim();

  const toMasked = to.length >= 5 ? `${to.slice(0, 2)}***@${to.split('@')[1] ?? '?'}` : '***';
  console.log(`[Order confirmation] Sending to ${toMasked} (order #${orderId}), PDF size: ${pdfBuffer.length} bytes`);

  const result = await sendMail({
    to,
    subject: `Confirmación de orden #${orderId} - Proshel Corp`,
    html,
    attachments: [{ filename, content: pdfBuffer }],
  });

  if (result.ok) {
    console.log(`[Order confirmation] Sent successfully to ${toMasked} (order #${orderId})`);
  }
  return result;
}
