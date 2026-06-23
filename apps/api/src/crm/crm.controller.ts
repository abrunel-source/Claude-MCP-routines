import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@cadence/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import {
  OrganizationDto,
  ContactDto,
  DealDto,
  MoveDealDto,
  ActivityDto,
  TagDto,
} from './crm.dto';

// All routes are tenant-scoped automatically by the Prisma extension. Mutations
// require firm_member; reads allow firm_readonly (the global JwtAuthGuard already
// requires authentication).
@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.client;
  }

  // --- Organizations -------------------------------------------------------
  @Get('organizations')
  listOrganizations(@Query('q') q?: string) {
    return this.db.organization.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(Role.FirmMember)
  @Post('organizations')
  createOrganization(@Body() dto: OrganizationDto) {
    return this.db.organization.create({ data: dto as never });
  }

  @Roles(Role.FirmMember)
  @Patch('organizations/:id')
  async updateOrganization(@Param('id') id: string, @Body() dto: OrganizationDto) {
    const r = await this.db.organization.updateMany({ where: { id }, data: dto });
    if (r.count === 0) throw new NotFoundException();
    return this.db.organization.findFirst({ where: { id } });
  }

  // --- Contacts ------------------------------------------------------------
  @Get('contacts')
  listContacts(@Query('q') q?: string) {
    return this.db.contact.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('contacts/:id')
  async getContact(@Param('id') id: string) {
    const c = await this.db.contact.findFirst({
      where: { id },
      include: { organization: true, activities: { orderBy: { createdAt: 'desc' } } },
    });
    if (!c) throw new NotFoundException();
    return c;
  }

  @Roles(Role.FirmMember)
  @Post('contacts')
  createContact(@Body() dto: ContactDto) {
    return this.db.contact.create({ data: dto as never });
  }

  @Roles(Role.FirmMember)
  @Patch('contacts/:id')
  async updateContact(@Param('id') id: string, @Body() dto: ContactDto) {
    const r = await this.db.contact.updateMany({ where: { id }, data: dto });
    if (r.count === 0) throw new NotFoundException();
    return this.db.contact.findFirst({ where: { id } });
  }

  @Roles(Role.FirmMember)
  @Delete('contacts/:id')
  async deleteContact(@Param('id') id: string) {
    await this.db.contact.deleteMany({ where: { id } });
    return { ok: true };
  }

  // --- Deals (kanban) ------------------------------------------------------
  @Get('deals')
  listDeals(@Query('stage') stage?: string) {
    return this.db.deal.findMany({
      where: stage ? { stage: stage as never } : undefined,
      include: { contact: true, organization: true },
      orderBy: [{ stage: 'asc' }, { position: 'asc' }],
    });
  }

  @Roles(Role.FirmMember)
  @Post('deals')
  createDeal(@Body() dto: DealDto) {
    return this.db.deal.create({ data: dto as never });
  }

  @Roles(Role.FirmMember)
  @Patch('deals/:id/move')
  async moveDeal(@Param('id') id: string, @Body() dto: MoveDealDto) {
    const r = await this.db.deal.updateMany({
      where: { id },
      data: { stage: dto.stage as never, position: dto.position },
    });
    if (r.count === 0) throw new NotFoundException();
    return this.db.deal.findFirst({ where: { id } });
  }

  @Roles(Role.FirmMember)
  @Patch('deals/:id')
  async updateDeal(@Param('id') id: string, @Body() dto: DealDto) {
    const r = await this.db.deal.updateMany({ where: { id }, data: dto as never });
    if (r.count === 0) throw new NotFoundException();
    return this.db.deal.findFirst({ where: { id } });
  }

  // --- Activities ----------------------------------------------------------
  @Get('activities')
  listActivities(@Query('contactId') contactId?: string, @Query('dealId') dealId?: string) {
    return this.db.activity.findMany({
      where: { ...(contactId ? { contactId } : {}), ...(dealId ? { dealId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(Role.FirmMember)
  @Post('activities')
  createActivity(@Body() dto: ActivityDto) {
    return this.db.activity.create({ data: dto as never });
  }

  // --- Tags ----------------------------------------------------------------
  @Get('tags')
  listTags() {
    return this.db.tag.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles(Role.FirmMember)
  @Post('tags')
  createTag(@Body() dto: TagDto) {
    return this.db.tag.create({ data: dto as never });
  }
}
