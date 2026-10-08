import type { Request, Response, NextFunction } from 'express';
import { signupSchema } from './signup.schemas';
import { signupBusinessOwner } from '../application/signup-business-owner';
import { sendSuccess } from '../../../platform/http-respond';
import { getValidatedOrigin, setRefreshCookie } from './session-cookies';

export async function signupController(req: Request, res: Response, next: NextFunction) {
  try {
    getValidatedOrigin(req);
    const input = signupSchema.parse(req.body);
    const result = await signupBusinessOwner(input, req.ip, req.get('user-agent'));
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(
      res,
      {
        user: result.user,
        business: result.business,
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
        csrfHash: result.csrfHash,
      },
      201,
    );
  } catch (error) {
    next(error);
  }
}
