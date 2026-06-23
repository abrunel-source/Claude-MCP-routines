import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@cadence/shared-types';
import type { AuthenticatedUser } from '@cadence/shared-types';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { ProposalsService } from './proposals.service';
import { ComposeProposalDto } from './proposals.dto';

@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  list() {
    return this.proposals.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.proposals.get(id);
  }

  @Roles(Role.FirmMember)
  @Post()
  compose(@CurrentUser() user: AuthenticatedUser, @Body() dto: ComposeProposalDto) {
    if (!user.tenantId) throw new UnauthorizedException('No tenant context');
    return this.proposals.compose(user.tenantId, dto);
  }

  @Roles(Role.FirmMember)
  @Post(':id/send')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!user.tenantId) throw new UnauthorizedException('No tenant context');
    return this.proposals.send(user.tenantId, id);
  }
}
