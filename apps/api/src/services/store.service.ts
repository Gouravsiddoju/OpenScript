import { db, projects, documents, documentRevisions, projectMembers, scriptNotes, scriptNoteReplies, users, sessions } from '@openscript/database';
import { eq, and, desc, asc } from 'drizzle-orm';
import { CanonicalScreenplayDocument } from '@openscript/screenplay-schema';

export interface InMemUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
}

export interface InMemPasswordReset {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface InMemSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface InMemProject {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemDocument {
  id: string;
  projectId: string;
  title: string;
  schemaVersion: number;
  contentJson: any;
  revisionNumber: number;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  email: string;
  displayName: string;
  invitedBy?: string;
  status?: string;
  invitedAt?: Date;
  createdAt: Date;
}

export interface InMemNote {
  id: string;
  documentId: string;
  blockId: string;
  authorId?: string;
  authorName: string;
  authorColor: string;
  category: string;
  content: string;
  isResolved: boolean;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  replies?: InMemReply[];
}

export interface InMemReply {
  id: string;
  noteId: string;
  authorId?: string;
  authorName: string;
  authorColor: string;
  content: string;
  createdAt: Date;
}

// In-memory data store for resilient offline/development fallback
class MemoryStore {
  projects = new Map<string, InMemProject>();
  documents = new Map<string, InMemDocument>();
  documentRevisions = new Map<string, any[]>();
  members = new Map<string, InMemMember>();
  notes = new Map<string, InMemNote>();
  replies = new Map<string, InMemReply[]>();
  users = new Map<string, InMemUser>();
  sessions = new Map<string, InMemSession>();
  passwordResets = new Map<string, InMemPasswordReset>();

  constructor() {
    // Clean production store: no dummy demo seed users or mock collaborators
  }
}

export const memStore = new MemoryStore();

/**
 * Universal Resilient Store Service that safely queries PostgreSQL,
 * falling back gracefully to memory store if PostgreSQL is unreachable.
 */
export class ResilientStore {
  // ---- PROJECTS ----
  static async listProjects(userId?: string) {
    try {
      if (userId) {
        const memberRows = await db.query.projectMembers.findMany({
          where: eq(projectMembers.userId, userId),
        });
        const memberProjectIds = new Set(memberRows.map((m) => m.projectId));

        const allProjects = await db.query.projects.findMany({ orderBy: [desc(projects.updatedAt)] });
        return allProjects.filter((p) => p.ownerId === userId || memberProjectIds.has(p.id));
      }
      return await db.query.projects.findMany({ orderBy: [desc(projects.updatedAt)] });
    } catch {
      const all = Array.from(memStore.projects.values());
      if (userId) {
        const memMemberProjectIds = new Set(
          Array.from(memStore.members.values())
            .filter((m) => m.userId === userId)
            .map((m) => m.projectId)
        );
        return all.filter((p) => p.ownerId === userId || memMemberProjectIds.has(p.id));
      }
      return all;
    }
  }

  static async getProject(id: string) {
    try {
      const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
      if (p) return p;
    } catch {}
    return memStore.projects.get(id) || null;
  }

  static async createProject(name: string, description?: string, ownerId?: string) {
    const id = crypto.randomUUID();
    const now = new Date();
    try {
      const [p] = await db.insert(projects).values({
        id,
        name,
        description,
        ownerId: ownerId || crypto.randomUUID(),
      }).returning();
      return p;
    } catch {
      const p: InMemProject = {
        id,
        name,
        description: description || null,
        ownerId: ownerId || crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      memStore.projects.set(id, p);
      return p;
    }
  }

  static async checkProjectAccess(projectId: string, userId: string): Promise<{ hasAccess: boolean; role: string | null }> {
    if (projectId === '00000000-0000-0000-0000-000000000000') {
      return { hasAccess: true, role: 'owner' };
    }

    try {
      const p = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (p && p.ownerId === userId) {
        return { hasAccess: true, role: 'owner' };
      }

      const m = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        ),
      });
      if (m) {
        return { hasAccess: true, role: m.role };
      }
    } catch {}

    const memProj = memStore.projects.get(projectId);
    if (memProj && memProj.ownerId === userId) {
      return { hasAccess: true, role: 'owner' };
    }

    const memMem = memStore.members.get(`${projectId}_${userId}`);
    if (memMem) {
      return { hasAccess: true, role: memMem.role };
    }

    return { hasAccess: false, role: null };
  }

  // ---- DOCUMENTS ----
  static async getDocument(id: string) {
    try {
      const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
      if (doc) return doc;
    } catch {}
    return memStore.documents.get(id) || null;
  }

