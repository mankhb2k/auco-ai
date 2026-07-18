import { ConfigService } from '@nestjs/config';

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const connect = jest.fn().mockResolvedValue(undefined);
const disconnect = jest.fn().mockResolvedValue(undefined);
const executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = connect;
    $disconnect = disconnect;
    $executeRawUnsafe = executeRawUnsafe;
    $queryRaw = queryRaw;
  }
  return { PrismaClient: MockPrismaClient };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      getOrThrow: jest.fn().mockReturnValue('postgresql://localhost:5432/test'),
    } as unknown as ConfigService;
    service = new PrismaService(config);
  });

  it('connects and ensures pgvector on module init', async () => {
    await service.onModuleInit();
    expect(connect).toHaveBeenCalled();
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      'CREATE EXTENSION IF NOT EXISTS vector',
    );
  });

  it('disconnects pool on module destroy', async () => {
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('ping returns true when query succeeds', async () => {
    await expect(service.ping()).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalled();
  });
});
