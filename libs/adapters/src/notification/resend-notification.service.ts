import type { NotificationService, SendEmailInput, SendEmailResult } from '@cadence/core';

/**
 * ResendNotificationService — real adapter over the Resend SDK. Imported
 * dynamically so the workspace builds without `resend` installed. Activate with
 * NOTIFICATION_PROVIDER=real and RESEND_API_KEY.
 */
export class ResendNotificationService implements NotificationService {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { Resend } = await import('resend' as any);
    const client = new Resend(this.apiKey);
    const { data, error } = await client.emails.send({
      from: input.from ?? this.defaultFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) {
      return { id: '', status: 'failed' };
    }
    return { id: data?.id ?? '', status: 'sent' };
  }
}
