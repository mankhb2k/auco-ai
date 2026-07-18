jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({
    embedding: jest.fn(),
  })),
}));

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => ({
    embedding: jest.fn(),
  })),
}));

jest.mock('ai', () => ({
  embed: jest.fn(),
  embedMany: jest.fn(),
  generateObject: jest.fn(),
  generateText: jest.fn(),
}));

jest.mock('@prisma/client', () => {
  class PrismaClient {
    $connect = jest.fn();
    $disconnect = jest.fn();
    $executeRawUnsafe = jest.fn();
    $queryRaw = jest.fn();
    $queryRawUnsafe = jest.fn();
  }
  return {
    PrismaClient,
    Prisma: {
      InputJsonValue: {},
      JsonNull: null,
    },
  };
});

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));
