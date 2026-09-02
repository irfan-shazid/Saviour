import nodemailer from 'nodemailer';
import { emailEnabled, env } from './env.js';

/**
 * SMTP transport for verification mail.
 *
 * Deliberately provider-agnostic: anything with SMTP works (Gmail with an app
 * password, Resend, Postmark, Mailgun, Mailtrap for local testing). Nothing
 * here is specific to one vendor.
 */
const transporter = emailEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

/** Confirms credentials at boot instead of on the first sign-up. */
export async function verifyEmailTransport(): Promise<void> {
  if (!transporter) {
    console.warn(
      '[email] SMTP not configured — verification links cannot be delivered. ' +
        'Set SMTP_HOST / SMTP_USER / SMTP_PASS to enable email verification.'
    );
    return;
  }
  try {
    await transporter.verify();
    console.log(`[email] SMTP ready via ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  } catch (e) {
    console.error(
      `[email] SMTP check failed: ${e instanceof Error ? e.message : e}. ` +
        'Verification mail will not be delivered until this is fixed.'
    );
  }
}

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function send({ to, subject, text, html }: Mail): Promise<void> {
  if (!transporter) {
    // Loud, and with the link in the log, so local development without SMTP
    // is still workable — you copy the URL out of the console.
    console.warn(`[email] SMTP not configured. Would have sent to ${to}:\n${text}`);
    return;
  }
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
}

function layout(heading: string, body: string, cta: { url: string; label: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0d1526">
    <table role="presentation" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
      <tr><td>
        <div style="font-size:32px;line-height:1">🛟</div>
        <h1 style="margin:12px 0 8px;font-size:22px">${heading}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#4e5d75">${body}</p>
        <a href="${cta.url}"
           style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px">
          ${cta.label}
        </a>
        <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#78859a">
          If the button doesn't work, paste this into your browser:<br>
          <span style="word-break:break-all">${cta.url}</span>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#78859a">
          Didn't ask for this? You can ignore this email.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(to: string, url: string, name?: string): Promise<void> {
  const who = name?.trim() ? ` ${name.trim().split(' ')[0]}` : '';
  await send({
    to,
    subject: 'Verify your email for Saviour',
    text: `Hi${who},\n\nConfirm your email address to finish setting up Saviour:\n${url}\n\nIf you didn't create an account, you can ignore this.`,
    html: layout(
      `Confirm your email${who}`,
      'One click and your Saviour account is ready. This link expires in an hour.',
      { url, label: 'Verify my email' }
    ),
  });
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: 'Reset your Saviour password',
    text: `Reset your Saviour password:\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: layout('Reset your password', 'Choose a new password for your Saviour account.', {
      url,
      label: 'Choose a new password',
    }),
  });
}
