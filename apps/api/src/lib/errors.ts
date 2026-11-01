export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const toCode = (entity: string) => entity.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toUpperCase();

export const errors = {
  badRequest: (message: string, details?: unknown, code = 'BAD_REQUEST') => new AppError(400, code, message, details),
  validation: (details: unknown) => new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details),
  unauthorized: (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(401, code, message),
  forbidden: (message = "You don't have permission to perform this action", code = 'FORBIDDEN') =>
    new AppError(403, code, message),
  notFound: (entity = 'Resource') => new AppError(404, `${toCode(entity)}_NOT_FOUND`, `${entity} not found`),
  conflict: (message: string, code = 'CONFLICT', details?: unknown) => new AppError(409, code, message, details),
  planLimit: (message: string, details?: unknown) => new AppError(402, 'PLAN_LIMIT_REACHED', message, details),
  tooMany: (message = 'Too many requests, please slow down') => new AppError(429, 'RATE_LIMITED', message),
};
