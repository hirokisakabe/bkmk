import { Resend } from 'resend';

export interface TransactionalEmail {
  html: string;
  subject: string;
  text: string;
  to: string;
}

export type EmailSender = (email: TransactionalEmail) => Promise<void>;

export type EmailDeliveryFailureType =
  | 'configuration_error'
  | 'provider_rejected'
  | 'provider_unavailable'
  | 'unknown';

export class EmailDeliveryError extends Error {
  readonly failureType: EmailDeliveryFailureType;

  constructor(failureType: EmailDeliveryFailureType) {
    super('Transactional email delivery failed');
    this.name = 'EmailDeliveryError';
    this.failureType = failureType;
  }
}

interface ResendClient {
  emails: {
    send: (email: {
      from: string;
      html: string;
      subject: string;
      text: string;
      to: string;
    }) => Promise<{ error: { name?: string } | null }>;
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function requireEnvironmentVariable(name: 'EMAIL_FROM_ADDRESS' | 'RESEND_API_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new EmailDeliveryError('configuration_error');
  }
  return value;
}

export function sanitizeEmailDeliveryError(error: unknown): EmailDeliveryError {
  return error instanceof EmailDeliveryError ? error : new EmailDeliveryError('unknown');
}

export function createResendEmailSender(
  client?: ResendClient,
  fromAddress = requireEnvironmentVariable('EMAIL_FROM_ADDRESS'),
  fromName = process.env.EMAIL_FROM_NAME?.trim() || 'bkmk',
): EmailSender {
  const resend = client ?? new Resend(requireEnvironmentVariable('RESEND_API_KEY'));
  const from = `${fromName} <${fromAddress}>`;

  return async (email) => {
    try {
      const { error } = await resend.emails.send({ ...email, from });
      if (error) {
        // Resend のレスポンス本文は機密情報を含み得るため、外部・内部とも詳細を転送しない。
        throw new EmailDeliveryError('provider_rejected');
      }
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError('provider_unavailable');
    }
  };
}

export const sendTransactionalEmail: EmailSender = async (email) => {
  await createResendEmailSender()(email);
};

export async function sendEmailVerification(
  sender: EmailSender,
  input: { email: string; url: string },
): Promise<void> {
  const url = escapeHtml(input.url);
  await sender({
    to: input.email,
    subject: 'bkmk のメールアドレスを確認してください',
    text: `次のリンクを開いてメールアドレスを確認してください。リンクは1時間有効です。\n\n${input.url}`,
    html: `<p>bkmk をご利用いただきありがとうございます。</p><p><a href="${url}">メールアドレスを確認する</a></p><p>このリンクは1時間有効です。心当たりがない場合は、このメールを破棄してください。</p>`,
  });
}

export async function sendPasswordReset(
  sender: EmailSender,
  input: { email: string; url: string },
): Promise<void> {
  const url = escapeHtml(input.url);
  await sender({
    to: input.email,
    subject: 'bkmk のパスワードを再設定してください',
    text: `次のリンクを開いてパスワードを再設定してください。リンクは1時間有効です。\n\n${input.url}`,
    html: `<p>bkmk のパスワード再設定がリクエストされました。</p><p><a href="${url}">パスワードを再設定する</a></p><p>このリンクは1時間有効です。心当たりがない場合は、何もする必要はありません。</p>`,
  });
}
