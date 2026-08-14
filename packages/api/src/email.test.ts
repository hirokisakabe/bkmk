import { describe, expect, it, vi } from 'vitest';

import {
  createResendEmailSender,
  EmailDeliveryError,
  sendEmailVerification,
  sendPasswordReset,
  type TransactionalEmail,
} from './email.js';

describe('transactional email', () => {
  it('Resend に設定済み送信元とメッセージを渡す', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const sender = createResendEmailSender({ emails: { send } }, 'noreply@example.com', 'bkmk');

    await sender({
      to: 'user@example.com',
      subject: 'subject',
      text: 'plain text',
      html: '<p>html</p>',
    });

    expect(send).toHaveBeenCalledWith({
      from: 'bkmk <noreply@example.com>',
      to: 'user@example.com',
      subject: 'subject',
      text: 'plain text',
      html: '<p>html</p>',
    });
  });

  it('プロバイダーエラーの詳細を例外へ含めない', async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'secret-provider-detail' },
    });
    const sender = createResendEmailSender({ emails: { send } }, 'noreply@example.com');

    await expect(
      sender({ to: 'user@example.com', subject: 'subject', text: 'text', html: 'html' }),
    ).rejects.toEqual(new EmailDeliveryError('provider_rejected'));
  });

  it('プロバイダーへの接続失敗を安全な種別へ変換する', async () => {
    const send = vi.fn().mockRejectedValue(new Error('secret-network-detail'));
    const sender = createResendEmailSender({ emails: { send } }, 'noreply@example.com');

    await expect(
      sender({ to: 'user@example.com', subject: 'subject', text: 'text', html: 'html' }),
    ).rejects.toEqual(new EmailDeliveryError('provider_unavailable'));
  });

  it('確認・再設定メールに対象 URL を含め、HTML をエスケープする', async () => {
    const messages: TransactionalEmail[] = [];
    const sender = async (email: TransactionalEmail) => {
      messages.push(email);
    };

    await sendEmailVerification(sender, {
      email: 'user@example.com',
      url: 'https://example.com/verify?token=a&next=<script>',
    });
    await sendPasswordReset(sender, {
      email: 'user@example.com',
      url: 'https://example.com/reset?token=b',
    });

    expect(messages[0]?.text).toContain('https://example.com/verify?token=a&next=<script>');
    expect(messages[0]?.html).toContain('token=a&amp;next=&lt;script&gt;');
    expect(messages[1]?.text).toContain('https://example.com/reset?token=b');
  });
});
