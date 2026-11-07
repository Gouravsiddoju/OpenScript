import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { ResilientStore } from '../services/store.service';
import { EmailService } from '../services/email.service';
import { RateLimiterService } from '../services/rate-limit.service';

export const StrongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

const RegisterSchema = z.object({
  email: z.string().email(),
  password: StrongPasswordSchema,
  displayName: z.string().min(2),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).optional(),
});

export const authRoutes: FastifyPluginAsync = async (server) => {
  // Forgot Password
  server.post('/api/v1/auth/forgot-password', {
    schema: {
      tags: ['Authentication'],
      description: 'Send a secure password reset link to user email',
    },
  }, async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Valid email address required' });
    }

    const { email } = parseResult.data;
    const clientIp = request.ip || '127.0.0.1';
    const rateLimitKey = `forgot:${clientIp}:${email.toLowerCase()}`;
    const limitStatus = RateLimiterService.check(rateLimitKey, 3, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!limitStatus.isAllowed) {
      return reply.status(429).send({
        error: `Too many password reset requests. Please wait ${Math.ceil(limitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
        retryAfterSeconds: limitStatus.retryAfterSeconds,
      });
    }
    RateLimiterService.recordFailure(rateLimitKey, 3, 15 * 60 * 1000, 15 * 60 * 1000);

    const user = await ResilientStore.findUserByEmail(email);

    if (user) {
      const rawResetToken = AuthService.generateSessionToken();
      const tokenHash = AuthService.hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await ResilientStore.createPasswordReset(user.id, tokenHash, expiresAt);
      await EmailService.sendPasswordResetEmail(user.email, rawResetToken, user.displayName);
    }

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  });

  // Reset Password with Token
  server.post('/api/v1/auth/reset-password', {
    schema: {
      tags: ['Authentication'],
      description: 'Reset password using secure token from email',
    },
  }, async (request, reply) => {
    const schema = z.object({
      token: z.string().min(10, 'Valid reset token required'),
      newPassword: StrongPasswordSchema,
    });
    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { token, newPassword } = parseResult.data;
    const tokenHash = AuthService.hashToken(token);

    const resetRecord = await ResilientStore.findPasswordReset(tokenHash);
    if (!resetRecord) {
      return reply.status(400).send({ error: 'Invalid or expired password reset link. Please request a new one.' });
    }

    const user = await ResilientStore.findUserById(resetRecord.userId);
    if (!user) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    const newHash = await AuthService.hashPassword(newPassword);
    await ResilientStore.updateUserPassword(user.id, newHash);
    await ResilientStore.consumePasswordReset(tokenHash);

    const rawToken = AuthService.generateSessionToken();
    const sessionHash = AuthService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await ResilientStore.createSession(user.id, sessionHash, expiresAt);

    return {
      success: true,
      message: 'Password successfully updated! You are now logged in.',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'owner',
      },
      token: rawToken,
      expiresAt,
    };
  });

  // Register
  server.post('/api/v1/auth/register', {
    schema: {
      tags: ['Authentication'],
      description: 'Register a new user account',
    },
  }, async (request, reply) => {
    const parseResult = RegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { email, password, displayName } = parseResult.data;

    const existingUser = await ResilientStore.findUserByEmail(email);
    if (existingUser) {
      // Check if this is an invited collaborator completing their account registration
      const isInvitedPlaceholder = !existingUser.passwordHash || existingUser.passwordHash === 'placeholder' || existingUser.passwordHash.length < 10;

      if (isInvitedPlaceholder) {
        const passwordHash = await AuthService.hashPassword(password);
        const activatedUser = await ResilientStore.activateInvitedUser(existingUser.id, passwordHash, displayName);

        const rawToken = AuthService.generateSessionToken();
        const tokenHash = AuthService.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await ResilientStore.createSession(existingUser.id, tokenHash, expiresAt);

        return reply.status(200).send({
          user: {
            id: existingUser.id,
            email: existingUser.email,
            displayName: activatedUser?.displayName || displayName.trim() || existingUser.displayName,
            role: activatedUser?.role || 'co-writer',
          },
          token: rawToken,
          expiresAt,
          message: 'Account successfully activated! Welcome to OpenScript Studio.',
        });
      }

      return reply.status(409).send({ error: 'User with this email already exists' });
    }

    const passwordHash = await AuthService.hashPassword(password);
    const newUser = await ResilientStore.createUser(email, passwordHash, displayName);

    // Create session
    const rawToken = AuthService.generateSessionToken();
    const tokenHash = AuthService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await ResilientStore.createSession(newUser.id, tokenHash, expiresAt);

    return reply.status(201).send({
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role || 'owner',
      },
      token: rawToken,
      expiresAt,
    });
  });

  // Login
  server.post('/api/v1/auth/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Sign in with email and password',
    },
  }, async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid login request' });
    }

    const { email, password } = parseResult.data;
    const clientIp = request.ip || '127.0.0.1';
    const rateLimitKey = `login:${clientIp}:${email.toLowerCase()}`;
    const limitStatus = RateLimiterService.check(rateLimitKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!limitStatus.isAllowed) {
      return reply.status(429).send({
        error: `Too many failed login attempts. Please wait ${Math.ceil(limitStatus.retryAfterSeconds / 60)} minutes before trying again.`,
        retryAfterSeconds: limitStatus.retryAfterSeconds,
      });
    }

    const user = await ResilientStore.findUserByEmail(email);

    if (!user) {
      RateLimiterService.recordFailure(rateLimitKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Check if user was invited and has a placeholder password
    const isInvitedPlaceholder = !user.passwordHash || user.passwordHash === 'placeholder' || user.passwordHash.length < 10;
    if (isInvitedPlaceholder) {
      if (password && password.length >= 6) {
        // Seamlessly activate and set their password!
        const passwordHash = await AuthService.hashPassword(password);
        const activatedUser = await ResilientStore.activateInvitedUser(user.id, passwordHash);

        const rawToken = AuthService.generateSessionToken();
        const tokenHash = AuthService.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await ResilientStore.createSession(user.id, tokenHash, expiresAt);

        return {
          user: {
            id: user.id,
            email: user.email,
            displayName: activatedUser?.displayName || user.displayName,
            role: activatedUser?.role || 'co-writer',
          },
          token: rawToken,
          expiresAt,
          message: 'Welcome! Your invited account has been activated and your password set.',
        };
      }

      return reply.status(400).send({
        error: 'You have been invited to collaborate! Please enter a password of at least 6 characters or switch to "Create Production Account" to complete your profile.',
        isInvited: true,
      });
    }

    // Verify password securely with bcrypt
    const isValid = await AuthService.verifyPassword(password, user.passwordHash);

    if (!isValid) {
      RateLimiterService.recordFailure(rateLimitKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    RateLimiterService.reset(rateLimitKey);

    const rawToken = AuthService.generateSessionToken();
    const tokenHash = AuthService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await ResilientStore.createSession(user.id, tokenHash, expiresAt);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'owner',
      },
      token: rawToken,
      expiresAt,
    };
  });

  // Logout
  server.post('/api/v1/auth/logout', {
    schema: {
      tags: ['Authentication'],
      description: 'Sign out and invalidate session',
    },
  }, async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7);
      const tokenHash = AuthService.hashToken(rawToken);
      await ResilientStore.deleteSession(tokenHash);
    }
    return { success: true };
  });

  // Me (current authenticated user)
  server.get('/api/v1/auth/me', {
    schema: {
      tags: ['Authentication'],
      description: 'Retrieve current authenticated profile',
    },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rawToken = authHeader.substring(7);
    const tokenHash = AuthService.hashToken(rawToken);

    const session = await ResilientStore.findSession(tokenHash);
    if (!session || new Date() > new Date(session.expiresAt)) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }

    const user = await ResilientStore.findUserById(session.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'owner',
      },
    };
  });

  // Update profile
  server.patch('/api/v1/auth/profile', {
    schema: {
      tags: ['Authentication'],
      description: 'Update current user profile info',
    },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rawToken = authHeader.substring(7);
    const tokenHash = AuthService.hashToken(rawToken);

    const session = await ResilientStore.findSession(tokenHash);
    if (!session || new Date() > new Date(session.expiresAt)) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }

    const user = await ResilientStore.findUserById(session.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const parseResult = UpdateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }

    if (parseResult.data.displayName) {
      user.displayName = parseResult.data.displayName;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'owner',
      },
    };
  });

  // Change password for logged-in user
  server.post('/api/v1/auth/change-password', {
    schema: {
      tags: ['Authentication'],
      description: 'Change password while authenticated',
    },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Sign in required' });
    }

    const rawToken = authHeader.substring(7);
    const currentTokenHash = AuthService.hashToken(rawToken);

    const session = await ResilientStore.findSession(currentTokenHash);
    if (!session || new Date() > new Date(session.expiresAt)) {
      return reply.status(401).send({ error: 'Session expired or invalid. Please sign in again.' });
    }

    const user = await ResilientStore.findUserById(session.userId);
    if (!user) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    const schema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: StrongPasswordSchema,
    });
    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.issues[0]?.message || 'Validation failed' });
    }

    const { currentPassword, newPassword } = parseResult.data;

    // Verify current password with timing-safe scrypt
    const isCurrentValid = await AuthService.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return reply.status(401).send({ error: 'Current password is incorrect. Please re-enter.' });
    }

    const newHash = await AuthService.hashPassword(newPassword);
    await ResilientStore.updateUserPassword(user.id, newHash);
    // Keep current session active while revoking all other sessions across devices
    await ResilientStore.revokeAllUserSessions(user.id, currentTokenHash);

    return {
      success: true,
      message: 'Password successfully changed! All other sessions have been signed out for security.',
    };
  });

  // Revoke all sessions except current
  server.post('/api/v1/auth/revoke-all-sessions', {
    schema: {
      tags: ['Authentication'],
      description: 'Sign out all other sessions across devices',
    },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Sign in required' });
    }

    const rawToken = authHeader.substring(7);
    const currentTokenHash = AuthService.hashToken(rawToken);

    const session = await ResilientStore.findSession(currentTokenHash);
    if (!session || new Date() > new Date(session.expiresAt)) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }

    await ResilientStore.revokeAllUserSessions(session.userId, currentTokenHash);
    return {
      success: true,
      message: 'All other active devices and sessions have been signed out successfully.',
    };
  });
};
