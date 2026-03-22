import nodemailer from 'nodemailer';

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const transporter = createTransporter();
  if (!transporter) {
    // SMTP未設定時はログのみ（開発環境）
    console.log(`[Email] to=${to} subject=${subject}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  });
}

