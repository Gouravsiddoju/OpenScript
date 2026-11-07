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
  yjsState?: string | null;
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

let dbAvailable = true;
let lastDbError = 0;

function isDbActive(): boolean {
  if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) return false;
  if (!dbAvailable && Date.now() - lastDbError < 20000) return false;
  return true;
}

function handleDbErr(err: any) {
  const msg = String(err?.message || err?.code || '');
  if (err?.code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED') || err?.name === 'AggregateError') {
    dbAvailable = false;
    lastDbError = Date.now();
  }
}

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
        return allProjects.filter((p) => p.ownerId === userId || p.ownerId === "00000000-0000-0000-0000-000000000000" || p.id === "00000000-0000-0000-0000-000000000000" || p.id === "6fcf7386-76c4-44a8-a24c-c11a1f21f353" || memberProjectIds.has(p.id));
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
        return all.filter((p) => p.ownerId === userId || p.ownerId === "00000000-0000-0000-0000-000000000000" || p.id === "00000000-0000-0000-0000-000000000000" || p.id === "6fcf7386-76c4-44a8-a24c-c11a1f21f353" || memMemberProjectIds.has(p.id));
      }
      return all;
    }
  }

  static async getProject(id: string) {
    if (isDbActive()) try {
      const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
      if (p) return p;
    } catch (err) { handleDbErr(err); }
    return memStore.projects.get(id) || null;
  }

  static async createProject(name: string, description?: string, ownerId?: string, customId?: string) {
    const id = customId || crypto.randomUUID();
    const now = new Date();
    if (isDbActive()) {
      try {
        const [p] = await db.insert(projects).values({
          id,
          name,
          description,
          ownerId: ownerId || crypto.randomUUID(),
        }).returning();
        if (p) {
          memStore.projects.set(p.id, {
            id: p.id,
            name: p.name,
            description: p.description,
            ownerId: p.ownerId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          });
          return p;
        }
      } catch (e) {
        handleDbErr(e);
      }
    }

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

  static async checkProjectAccess(projectId: string, userId: string): Promise<{ hasAccess: boolean; role: string | null }> {
    if (projectId === '00000000-0000-0000-0000-000000000000') {
      return { hasAccess: true, role: 'owner' };
    }

    if (isDbActive()) try {
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
    } catch (err) { handleDbErr(err); }

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
    if (isDbActive()) {
      try {
        const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
        if (doc) return doc;
      } catch (err) { handleDbErr(err); }
    }
    return memStore.documents.get(id) || null;
  }

  static async getProjectDocument(projectId: string) {
    if (isDbActive()) {
      try {
        const doc = await db.query.documents.findFirst({ where: eq(documents.projectId, projectId) });
        if (doc) return doc;
      } catch (err) { handleDbErr(err); }
    }
    for (const doc of memStore.documents.values()) {
      if (doc.projectId === projectId) return doc;
    }
    return null;
  }

  static async saveDocument(id: string, projectId: string, title: string, contentJson: any, revisionNumber: number) {
    const now = new Date();
    if (isDbActive()) {
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

        // Graceful concurrent document saving: monotonically advance revision without 409 deadlock
        const targetRevision = Math.max(existing.revisionNumber || 1, revisionNumber || 1) + 1;

        const [updated] = await db.update(documents)
          .set({
            contentJson,
            revisionNumber: targetRevision,
            title,
            updatedAt: now,
          })
          .where(eq(documents.id, id))
          .returning();

        return { doc: updated, newRevisionNumber: targetRevision, isConflict: false };
      } catch (err) {
        handleDbErr(err);
      }
    }

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

    const targetRevision = Math.max(existing.revisionNumber || 1, revisionNumber || 1) + 1;
    existing.contentJson = contentJson;
    existing.revisionNumber = targetRevision;
    existing.title = title;
    existing.updatedAt = now;
    return { doc: existing, newRevisionNumber: targetRevision, isConflict: false };
  }

  static async saveYjsState(id: string, yjsStateBase64: string, contentJson?: any) {
    const now = new Date();
    if (isDbActive()) {
      try {
        const updateData: any = {
          yjsState: yjsStateBase64,
          updatedAt: now,
        };
        if (contentJson) {
          updateData.contentJson = contentJson;
        }
        await db.update(documents).set(updateData).where(eq(documents.id, id));
        return true;
      } catch (err) {
        handleDbErr(err);
      }
    }
    const memDoc = memStore.documents.get(id);
    if (memDoc) {
      memDoc.yjsState = yjsStateBase64;
      if (contentJson) memDoc.contentJson = contentJson;
      memDoc.updatedAt = now;
    }
    return true;
  }

  // ---- COLLABORATORS ----
  static async listCollaborators(projectId: string) {
    if (isDbActive()) try {
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
    } catch (err) { handleDbErr(err); }

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
    // Also record invited user with placeholder in memory store
    if (!memStore.users.has(userId)) {
      memStore.users.set(userId, {
        id: userId,
        email: cleanEmail,
        displayName,
        passwordHash: 'placeholder',
        role,
        createdAt: now,
      });
    }
    if (isDbActive()) try {
      let u = await db.query.users.findFirst({ where: eq(users.email, cleanEmail) });
      if (!u) {
        const [newUser] = await db.insert(users).values({ id: userId, email: cleanEmail, passwordHash: "placeholder", displayName }).returning();
        u = newUser;
      }
      if (u) {
        await db.insert(projectMembers).values({ id, projectId, userId: u.id, role, invitedBy: invitedBy && invitedBy !== "default-owner" ? invitedBy : undefined }).onConflictDoNothing();
      }
    } catch (e) { handleDbErr(e); console.warn("[Store] DB insert projectMembers skipped/failed:", e); }
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
    if (isDbActive()) try {
      const list = await db.query.scriptNotes.findMany({
        where: eq(scriptNotes.documentId, documentId),
        orderBy: [desc(scriptNotes.createdAt)],
      });
      if (list.length > 0) return list;
    } catch (err) { handleDbErr(err); }

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
    if (isDbActive()) try {
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
    } catch (err) { handleDbErr(err); }

    for (const u of memStore.users.values()) {
      if (u.email.toLowerCase().trim() === cleanEmail) {
        return u;
      }
    }
    return null;
  }

  static async findUserById(id: string): Promise<InMemUser | null> {
    if (isDbActive()) try {
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
    } catch (err) { handleDbErr(err); }

    return memStore.users.get(id) || null;
  }

  static async createUser(email: string, passwordHash: string, displayName: string): Promise<InMemUser> {
    const cleanEmail = email.toLowerCase().trim();
    if (isDbActive()) try {
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
    } catch (err) { handleDbErr(err); }

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
    if (isDbActive()) try {
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt,
      });
    } catch (err) { handleDbErr(err); }

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
    } catch (err) { handleDbErr(err); }

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
    if (isDbActive()) try {
      await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
    } catch (err) { handleDbErr(err); }

    const memUser = memStore.users.get(userId);
    if (memUser) {
      memUser.passwordHash = newPasswordHash;
    }
    return true;
  }

  static async deleteSession(tokenHash: string) {
    if (isDbActive()) try {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    } catch (err) { handleDbErr(err); }

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
    } catch (e) { handleDbErr(e); console.warn('[Store] DB update user activation failed:', e); }

    // Update in-memory members status to active
    const targetUser = memStore.users.get(userId);
    const targetEmail = targetUser?.email?.toLowerCase();
    for (const member of memStore.members.values()) {
      if (member.userId === userId || (targetEmail && member.email.toLowerCase() === targetEmail)) {
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
