import { SetMetadata } from '@nestjs/common';
import type { AccessLayer } from '../actors/actor.types';

export const REQUIRE_LAYER_KEY = 'requireLayer';

/** Chỉ cho phép các accessLayer trong danh sách. */
export const RequireLayer = (...layers: AccessLayer[]) =>
  SetMetadata(REQUIRE_LAYER_KEY, layers);
