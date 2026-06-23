import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@cadence/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';

@ApiTags('system')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health(): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = { database: 'skipped' };
    let status: HealthResponse['status'] = 'ok';
    try {
      await this.prisma.raw.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
      status = 'degraded';
    }
    return {
      status,
      service: 'cadence-api',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  @Public()
  @Get('health/live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