  static async saveDocument(id: string, projectId: string, title: string, contentJson: any, revisionNumber: number) {
    const now = new Date();
    try {
      const existing = await db.query.documents.findFirst({ where: eq(documents.id, id) });
      if (!existing) {
        const [doc] = await db.insert(documents).values({
          id,
          projectId,
          title,
          schemaVersion: 2,
          contentJson,
          revisionNumber: 1,
          isLocked: false,
        }).returning();
        return { doc, newRevisionNumber: 1, isConflict: false };
      }

      // Check revision match for optimistic locking
      if (existing.revisionNumber !== revisionNumber) {
        return { isConflict: true, serverRevisionNumber: existing.revisionNumber };
      }

      const [updated] = await db.update(documents)
        .set({
          contentJson,
          revisionNumber: revisionNumber + 1,
          title,
          updatedAt: now,
        })
        .where(and(eq(documents.id, id), eq(documents.revisionNumber, revisionNumber)))
        .returning();

      return { doc: updated, newRevisionNumber: revisionNumber + 1, isConflict: false };
    } catch {
      // Memory store fallback
      const existing = memStore.documents.get(id);
      if (!existing) {
        const doc: InMemDocument = {
          id,
          projectId,
          title,
          schemaVersion: 2,
          contentJson,
          revisionNumber: 1,
          isLocked: false,
          createdAt: now,
          updatedAt: now,
        };
        memStore.documents.set(id, doc);
        return { doc, newRevisionNumber: 1, isConflict: false };
      }

      if (existing.revisionNumber !== revisionNumber) {
        return { isConflict: true, serverRevisionNumber: existing.revisionNumber };
      }

      existing.contentJson = contentJson;
      existing.revisionNumber = revisionNumber + 1;
      existing.title = title;
      existing.updatedAt = now;
      return { doc: existing, newRevisionNumber: existing.revisionNumber, isConflict: false };
    }
  }

