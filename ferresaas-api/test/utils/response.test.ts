import { describe, it, expect } from '@jest/globals';
import { AppError, sendSuccess, sendError, sendPaginated } from '@/utils/response';

jest.mock('express', () => ({
  Response: jest.fn().mockImplementation(() => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  })),
}));

describe('AppError', () => {
  it('should create error with all properties', () => {
    const error = new AppError(400, 'INVALID_INPUT', 'Invalid input', { field: 'email' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.name).toBe('AppError');
  });

  it('should be instanceof Error', () => {
    const error = new AppError(500, 'INTERNAL_ERROR', 'Server error');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('sendSuccess', () => {
  it('should send success response with data', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    sendSuccess(mockRes, { id: '1', name: 'Test' });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: { id: '1', name: 'Test' },
    });
  });

  it('should allow custom status code', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    sendSuccess(mockRes, { created: true }, 201);
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });
});

describe('sendError', () => {
  it('should send error response', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    sendError(mockRes, 404, 'NOT_FOUND', 'Resource not found');
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: undefined,
      },
    });
  });

  it('should include details when provided', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    sendError(mockRes, 400, 'VALIDATION_ERROR', 'Invalid data', { fields: ['email'] });
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          details: { fields: ['email'] },
        }),
      })
    );
  });
});

describe('sendPaginated', () => {
  it('should send paginated response', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    const items = [{ id: '1' }, { id: '2' }];
    sendPaginated(mockRes, items, { page: 1, limit: 10, total: 2 });

    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: items,
      meta: {
        page: 1,
        limit: 10,
        total: 2,
        hasMore: false,
      },
    });
  });

  it('should calculate hasMore correctly', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    sendPaginated(mockRes, [{ id: '1' }], { page: 1, limit: 10, total: 15 });
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ hasMore: true }),
      })
    );
  });
});
