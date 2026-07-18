import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireLayerGuard } from './require-layer.guard';
import { REQUIRE_LAYER_KEY } from './require-layer.decorator';
import type { RequestWithActor } from './demo-actor.middleware';
import type { DemoActor } from '../actors/actor.types';

function mockContext(actor: DemoActor | undefined, allowed?: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(allowed),
  } as unknown as Reflector;
  const guard = new RequireLayerGuard(reflector);
  const req = { actor } as RequestWithActor;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as never;
  return { guard, reflector };
}

describe('RequireLayerGuard', () => {
  const employee: DemoActor = {
    id: 'emp-credit-b',
    displayName: 'Nguyễn Thị B',
    role: 'credit_officer',
    accessLayer: 'employee',
    bankCode: 'SHB',
    branchCode: 'CN_CAU_GIAY',
  };
  const manager: DemoActor = {
    ...employee,
    id: 'emp-mgr-d',
    role: 'branch_manager',
    accessLayer: 'manager',
  };

  it('allows when no RequireLayer metadata', () => {
    const { guard } = mockContext(employee, undefined);
    expect(guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ actor: employee }) }),
    } as never)).toBe(true);
  });

  it('allows employee on employee-only route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['employee']),
    } as unknown as Reflector;
    const guard = new RequireLayerGuard(reflector);
    const ok = guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ actor: employee }) }),
    } as never);
    expect(ok).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      REQUIRE_LAYER_KEY,
      expect.any(Array),
    );
  });

  it('forbids manager on employee-only route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['employee']),
    } as unknown as Reflector;
    const guard = new RequireLayerGuard(reflector);
    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ actor: manager }) }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('forbids when actor is missing', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['manager']),
    } as unknown as Reflector;
    const guard = new RequireLayerGuard(reflector);
    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('allows manager or it_admin on MCP suite layers', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['it_admin', 'manager']),
    } as unknown as Reflector;
    const guard = new RequireLayerGuard(reflector);
    expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ actor: manager }) }),
      } as never),
    ).toBe(true);
  });
});
