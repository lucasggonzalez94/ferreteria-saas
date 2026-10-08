export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Not authenticated'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Access denied'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(code: string, message: string): AppError {
    return new AppError(404, code, message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }

  static retryableConflict(message: string): AppError {
    return new AppError(409, 'CONCURRENT_SESSION_UPDATE', message, { retryable: true });
  }
}
