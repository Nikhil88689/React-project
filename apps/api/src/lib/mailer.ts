import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProd } from '../config/env';
import { logger } from './logger';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Last emails "sent" in dev, exposed at GET /api/dev/emails so flows like password reset are demoable. */
export const devOutbox: (OutgoingEmail & { sentAt: string })[] = [];

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(email: OutgoingEmail) {
  const t = getTransporter();
  if (!t) {
    if (!isProd) {
      devOutbox.unshift({ ...email, sentAt: new Date().toISOString() });
      devOutbox.splice(50);
    }
    logger.info({ to: email.to, subject: email.subject }, '✉️  Email (SMTP not configured — logged only)');
    return;
  }
  await t.sendMail({ from: env.EMAIL_FROM, ...email });
}

export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
  <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:18px;color:#4f46e5">RecruitFlow</td></tr>
  <tr><td style="padding:32px"><h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
  <div style="font-size:14px;line-height:1.6;color:#334155">${bodyHtml}</div>
  ${cta ? `<p style="margin-top:24px"><a href="${cta.url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>` : ''}
  </td></tr></table>
  <p style="font-size:12px;color:#94a3b8;margin-top:16px">Sent by RecruitFlow AI</p>
  </td></tr></table></body></html>`;
}

export const textToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`)
    .join('');
