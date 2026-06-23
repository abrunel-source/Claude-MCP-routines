import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AdaptersModule } from './adapters/adapters.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';
import { JwtAuthGuard, RolesGuard } from './common/guards';

@Module({
  imports: [PrismaModule, AdaptersModule, HealthModule, AuthModule, TenancyModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Resolve tenant from Host on every request before guards/handlers run.
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
