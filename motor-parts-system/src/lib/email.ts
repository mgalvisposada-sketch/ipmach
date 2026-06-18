import nodemailer from 'nodemailer';

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
