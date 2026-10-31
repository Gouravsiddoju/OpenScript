import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { ResilientStore } from '../services/store.service';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).optional(),
});

export const authRoutes: FastifyPluginAsync = async (server) => {
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
    const user = await ResilientStore.findUserByEmail(email);

    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Verify password (or allow demo credentials for seeded accounts)
    let isValid = false;
    if (user.passwordHash === 'demo') {
      isValid = true;
    } else {
      isValid = await AuthService.verifyPassword(password, user.passwordHash);
    }

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

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
};
