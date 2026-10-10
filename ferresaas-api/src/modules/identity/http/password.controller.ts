import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../../platform/errors';
import { sendSuccess } from '../../../platform/http-respond';
import { changePassword, forgotPassword, resetPassword } from '../application/password';
import { PASSWORD_MIN_LENGTH } from '../domain/password-policy';

const forgotSchema = z.object({ email: z.string().trim().email() });
const resetSchema = z.object({ token: z.string().min(1), newPassword: z.string().min(PASSWORD_MIN_LENGTH) });
const changeSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(PASSWORD_MIN_LENGTH) });

export const passwordController = {
  async forgot(req: Request, res: Response, next: NextFunction) {
    try {
      const input = forgotSchema.parse(req.body);
      const result = await forgotPassword(input.email, req.ip, req.get('user-agent'));
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async reset(req: Request, res: Response, next: NextFunction) {
    try {
      const input = resetSchema.parse(req.body);
      const result = await resetPassword(input.token, input.newPassword, req.ip, req.get('user-agent'));
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async change(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id || !req.businessId) throw AppError.unauthorized();
      const input = changeSchema.parse(req.body);
      const result = await changePassword(
        { businessId: req.businessId, actorUserId: req.user.id },
        input,
        req.ip,
        req.get('user-agent'),
      );
      res.clearCookie('refreshToken', { path: '/' });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
};
