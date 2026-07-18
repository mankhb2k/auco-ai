import { Global, Module } from '@nestjs/common';
import { RequireLayerGuard } from './require-layer.guard';

@Global()
@Module({
  providers: [RequireLayerGuard],
  exports: [RequireLayerGuard],
})
export class CommonModule {}
