import { Global, Module } from '@nestjs/common';
import { AuditService } from './service/audit.service';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
