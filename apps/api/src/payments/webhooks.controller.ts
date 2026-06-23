import { Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators';
import { PaymentsService } from './payments.service';

// Dedicated raw-body webhook endpoint. Signature is verified, the event is
// persisted with an idempotency key, and a duplicate causes no double effect.
@ApiTags('webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stitch')
  async stitch(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-stitch-signature') signature = '',
  ): Promise<{ ok: true; duplicate: boolean }> {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    const duplicate = await this.payments.handleStitchWebhook(raw, signature);
    return { ok: true, duplicate };
  }
}
