import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../../platform/errors';
import { sendSuccess } from '../../../platform/http-respond';
import { PASSWORD_MIN_LENGTH } from '../domain/password-policy';
import { registerUser } from '../application/register-user';

// Validación de forma. Las reglas de negocio (complejidad, unicidad, roles del
// tenant) se verifican en application/dominio. roleIds son strings opacos: los
// ids del sistema conviven en formato cuid (default Prisma) y uuid (signup).
const registerUserSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(50).optional(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  roleIds: z.array(z.string().min(1)).optional(),
});

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id || !req.businessId) throw AppError.unauthorized();
    const input = registerUserSchema.parse(req.body);
    const result = await registerUser(
      { businessId: req.businessId, actorUserId: req.user.id },
      input,
      req.ip,
      req.get('user-agent'),
    );
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}
