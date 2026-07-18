import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ActorsService } from '../actors/service/actors.service';
import {
  DEMO_EMPLOYEE_HEADER,
  type DemoActor,
} from '../actors/actor.types';

/** Request đã gắn actor demo (không phải auth thật — role.md §4). */
export type RequestWithActor = Request & { actor?: DemoActor };

@Injectable()
export class DemoActorMiddleware implements NestMiddleware {
  constructor(private readonly actors: ActorsService) {}

  async use(req: RequestWithActor, _res: Response, next: NextFunction) {
    const headerValue = req.headers[DEMO_EMPLOYEE_HEADER];
    const employeeId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    try {
      req.actor = await this.actors.resolveActor(employeeId);
    } catch {
      // Seed chưa chạy — để route tự xử lý khi cần actor
      req.actor = undefined;
    }
    next();
  }
}
