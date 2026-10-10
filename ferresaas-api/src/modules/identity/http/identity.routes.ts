import { Router } from 'express';
import { signupController } from './signup.controller';
import {
  loginController,
  logoutController,
  refreshController,
  restoreSessionController,
} from './session.controller';
import { passwordController } from './password.controller';
import { profileController } from './profile.controller';
import { registerController } from './register.controller';
import { currentIdentityController } from './current-identity.controller';
import { authenticate, requirePermissions } from '../../../platform/security/authenticate';
import { PERMISSIONS } from '../../../config/constants';
import {
  loginRateLimiter,
  refreshRateLimiter,
  resetPasswordRateLimiter,
  signupRateLimiter,
} from './rate-limit';

// Módulo identity: frontera HTTP de AUTH-01..08 migrada.
const router = Router();
router.post('/signup', signupRateLimiter, signupController);
router.post('/login', loginRateLimiter, loginController);
router.post('/refresh', refreshRateLimiter, refreshController);
router.get('/restore-session', restoreSessionController);
router.post('/logout', logoutController);
router.post('/forgot-password', resetPasswordRateLimiter, passwordController.forgot);
router.post('/reset-password', resetPasswordRateLimiter, passwordController.reset);
router.post('/change-password', authenticate, passwordController.change);
router.put('/profile', authenticate, profileController.update);
router.post('/register', authenticate, requirePermissions(PERMISSIONS.USERS_CREATE), registerController);
router.get('/me', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
}, authenticate, currentIdentityController);

export default router;
