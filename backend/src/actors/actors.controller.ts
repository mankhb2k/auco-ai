import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ActorsService } from './service/actors.service';
import { DEMO_EMPLOYEE_HEADER } from './actor.types';

@Controller('api/actors')
export class ActorsController {
  constructor(private readonly actors: ActorsService) {}

  /** FE role switcher — danh sách employee seed (role.md §5.1). */
  @Get()
  list(@Query('bankCode') bankCode?: string) {
    return this.actors.list(bankCode?.trim() || 'SHB');
  }

  /** Actor hiện tại theo header X-Demo-Employee-Id (fallback seed mặc định). */
  @Get('me')
  me(@Headers(DEMO_EMPLOYEE_HEADER) employeeId?: string) {
    return this.actors.resolveActor(employeeId);
  }

  /** Portfolio scope demo need-to-know (README §2.7). */
  @Get(':id/portfolio')
  portfolio(@Param('id') id: string) {
    return this.actors.portfolio(id);
  }
}
