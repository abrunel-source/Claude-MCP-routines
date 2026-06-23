import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Role, ROLE_RANK } from '@cadence/shared-types';
import type { AuthenticatedUser } from '@cadence/shared-types';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';

/** JWT guard that honours the @Public() decorator. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

/** Enforces @Roles(...) using the role rank hierarchy. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }
    if (user.isPlatformAdmin) {
      return true;
    }
    if (!user.role) {
      throw new ForbiddenException('No tenant role');
    }
    const have = ROLE_RANK[user.role];
    const min = Math.min(...required.map((r) => ROLE_RANK[r]));
    if (have < min) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
