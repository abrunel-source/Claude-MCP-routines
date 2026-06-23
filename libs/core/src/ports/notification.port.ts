// NotificationService port — implemented by ResendNotificationService + MockNotificationService.

export type NotificationTemplate =
  | 'proposal_sent'
  | 'proposal_viewed'
  | 'proposal_signed'
  | 'proposal_declined'
  | 'invoice_issued'
  | 'invoice_viewed'
  | 'payment_success'
  | 'payment_failed'
  | 'upcoming_renewal'
  | 'trial_ending'
  | 'email_verification'
  | 'password_reset'
  | 'team_invitation';

export interface SendEmailInput {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  template: NotificationTemplate;
  tenantId?: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface SendEmailResult {
  id: string;
  status: 'sent' | 'mocked' | 'failed';
}

export interface NotificationService {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
