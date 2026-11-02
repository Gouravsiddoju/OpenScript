import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://openscript:openscript_secret@localhost:5432/openscript';

// Client for queries
export const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL ? 1 : 10,
});

export const db = drizzle(queryClient, { schema });
