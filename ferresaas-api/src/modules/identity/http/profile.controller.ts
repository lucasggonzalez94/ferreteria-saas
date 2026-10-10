import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../../platform/errors';
import { sendSuccess } from '../../../platform/http-respond';
import { updateProfile } from '../application/update-profile';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional(),
});

export const profileController = {
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id || !req.businessId) throw AppError.unauthorized();
      const input = profileSchema.parse(req.body);
      const result = await updateProfile(
        { businessId: req.businessId, actorUserId: req.user.id },
        input,
        req.ip,
        req.get('user-agent'),
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
};
