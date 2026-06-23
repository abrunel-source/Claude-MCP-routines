import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [WebhooksController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