  // ---- COLLABORATORS ----
  static async listCollaborators(projectId: string) {
    try {
      const members = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, projectId),
      });
      if (members.length > 0) {
        return await Promise.all(
          members.map(async (m) => {
            const u = await db.query.users.findFirst({ where: eq(users.id, m.userId) });
            return {
              id: m.id,
              userId: m.userId,
              projectId: m.projectId,
              role: m.role,
              email: u?.email || 'collaborator@studio.com',
              displayName: u?.displayName || 'Collaborator',
              status: 'active',
              lastSeenAt: m.createdAt,
              createdAt: m.createdAt,
            };
          })
        );
      }
    } catch {}

    return Array.from(memStore.members.values()).filter((m) => m.projectId === projectId);
  }

  static async addCollaborator(projectId: string, email: string, role: string, invitedBy?: string) {
    const cleanEmail = email.trim().toLowerCase();

    // Check for duplicate in-memory members
    for (const [key, existing] of memStore.members.entries()) {
      if (existing.projectId === projectId && existing.email.toLowerCase() === cleanEmail) {
        // Gracefully update role if changed
        existing.role = role;
        return { collaborator: existing, isDuplicate: true };
      }
    }

    const userId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const displayName = cleanEmail.split('@')[0];
    const now = new Date();
    const member: InMemMember = {
      id,
      projectId,
      userId,
      role,
      email: cleanEmail,
      displayName,
      invitedBy,
      status: 'pending',
      invitedAt: now,
      createdAt: now,
    };
    memStore.members.set(`${projectId}_${userId}`, member);
    try {
      let u = await db.query.users.findFirst({ where: eq(users.email, cleanEmail) });
      if (!u) {
        const [newUser] = await db.insert(users).values({ id: userId, email: cleanEmail, passwordHash: "placeholder", displayName }).returning();
        u = newUser;
      }
      if (u) {
        await db.insert(projectMembers).values({ id, projectId, userId: u.id, role, invitedBy: invitedBy && invitedBy !== "default-owner" ? invitedBy : undefined }).onConflictDoNothing();
      }
    } catch (e) {
      console.warn("[Store] DB insert projectMembers skipped/failed:", e);
    }
    return { collaborator: member, isDuplicate: false };
  }

  static async updateCollaboratorRole(projectId: string, userId: string, role: string) {
    const key = `${projectId}_${userId}`;
    const member = memStore.members.get(key);
    if (member) {
      member.role = role;
      return member;
    }
    return null;
  }

  static async removeCollaborator(projectId: string, userId: string) {
    const key = `${projectId}_${userId}`;
    return memStore.members.delete(key);
  }

  // ---- SCRIPTNOTES ----
  static async listNotes(documentId: string) {
    try {
      const list = await db.query.scriptNotes.findMany({
        where: eq(scriptNotes.documentId, documentId),
        orderBy: [desc(scriptNotes.createdAt)],
      });
      if (list.length > 0) return list;
    } catch {}

    const notesList = Array.from(memStore.notes.values())
      .filter((n) => n.documentId === documentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return notesList.map((n) => ({
      ...n,
      replies: memStore.replies.get(n.id) || [],
    }));
  }

  static async createNote(
    documentId: string,
    blockId: string,
    authorName: string,
    authorColor: string,
    category: string,
    content: string,
    authorId?: string
  ) {
    const id = crypto.randomUUID();
    const now = new Date();
    const note: InMemNote = {
      id,
      documentId,
      blockId,
      authorId,
      authorName,
      authorColor,
      category,
      content,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
      replies: [],
    };
    memStore.notes.set(id, note);
    memStore.replies.set(id, []);
    return note;
  }

  static async addReply(noteId: string, authorName: string, authorColor: string, content: string, authorId?: string) {
    const id = crypto.randomUUID();
    const replyItem: InMemReply = {
      id,
      noteId,
      authorId,
      authorName,
      authorColor,
      content,
      createdAt: new Date(),
    };
    if (!memStore.replies.has(noteId)) {
      memStore.replies.set(noteId, []);
    }
    memStore.replies.get(noteId)!.push(replyItem);
    return replyItem;
  }

  static async toggleResolve(noteId: string, isResolved: boolean) {
    const note = memStore.notes.get(noteId);
    if (note) {
      note.isResolved = isResolved;
      note.resolvedAt = isResolved ? new Date() : null;
      note.updatedAt = new Date();
      return note;
    }
    return null;
  }

  static async deleteNote(noteId: string) {
    memStore.notes.delete(noteId);
    memStore.replies.delete(noteId);
    return true;
  }

  // ---- USERS & AUTH ----
  static async findUserByEmail(email: string): Promise<InMemUser | null> {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.email, cleanEmail),
      });
      if (u) {
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          passwordHash: u.passwordHash,
          role: 'owner',
          createdAt: u.createdAt,
        };
      }
    } catch {}

    for (const u of memStore.users.values()) {
      if (u.email.toLowerCase().trim() === cleanEmail) {
        return u;
      }
    }
    return null;
  }

  static async findUserById(id: string): Promise<InMemUser | null> {
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      if (u) {
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          passwordHash: u.passwordHash,
          role: 'owner',
          createdAt: u.createdAt,
        };
      }
    } catch {}

    return memStore.users.get(id) || null;
  }

  static async createUser(email: string, passwordHash: string, displayName: string): Promise<InMemUser> {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const [u] = await db.insert(users).values({
        email: cleanEmail,
        passwordHash,
        displayName,
      }).returning();
      if (u) {
        const userObj: InMemUser = {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          passwordHash: u.passwordHash,
          role: 'owner',
          createdAt: u.createdAt,
        };
        memStore.users.set(u.id, userObj);
        return userObj;
      }
    } catch {}

    const id = crypto.randomUUID();
    const userObj: InMemUser = {
      id,
      email: cleanEmail,
      displayName,
      passwordHash,
      role: 'owner',
      createdAt: new Date(),
    };
    memStore.users.set(id, userObj);
    return userObj;
  }

  static async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    try {
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt,
      });
    } catch {}

    memStore.sessions.set(tokenHash, {
      userId,
      tokenHash,
      expiresAt,
    });
  }

  static async findSession(tokenHash: string): Promise<InMemSession | null> {
    try {
      const s = await db.query.sessions.findFirst({
        where: eq(sessions.tokenHash, tokenHash),
      });
      if (s) return s as InMemSession;
    } catch {}

    return memStore.sessions.get(tokenHash) || null;
  }

  static async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    memStore.passwordResets.set(tokenHash, {
      userId,
      tokenHash,
      expiresAt,
    });
  }

  static async findPasswordReset(tokenHash: string): Promise<InMemPasswordReset | null> {
    const pr = memStore.passwordResets.get(tokenHash);
    if (!pr) return null;
    if (new Date() > new Date(pr.expiresAt)) {
      memStore.passwordResets.delete(tokenHash);
      return null;
    }
    return pr;
  }

  static async consumePasswordReset(tokenHash: string) {
    memStore.passwordResets.delete(tokenHash);
  }

  static async updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
    try {
      await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
    } catch {}

    const memUser = memStore.users.get(userId);
    if (memUser) {
      memUser.passwordHash = newPasswordHash;
    }
    return true;
  }

  static async deleteSession(tokenHash: string) {
    try {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    } catch {}

    memStore.sessions.delete(tokenHash);
  }

  static async activateInvitedUser(userId: string, newPasswordHash: string, displayName?: string): Promise<InMemUser | null> {
    const cleanName = displayName?.trim();
    try {
      const updateData: any = { 
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      };
      if (cleanName) {
        updateData.displayName = cleanName;
      }
      await db.update(users).set(updateData).where(eq(users.id, userId));
    } catch (e) {
      console.warn('[Store] DB update user activation failed:', e);
    }

    // Update in-memory members status to active
    for (const member of memStore.members.values()) {
      if (member.userId === userId) {
        member.status = 'active';
        if (cleanName) member.displayName = cleanName;
      }
    }

    const memUser = memStore.users.get(userId);
    if (memUser) {
      memUser.passwordHash = newPasswordHash;
      if (cleanName) memUser.displayName = cleanName;
      return memUser;
    }

    return await this.findUserById(userId);
  }
}
