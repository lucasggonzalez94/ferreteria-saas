import { vi } from 'vitest';

export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  refreshTokenSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  business: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
  },
};

export const prisma = mockPrisma as any;

export function resetMocks() {
  Object.values(mockPrisma).forEach((model: any) => {
    Object.keys(model).forEach((method: string) => {
      model[method].mockReset();
    });
  });
}

export function setupUserMock() {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'Test',
    lastName: 'User',
    password: '$argon2id$test-hash',
    businessId: 'business-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
  });
}

export function setupUserNotFoundMock() {
  mockPrisma.user.findUnique.mockResolvedValue(null);
}
