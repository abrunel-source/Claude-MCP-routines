import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@cadence/shared-types';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('tenancy')
@Controller('tenant')
export class TenantController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public branding lookup for the current host — drives runtime white-label
   * theming in the web app. Returns the Brunel platform brand when no tenant
   * resolves from the host.
   */
  @Public()
  @Get('context')
  async context(@Req() req: Request): Promise<TenantContext | { platform: true }> {
    const tenantId = req.tenantStore?.tenantId;
    if (!tenantId) {
      return { platform: true };
    }
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      companyName: tenant.branding?.companyName ?? tenant.name,
      brandingPrimaryColor: tenant.branding?.primaryColor ?? '#1f6feb',
      brandingSecondaryColor: tenant.branding?.secondaryColor ?? '#0b3d91',
      logoUrl: tenant.branding?.logoUrl ?? null,
    };
  }
}
