import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { requirePermissions, requireRoles } from '@/middleware/rbac';
import { AppError } from '@/utils/response';
import { AuthRequest } from '@/types';

describe('rbac middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      user: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('requirePermissions', () => {
    it('should throw if user not authenticated', () => {
      const middleware = requirePermissions('products:write');

      expect(() => {
        middleware(mockReq as any, mockRes, mockNext);
      }).toThrow(AppError);
    });

    it('should throw if user lacks required permission', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: [],
        permissions: ['products:read'],
      };

      const middleware = requirePermissions('products:write');

      expect(() => {
        middleware(mockReq as any, mockRes, mockNext);
      }).toThrow(AppError);
    });

    it('should call next if user has required permission', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: [],
        permissions: ['products:write'],
      };

      const middleware = requirePermissions('products:write');
      middleware(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if user has any of multiple permissions', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: [],
        permissions: ['products:write'],
      };

      const middleware = requirePermissions('products:delete', 'products:write');
      middleware(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRoles', () => {
    it('should throw if user not authenticated', () => {
      const middleware = requireRoles('admin');

      expect(() => {
        middleware(mockReq as any, mockRes, mockNext);
      }).toThrow(AppError);
    });

    it('should throw if user lacks required role', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: ['user'],
        permissions: [],
      };

      const middleware = requireRoles('admin');

      expect(() => {
        middleware(mockReq as any, mockRes, mockNext);
      }).toThrow(AppError);
    });

    it('should call next if user has required role', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: ['admin'],
        permissions: [],
      };

      const middleware = requireRoles('admin');
      middleware(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if user has any of multiple roles', () => {
      mockReq.user = {
        id: '1',
        email: 'test@test.com',
        businessId: 'biz-1',
        roles: ['user'],
        permissions: [],
      };

      const middleware = requireRoles('admin', 'superadmin', 'user');
      middleware(mockReq as any, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
