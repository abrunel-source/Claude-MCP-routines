import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators';
import { ProposalsService } from './proposals.service';
import { SelectPackageDto, SignDto } from './proposals.dto';

// Tenant-themed, no-login prospect wizard (spec §10). Token in the path.
@ApiTags('public-proposals')
@Public()
@Controller('public/proposals')
export class PublicProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  private meta(req: Request): { ip?: string; ua?: string } {
    return {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
      ua: req.headers['user-agent'],
    };
  }

  @Get(':token')
  view(@Param('token') token: string, @Req() req: Request) {
    const { ip, ua } = this.meta(req);
    return this.proposals.viewPublic(token, ip, ua);
  }

  @Post(':token/select-package')
  select(@Param('token') token: string, @Body() dto: SelectPackageDto) {
    return this.proposals.selectPackage(token, dto.optionId);
  }

  @Post(':token/accept-terms')
  acceptTerms(@Param('token') token: string) {
    return this.proposals.acceptTerms(token);
  }

  @Post(':token/sign')
  sign(@Param('token') token: string, @Body() dto: SignDto, @Req() req: Request) {
    const { ip, ua } = this.meta(req);
    return this.proposals.sign(token, dto, ip, ua);
  }
}
