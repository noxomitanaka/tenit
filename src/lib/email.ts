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
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const transporter = createTransporter();
  if (!transporter) {
    // SMTP未設定時はログのみ（開発環境）
    console.log(`[Email] to=${to} subject=${subject}`);
    return;
  }
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}

export function reservationConfirmHtml(memberName: string, date: string, startTime: string) {
  return `<p>${memberName} 様</p><p>${date} ${startTime} のレッスン予約を受け付けました。</p>`;
}

export function substitutionCreditHtml(memberName: string, expiresAt: Date) {
  const exp = expiresAt.toLocaleDateString('ja-JP');
  return `<p>${memberName} 様</p><p>振替レッスンが ${exp} まで利用可能です。</p>`;
}
