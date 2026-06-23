import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { PublicProposalsController } from './public-proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  controllers: [ProposalsController, PublicProposalsController],
  providers: [ProposalsService],
})
export class ProposalsModule {}
