import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../platform/http-respond';
import { getCurrentIdentity } from '../application/get-current-identity';

export function currentIdentityController(req: Request, res: Response, next: NextFunction): void {
  try {
    sendSuccess(res, getCurrentIdentity(req.user));
  } catch (error) {
    next(error);
  }
}
