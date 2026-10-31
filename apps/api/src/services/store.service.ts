import { db, projects, documents, documentRevisions, projectMembers, scriptNotes, scriptNoteReplies, users } from '@openscript/database';
import { eq, and, desc, asc } from 'drizzle-orm';
import { CanonicalScreenplayDocument } from '@openscript/screenplay-schema';

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

  constructor() {
    // Seed default demo project & document
    const defaultProjectId = '00000000-0000-0000-0000-000000000000';
    const defaultOwnerId = '11111111-1111-1111-1111-111111111111';

    this.projects.set(defaultProjectId, {
      id: defaultProjectId,
      name: 'SSN Studios Master Production',
      description: 'Default screenplay workspace for SSN Pictures',
      ownerId: defaultOwnerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed default project members
    this.members.set(`${defaultProjectId}_${defaultOwnerId}`, {
      id: crypto.randomUUID(),
      projectId: defaultProjectId,
      userId: defaultOwnerId,
      role: 'owner',
      email: 'gourav@ssnpictures.in',
      displayName: 'Gourav (SSN)',
      createdAt: new Date(),
    });

    this.members.set(`${defaultProjectId}_22222222-2222-2222-2222-222222222222`, {
      id: crypto.randomUUID(),
      projectId: defaultProjectId,
      userId: '22222222-2222-2222-2222-222222222222',
      role: 'co-writer',
      email: 'navateja@ssnpictures.in',
      displayName: 'Navateja',
      createdAt: new Date(),
    });

    this.members.set(`${defaultProjectId}_33333333-3333-3333-3333-333333333333`, {
      id: crypto.randomUUID(),
      projectId: defaultProjectId,
      userId: '33333333-3333-3333-3333-333333333333',
      role: 'commenter',
      email: 'sarah.prod@hollywood.com',
      displayName: 'Sarah (Producer)',
      createdAt: new Date(),
    });
  }
}

export const memStore = new MemoryStore();

/**
 * Universal Resilient Store Service that safely queries PostgreSQL,
 * falling back gracefully to memory store if PostgreSQL is unreachable.
 */
export class ResilientStore {
  // ---- PROJECTS ----
  static async listProjects() {
    try {
      return await db.query.projects.findMany({ orderBy: [desc(projects.updatedAt)] });
    } catch {
      return Array.from(memStore.projects.values());
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
              email: u?.email || 'unknown@ssnpictures.in',
              displayName: u?.displayName || 'Collaborator',
              createdAt: m.createdAt,
            };
          })
        );
      }
    } catch {}

    return Array.from(memStore.members.values()).filter((m) => m.projectId === projectId);
  }

  static async addCollaborator(projectId: string, email: string, role: string, invitedBy?: string) {
    const userId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const displayName = email.split('@')[0];
    const member: InMemMember = {
      id,
      projectId,
      userId,
      role,
      email,
      displayName,
      invitedBy,
      createdAt: new Date(),
    };
    memStore.members.set(`${projectId}_${userId}`, member);
    return member;
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
}
