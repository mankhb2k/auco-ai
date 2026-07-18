import { Module } from '@nestjs/common';
import { ActorsController } from './actors.controller';
import { ActorsService } from './service/actors.service';

@Module({
  controllers: [ActorsController],
  providers: [ActorsService],
  exports: [ActorsService],
})
export class ActorsModule {}
