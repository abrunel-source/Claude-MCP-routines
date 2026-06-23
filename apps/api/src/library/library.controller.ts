import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@cadence/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { NamedBodyDto, ServiceDto, ServicePackageDto } from './library.dto';

@ApiTags('library')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.client;
  }

  // --- Services catalogue --------------------------------------------------
  @Get('services')
  services() {
    return this.db.service.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  @Roles(Role.FirmAdmin)
  @Post('services')
  createService(@Body() dto: ServiceDto) {
    return this.db.service.create({ data: dto as never });
  }

  // --- Cover letters -------------------------------------------------------
  @Get('cover-letters')
  coverLetters() {
    return this.db.coverLetter.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Roles(Role.FirmAdmin)
  @Post('cover-letters')
  createCoverLetter(@Body() dto: NamedBodyDto) {
    return this.db.coverLetter.create({ data: dto as never });
  }

  // --- Terms templates -----------------------------------------------------
  @Get('terms')
  terms() {
    return this.db.termsTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Roles(Role.FirmAdmin)
  @Post('terms')
  createTerms(@Body() dto: NamedBodyDto) {
    return this.db.termsTemplate.create({ data: dto as never });
  }

  // --- Service packages ----------------------------------------------------
  @Get('packages')
  packages() {
    return this.db.servicePackage.findMany({
      where: { active: true },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(Role.FirmAdmin)
  @Post('packages')
  createPackage(@Body() dto: ServicePackageDto) {
    return this.db.servicePackage.create({
      // tenantId injected by the tenant-scope extension at runtime
      data: {
        name: dto.name,
        description: dto.description,
        isRecurring: dto.isRecurring ?? false,
        recurringInterval: dto.recurringInterval as never,
        items: {
          create: dto.items.map((it, i) => ({
            name: it.name,
            serviceId: it.serviceId,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            taxMode: (it.taxMode ?? 'inclusive') as never,
            position: i,
          })),
        },
      } as never,
      include: { items: true },
    });
  }
}
