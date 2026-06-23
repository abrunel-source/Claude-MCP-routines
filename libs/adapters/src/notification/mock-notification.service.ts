import { randomUUID } from 'node:crypto';
import type { NotificationService, SendEmailInput, SendEmailResult } from '@cadence/core';

/**
 * MockNotificationService — captures emails in memory (and logs them) so flows
 * that send mail run end-to-end and can be asserted in tests.
 */
export class MockNotificationService implements NotificationService {
  readonly outbox: SendEmailInput[] = [];

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.outbox.push(input);
    // eslint-disable-next-line no-console
    console.log(`[mock-email] -> ${input.to} | ${input.template} | ${input.subject}`);
    return { id: `mock_email_${randomUUID()}`, status: 'mocked' };
  }
}
