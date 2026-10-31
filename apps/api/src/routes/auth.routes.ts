import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users, sessions } from '@openscript/database';
import { AuthService } from '../services/auth.service';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (server) => {
  // Register
  server.post('/api/v1/auth/register', async (request, reply) => {
    const parseResult = RegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { email, password, displayName } = parseResult.data;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });
    if (existingUser) {
      return reply.status(409).send({ error: 'User with this email already exists' });
    }

    const passwordHash = await AuthService.hashPassword(password);
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      displayName,
    }).returning();

    // Create session
    const rawToken = AuthService.generateSessionToken();
    const tokenHash = AuthService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessions).values({
      userId: newUser.id,
      tokenHash,
      expiresAt,
    });

    return reply.status(201).send({
      user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName },
      token: rawToken,
      expiresAt,
    });
  });

  // Login
  server.post('/api/v1/auth/login', async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid login request' });
    }

    const { email, password } = parseResult.data;
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const isValid = await AuthService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const rawToken = AuthService.generateSessionToken();
    const tokenHash = AuthService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      token: rawToken,
      expiresAt,
    };
  });

  // Logout
  server.post('/api/v1/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7);
      const tokenHash = AuthService.hashToken(rawToken);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }
    return { success: true };
  });

  // Me (current authenticated user)
  server.get('/api/v1/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rawToken = authHeader.substring(7);
    const tokenHash = AuthService.hashToken(rawToken);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.tokenHash, tokenHash),
    });

    if (!session || new Date() > session.expiresAt) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  });
};
