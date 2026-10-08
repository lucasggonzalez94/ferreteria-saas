import { Router } from 'express';
import { signupController } from './signup.controller';
import {
  loginController,
  logoutController,
  refreshController,
  restoreSessionController,
} from './session.controller';
import { passwordController } from './password.controller';
import { authenticate } from '../../../platform/security/authenticate';
import {
  loginRateLimiter,
  refreshRateLimiter,
  resetPasswordRateLimiter,
  signupRateLimiter,
} from './rate-limit';

// Módulo identity: frontera pública de AUTH-01..06 migrada.
const router = Router();
router.post('/signup', signupRateLimiter, signupController);
router.post('/login', loginRateLimiter, loginController);
router.post('/refresh', refreshRateLimiter, refreshController);
router.get('/restore-session', restoreSessionController);
router.post('/logout', logoutController);
router.post('/forgot-password', resetPasswordRateLimiter, passwordController.forgot);
router.post('/reset-password', resetPasswordRateLimiter, passwordController.reset);
router.post('/change-password', authenticate, passwordController.change);

export default router;
