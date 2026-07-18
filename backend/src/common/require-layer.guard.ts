import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccessLayer } from '../actors/actor.types';
import { REQUIRE_LAYER_KEY } from './require-layer.decorator';
import type { RequestWithActor } from './demo-actor.middleware';

@Injectable()
export class RequireLayerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<AccessLayer[]>(
      REQUIRE_LAYER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed?.length) return true;

    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = req.actor;
    if (!actor) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Layer ${allowed.join('|')} required (no demo actor — set X-Demo-Employee-Id)`,
        actorId: null,
        accessLayer: null,
      });
    }

    if (!allowed.includes(actor.accessLayer)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Layer ${allowed.join('|')} required (actor is ${actor.accessLayer})`,
        actorId: actor.id,
        accessLayer: actor.accessLayer,
      });
    }

    return true;
  }
}
