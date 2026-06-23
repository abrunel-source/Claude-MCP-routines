import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@cadence/shared-types';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  email: string;
  isPlatformAdmin: boolean;
  tenantId?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.accessSecret(),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthenticatedUser {
    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.email,
      isPlatformAdmin: payload.isPlatformAdmin,
      tenantId: payload.tenantId,
      role: payload.role as AuthenticatedUser['role'],
    };

    // Update the request's tenant store (created by the middleware) so DB queries
    // run with the right scope. Platform admins get cross-tenant scope.
    const store = req.tenantStore;
    if (store) {
      store.userId = user.userId;
      store.isPlatformAdmin = user.isPlatformAdmin;
      // If the host did not pin a tenant, fall back to the token's tenant.
      if (!store.tenantId && user.tenantId) {
        store.tenantId = user.tenantId;
      }
    }
    return user;
  }
}
