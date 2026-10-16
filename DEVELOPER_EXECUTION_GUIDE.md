# Scripto OSS — Comprehensive Developer Execution Guide & Technical Blueprint
*(Complete Implementation Playbook for Developer 1 & Developer 2)*

**Document Version:** 1.0.0 (Production Blueprint)  
**Target Repository:** `d:\PROJECTS\Scriptwriter`  
**License:** GNU Affero General Public License v3.0 (AGPL-3.0)  
**Target Domain:** `scripto.ssnpictures.in`  
**Objective:** Provide both developers with a 100% complete, unambiguous, code-level execution manual to build Scripto OSS from scratch without missing a single detail or blocking one another.

---

## 1. System Topology & Monorepo Architecture

The project is structured as a `pnpm` monorepo.

```text
d:\PROJECTS\Scriptwriter/
├── apps/
│   ├── web/                           # [DEV 1] React 19 + Vite + Tailwind CSS + shadcn/ui
│   │   ├── src/
│   │   │   ├── components/            # UI components (Navbar, Sidebar, Modals, Corkboard)
│   │   │   ├── editor/                # Editor canvas, virtual pages, SmartType overlay
│   │   │   ├── hooks/                 # useAutosave, usePagination, useSmartType
│   │   │   ├── pages/                 # Dashboard, ProjectView, ScriptEditorPage
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── api/                           # [DEV 2] Fastify REST API Backend
│   │   ├── src/
│   │   │   ├── routes/                # auth, projects, documents, revisions, exports, reports
│   │   │   ├── services/              # auth.service, document.service, revision.service
│   │   │   ├── plugins/               # session.plugin, db.plugin, auth.guard
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── export-worker/                 # [DEV 2] Headless Chromium PDF Generation Worker
│       ├── src/
│       │   ├── templates/             # HTML/CSS screenplay print template
│       │   ├── pdf-generator.ts       # Puppeteer rendering logic
│       │   └── worker.ts
│       └── package.json
│
├── packages/
│   ├── screenplay-schema/             # [SHARED CONTRACT - DEV 2 LEADS, DEV 1 CONSUMES]
│   │   ├── src/
│   │   │   ├── blocks.ts              # Zod schemas & TS types for all block elements
│   │   │   ├── document.ts            # CanonicalScreenplayDocument AST
│   │   │   ├── revisions.ts           # Revision & concurrency tokens
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── editor/                        # [DEV 1] Tiptap/ProseMirror Extensions
│   │   ├── src/
│   │   │   ├── nodes/                 # SceneHeading, Action, Character, Dialogue, etc.
│   │   │   ├── extensions/            # Keymap (Tab/Enter state machine), SmartTypePlugin
│   │   │   ├── pagination/            # 54-line virtual page divider engine
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── fountain/                      # [DEV 2] Fountain Parser & Serializer
│   │   ├── src/
│   │   │   ├── parser.ts              # Fountain string -> Canonical AST
│   │   │   ├── serializer.ts          # Canonical AST -> Fountain string
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── fdx/                           # [DEV 2] Final Draft XML Import/Export Engine
│   │   ├── src/
│   │   │   ├── fdx-parser.ts          # .fdx XML -> Canonical AST
│   │   │   ├── fdx-serializer.ts      # Canonical AST -> .fdx XML
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── database/                      # [DEV 2] PostgreSQL + Drizzle ORM Schema & Migrations
│       ├── src/
│       │   ├── schema/                # users, sessions, projects, documents, revisions
│       │   ├── migrations/            # Drizzle generated migration files
│       │   ├── client.ts              # Drizzle DB client instance
│       │   └── index.ts
│       └── package.json
│
├── compose.yaml                       # [DEV 2] Local Docker Compose (PostgreSQL)
├── compose.production.yaml            # [DEV 2] Production Docker Compose (Web, API, DB, Caddy)
├── Caddyfile                          # [DEV 2] Caddy SSL & Reverse Proxy configuration
├── pnpm-workspace.yaml                # Monorepo Workspace Configuration
├── package.json                       # Root package.json (dev scripts)
└── tsconfig.base.json                 # Shared base TypeScript configuration
```

---

## 2. The Shared Contract: `packages/screenplay-schema`

Both developers rely on this package. It must be written first to establish the canonical data model.

### File: `packages/screenplay-schema/src/blocks.ts`
```typescript
import { z } from 'zod';

export const ScreenplayBlockTypeSchema = z.enum([
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'dualDialogue',
  'transition',
  'shot',
  'general',
  'note'
]);
export type ScreenplayBlockType = z.infer<typeof ScreenplayBlockTypeSchema>;

export const InlineMarkSchema = z.object({
  type: z.enum(['bold', 'italic', 'underline', 'strikethrough']),
  from: z.number(),
  to: z.number(),
});
export type InlineMark = z.infer<typeof InlineMarkSchema>;

export const RevisionColorSchema = z.enum([
  'white',
  'blue',
  'pink',
  'yellow',
  'green',
  'goldenrod',
  'buff',
  'salmon',
  'cherry'
]);
export type RevisionColor = z.infer<typeof RevisionColorSchema>;

export const SceneMetaSchema = z.object({
  setting: z.enum(['INT', 'EXT', 'INT/EXT']).optional(),
  location: z.string().optional(),
  timeOfDay: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS', 'SAME']).optional(),
  synopsis: z.string().max(500).optional(),
  colorTag: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  act: z.string().optional(),
  charactersPresent: z.array(z.string()).default([]),
  pageLengthEighths: z.number().int().min(1).optional(), // e.g. 11 = 1 3/8 pgs
});
export type SceneMeta = z.infer<typeof SceneMetaSchema>;

export const ScreenplayBlockSchema = z.object({
  id: z.string().uuid(),
  type: ScreenplayBlockTypeSchema,
  text: z.string(),
  marks: z.array(InlineMarkSchema).optional().default([]),
  sceneNumber: z.string().optional(), // e.g. "12", "12A"
  isOmitted: z.boolean().optional().default(false),
  revisionColor: RevisionColorSchema.optional(),
  revisionMark: z.boolean().optional().default(false), // Right margin asterisk '*'
  sceneMeta: SceneMetaSchema.optional(),
  dualDialogue: z.object({
    leftCharacter: z.string(),
    leftDialogue: z.string(),
    rightCharacter: z.string(),
    rightDialogue: z.string(),
  }).optional(),
});
export type ScreenplayBlock = z.infer<typeof ScreenplayBlockSchema>;
```

### File: `packages/screenplay-schema/src/document.ts`
```typescript
import { z } from 'zod';
import { ScreenplayBlockSchema } from './blocks';

export const CanonicalDocumentMetadataSchema = z.object({
  title: z.string().default('Untitled Screenplay'),
  credit: z.string().default('written by'),
  authors: z.array(z.string()).default([]),
  source: z.string().optional(), // e.g. "Based on the true story of..."
  draftLabel: z.string().default('First Draft'),
  draftColor: z.string().default('White'),
  contactInfo: z.string().optional(),
  copyright: z.string().optional(),
  isLocked: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CanonicalDocumentMetadata = z.infer<typeof CanonicalDocumentMetadataSchema>;

export const CanonicalScreenplayDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  revisionNumber: z.number().int().min(1),
  metadata: CanonicalDocumentMetadataSchema,
  content: z.array(ScreenplayBlockSchema),
});
export type CanonicalScreenplayDocument = z.infer<typeof CanonicalScreenplayDocumentSchema>;
```

---

## 3. DEVELOPER 1: Complete Implementation Manual
*(Frontend, Editor Engine, Virtual Pagination, SmartType, Story Boards)*

### 3.1 Industry Mathematical Screenplay CSS (`packages/editor/src/styles.css`)
Developer 1 must configure the editor viewport using exact typography standards:
```css
/* Screenplay Paper Canvas */
.screenplay-page {
  width: 8.5in;
  min-height: 11.0in;
  padding: 1.0in 1.0in 1.0in 1.5in; /* Top: 1", Right: 1", Bottom: 1", Left: 1.5" */
  background: #ffffff;
  color: #000000;
  font-family: 'Courier Prime', Courier, monospace;
  font-size: 12pt;
  line-height: 1.0;
  letter-spacing: 0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  margin: 20px auto;
  position: relative;
}

/* Screenplay Element Indents (calculated from 1.5in left margin) */
.script-scene-heading {
  margin-top: 24pt; /* 2 blank lines */
  margin-bottom: 12pt;
  margin-left: 0;
  text-transform: uppercase;
  font-weight: bold;
}

.script-action {
  margin-top: 12pt;
  margin-bottom: 12pt;
  margin-left: 0;
  width: 6.0in; /* 60 characters */
}

.script-character {
  margin-top: 12pt;
  margin-bottom: 0;
  margin-left: 2.2in; /* 3.7in from left paper edge */
  width: 3.8in;
  text-transform: uppercase;
}

.script-parenthetical {
  margin-top: 0;
  margin-bottom: 0;
  margin-left: 1.6in; /* 3.1in from left paper edge */
  width: 2.4in;
}

.script-dialogue {
  margin-top: 0;
  margin-bottom: 12pt;
  margin-left: 1.0in; /* 2.5in from left paper edge */
  width: 3.5in; /* 35 characters */
}

.script-transition {
  margin-top: 12pt;
  margin-bottom: 12pt;
  margin-left: 4.5in; /* 6.0in from left paper edge */
  text-align: right;
  text-transform: uppercase;
}

/* Revision Asterisk in Right Margin */
.revision-marker::after {
  content: "*";
  position: absolute;
  right: -0.5in;
  color: #c00000;
  font-weight: bold;
}
```

### 3.2 Tab / Enter Keyboard State Machine Plugin (`packages/editor/src/extensions/keymap.ts`)
Developer 1 will intercept keystrokes with this exact state machine:
```typescript
import { Extension } from '@tiptap/core';

export const ScreenplayKeymap = Extension.create({
  name: 'screenplayKeymap',

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;
        const text = currentBlock.textContent.trim();

        // 1. Scene Heading + Enter -> Create Action
        if (blockType === 'sceneHeading') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        // 2. Action + Enter on empty line -> Keep Action or Switch
        if (blockType === 'action') {
          if (text === '') {
            return editor.chain().setNode('character').run();
          }
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        // 3. Character + Enter -> Create Dialogue
        if (blockType === 'character') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'dialogue' }).focus().run();
        }

        // 4. Parenthetical + Enter -> Create Dialogue
        if (blockType === 'parenthetical') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'dialogue' }).focus().run();
        }

        // 5. Dialogue + Enter -> Create Action (or Character if double entered)
        if (blockType === 'dialogue') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        return false;
      },

      'Tab': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;

        // Action + Tab -> Convert to Character Cue
        if (blockType === 'action') {
          return editor.chain().setNode('character').run();
        }

        // Dialogue + Tab -> Convert to Parenthetical
        if (blockType === 'dialogue') {
          return editor.chain().setNode('parenthetical').run();
        }

        // Character + Tab -> Convert to Transition
        if (blockType === 'character') {
          return editor.chain().setNode('transition').run();
        }

        return true; // Prevent default focus loss
      },
    };
  },
});
```

### 3.3 Dynamic Virtual Pagination Engine (`packages/editor/src/pagination/engine.ts`)
Algorithm Developer 1 will implement to calculate physical pages in real time:
```typescript
import { ScreenplayBlock } from '@scripto/screenplay-schema';

export interface CalculatedPage {
  pageNumber: number;
  blocks: ScreenplayBlock[];
}

const LINES_PER_PAGE = 54;

export function paginateScreenplay(blocks: ScreenplayBlock[]): CalculatedPage[] {
  const pages: CalculatedPage[] = [];
  let currentPageBlocks: ScreenplayBlock[] = [];
  let currentLineCount = 0;
  let pageNumber = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockLines = calculateBlockHeightInLines(block);

    // Check if adding block exceeds page line budget
    if (currentLineCount + blockLines > LINES_PER_PAGE) {
      // WIDOW/ORPHAN PROTECTION:
      // If block is a Scene Heading or Character Cue, do not strand at bottom
      if (block.type === 'sceneHeading' || block.type === 'character') {
        pages.push({ pageNumber, blocks: currentPageBlocks });
        currentPageBlocks = [block];
        currentLineCount = blockLines;
        pageNumber++;
        continue;
      }

      // DIALOGUE SPLIT LOGIC:
      if (block.type === 'dialogue' && currentLineCount + 3 <= LINES_PER_PAGE) {
        const availableLines = LINES_PER_PAGE - currentLineCount - 1; // 1 line for (MORE)
        const { firstHalfText, secondHalfText } = splitDialogueText(block.text, availableLines);

        currentPageBlocks.push({ ...block, text: firstHalfText });
        currentPageBlocks.push({ id: crypto.randomUUID(), type: 'parenthetical', text: '(MORE)' });
        pages.push({ pageNumber, blocks: currentPageBlocks });

        // Carry over to next page
        const previousChar = findPreviousCharacter(blocks, i);
        currentPageBlocks = [
          { id: crypto.randomUUID(), type: 'character', text: `${previousChar} (CONT'D)` },
          { ...block, id: crypto.randomUUID(), text: secondHalfText }
        ];
        currentLineCount = 1 + calculateDialogueLines(secondHalfText);
        pageNumber++;
        continue;
      }

      // Default: push whole block to next page
      pages.push({ pageNumber, blocks: currentPageBlocks });
      currentPageBlocks = [block];
      currentLineCount = blockLines;
      pageNumber++;
    } else {
      currentPageBlocks.push(block);
      currentLineCount += blockLines;
    }
  }

  if (currentPageBlocks.length > 0) {
    pages.push({ pageNumber, blocks: currentPageBlocks });
  }

  return pages;
}

function calculateBlockHeightInLines(block: ScreenplayBlock): number {
  if (block.type === 'sceneHeading') return 3; // 2 blank lines + 1 text line
  if (block.type === 'action') return Math.ceil(block.text.length / 60) + 1; // text lines + 1 blank line
  if (block.type === 'character') return 2; // 1 blank line + 1 text line
  if (block.type === 'parenthetical') return 1;
  if (block.type === 'dialogue') return Math.ceil(block.text.length / 35);
  if (block.type === 'transition') return 2;
  return 2;
}

function calculateDialogueLines(text: string): number {
  return Math.ceil(text.length / 35);
}

function splitDialogueText(text: string, lines: number): { firstHalfText: string; secondHalfText: string } {
  const words = text.split(' ');
  const targetChars = lines * 35;
  let splitIndex = 0;
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1;
    if (charCount >= targetChars) {
      splitIndex = i;
      break;
    }
  }

  return {
    firstHalfText: words.slice(0, splitIndex).join(' '),
    secondHalfText: words.slice(splitIndex).join(' '),
  };
}

function findPreviousCharacter(blocks: ScreenplayBlock[], currentIndex: number): string {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (blocks[i].type === 'character') {
      return blocks[i].text.replace(/\s*\(CONT'D\)/gi, '');
    }
  }
  return 'CHARACTER';
}
```

### 3.4 Corkboard & Index Card Synchronizer (`apps/web/src/components/Corkboard.tsx`)
* Developer 1 will build a grid using `@dnd-kit/core` or `react-beautiful-dnd`.
* Each card displays: `sceneNumber`, `sceneHeading`, `synopsis`, `colorTag`, and `pageLengthEighths`.
* When an index card is dragged from index `A` to index `B`, Developer 1 updates the canonical AST by extracting all blocks belonging to Scene `A` and moving them before Scene `B`.

---

## 4. DEVELOPER 2: Complete Implementation Manual
*(Backend, PostgreSQL Schema, Concurrency, Fountain/FDX Parsers, PDF Worker, Reports)*

### 4.1 Database Schema with Drizzle ORM (`packages/database/src/schema.ts`)
```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  schemaVersion: integer('schema_version').default(2).notNull(),
  contentJson: jsonb('content_json').notNull(), // Stores CanonicalScreenplayDocument AST
  revisionNumber: integer('revision_number').default(1).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documentRevisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  revisionNumber: integer('revision_number').notNull(),
  contentSnapshot: jsonb('content_snapshot').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reason: text('reason'), // e.g. "Manual Checkpoint", "Production Blue Draft"
}, (table) => {
  return {
    docRevUnique: uniqueIndex('doc_rev_unique_idx').on(table.documentId, table.revisionNumber),
  };
});
```

### 4.2 Fastify Atomic Concurrency & Autosave API (`apps/api/src/routes/documents.ts`)
Developer 2 must implement atomic revision locking to eliminate silent overwrites:
```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '@scripto/database';
import { documents, documentRevisions } from '@scripto/database/schema';
import { CanonicalScreenplayDocumentSchema } from '@scripto/screenplay-schema';

export const documentRoutes: FastifyPluginAsync = async (server) => {
  server.patch<{
    Params: { id: string };
    Body: { revisionNumber: number; content: any; title?: string };
  }>('/api/v1/documents/:id', async (request, reply) => {
    const { id } = request.params;
    const { revisionNumber, content, title } = request.body;

    // 1. Validate AST strictly with Zod
    const parsedDoc = CanonicalScreenplayDocumentSchema.safeParse(content);
    if (!parsedDoc.success) {
      return reply.status(400).send({ error: 'Invalid document schema', details: parsedDoc.error });
    }

    // 2. ATOMIC UPDATE: Check revision_number = client's known revision
    const updated = await db
      .update(documents)
      .set({
        contentJson: parsedDoc.data,
        revisionNumber: revisionNumber + 1,
        title: title || parsedDoc.data.metadata.title,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.revisionNumber, revisionNumber)))
      .returning();

    // 3. Conflict Detection
    if (updated.length === 0) {
      const currentDoc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
      return reply.status(409).send({
        error: 'Conflict: Document has been modified by another session',
        serverRevisionNumber: currentDoc?.revisionNumber,
      });
    }

    // 4. Save revision snapshot every 10 revisions
    if ((revisionNumber + 1) % 10 === 0) {
      await db.insert(documentRevisions).values({
        documentId: id,
        revisionNumber: revisionNumber + 1,
        contentSnapshot: parsedDoc.data,
        reason: 'Automated 10-revision checkpoint',
      });
    }

    return {
      success: true,
      newRevisionNumber: revisionNumber + 1,
      updatedAt: updated[0].updatedAt,
    };
  });
};
```

### 4.3 Lossless Fountain Parser & Serializer (`packages/fountain/src/`)
Developer 2 will write the parser matching Fountain syntax specifications:
```typescript
import { ScreenplayBlock, CanonicalScreenplayDocument } from '@scripto/screenplay-schema';

export function parseFountain(fountainText: string): ScreenplayBlock[] {
  const lines = fountainText.split('\n');
  const blocks: ScreenplayBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Scene Heading: INT., EXT., INT/EXT, or forced with '.'
    if (/^(\.(?![.\s])|INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(line)) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: line.replace(/^\./, '').toUpperCase(),
      });
      continue;
    }

    // Transition: ends with 'TO:' or forced with '>'
    if (/( TO:$|^>[^<]*$)/.test(line)) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'transition',
        text: line.replace(/^>/, '').trim().toUpperCase(),
      });
      continue;
    }

    // Character: all uppercase, no lowercase letters, or forced with '@'
    if (/^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(line) && !line.endsWith(':') && line.length < 35) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'character',
        text: line.toUpperCase(),
      });

      // Following line is parenthetical or dialogue
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
          blocks.push({ id: crypto.randomUUID(), type: 'parenthetical', text: nextLine });
          i++;
        }
      }
      continue;
    }

    // Default to Action
    blocks.push({
      id: crypto.randomUUID(),
      type: 'action',
      text: line,
    });
  }

  return blocks;
}

export function serializeFountain(doc: CanonicalScreenplayDocument): string {
  return doc.content.map(block => {
    switch (block.type) {
      case 'sceneHeading': return `\n${block.text}\n`;
      case 'character': return `\n${block.text}`;
      case 'parenthetical': return `${block.text}`;
      case 'dialogue': return `${block.text}\n`;
      case 'transition': return `\n> ${block.text}\n`;
      case 'action':
      default: return `${block.text}\n`;
    }
  }).join('\n');
}
```

### 4.4 Automated Production Breakdown Engine (`apps/api/src/services/reports.service.ts`)
Developer 2 will write the query algorithms to generate film production reports:
```typescript
import { CanonicalScreenplayDocument } from '@scripto/screenplay-schema';

export interface CastSpeakingReportItem {
  characterName: string;
  totalScenes: number;
  totalDialogueBlocks: number;
  totalWords: number;
  percentageOfScript: number;
}

export function generateCastSpeakingReport(doc: CanonicalScreenplayDocument): CastSpeakingReportItem[] {
  const castMap = new Map<string, { scenes: Set<number>; dialogueCount: number; wordCount: number }>();
  let currentSceneIndex = 0;
  let totalScriptWords = 0;

  for (let i = 0; i < doc.content.length; i++) {
    const block = doc.content[i];
    if (block.type === 'sceneHeading') {
      currentSceneIndex++;
    }

    if (block.type === 'character') {
      const cleanName = block.text.replace(/\s*\(.*\)$/g, '').trim().toUpperCase();
      if (!castMap.has(cleanName)) {
        castMap.set(cleanName, { scenes: new Set(), dialogueCount: 0, wordCount: 0 });
      }

      const entry = castMap.get(cleanName)!;
      entry.scenes.add(currentSceneIndex);

      // Check next block for dialogue
      if (i + 1 < doc.content.length && doc.content[i + 1].type === 'dialogue') {
        const words = doc.content[i + 1].text.trim().split(/\s+/).length;
        entry.dialogueCount++;
        entry.wordCount += words;
        totalScriptWords += words;
      }
    }
  }

  return Array.from(castMap.entries()).map(([characterName, data]) => ({
    characterName,
    totalScenes: data.scenes.size,
    totalDialogueBlocks: data.dialogueCount,
    totalWords: data.wordCount,
    percentageOfScript: totalScriptWords > 0 ? Number(((data.wordCount / totalScriptWords) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.totalWords - a.totalWords);
}
```

---

## 5. Master Sprint Execution Plan

### Sprint 1: Monorepo Foundation & Schema Handshake
* **Dev 2:**
  - Initialize root `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`.
  - Create `packages/screenplay-schema` with complete Zod schemas and TypeScript interfaces.
  - Setup local PostgreSQL with `compose.yaml`.
* **Dev 1:**
  - Scaffold `apps/web` using Vite + React 19 + Tailwind CSS + shadcn/ui.
  - Install `@scripto/screenplay-schema` workspace dependency.
  - Setup basic application shell (Navbar, sidebar layout, dark/light theme toggle).

### Sprint 2: Core Editor & REST API
* **Dev 1:**
  - Create `packages/editor` with Tiptap custom nodes (`sceneHeading`, `action`, `character`, `dialogue`, `parenthetical`).
  - Apply exact screenplay CSS margins (Courier Prime 12pt, 1.5" left binding margin).
* **Dev 2:**
  - Setup `packages/database` with Drizzle ORM and run initial migrations (`users`, `sessions`, `projects`, `documents`).
  - Build Fastify authentication endpoints (`/api/v1/auth/register`, `/api/v1/auth/login`).
  - Build Project & Document CRUD endpoints.

### Sprint 3: High-Speed Typing Flow & Safe Autosave
* **Dev 1:**
  - Implement the Tab/Enter keyboard state machine extension.
  - Implement SmartType™ floating autocomplete overlay for character names and scene locations.
* **Dev 2:**
  - Implement atomic optimistic locking in `PATCH /api/v1/documents/:id` with `409 Conflict` detection.
  - Implement automatic snapshot revisions in `document_revisions` table.
  - Wire frontend `useAutosave` hook with server response.

### Sprint 4: Fountain Mode & Round-Trip Lossless Engine
* **Dev 1:**
  - Build CodeMirror 6 Fountain editor component with syntax highlighting.
  - Implement Mode Toggle (Screenplay WYSIWYG $\leftrightarrow$ Fountain Plain Text).
* **Dev 2:**
  - Build `packages/fountain` (parser & serializer).
  - Write automated Vitest round-trip tests to verify zero loss of formatting, parentheticals, and notes.

### Sprint 5: Virtual Pagination & Local PDF Generation
* **Dev 1:**
  - Implement the 54-line mathematical dynamic virtual pagination engine.
  - Add auto-splitting of dialogue blocks across pages with `(MORE)` and `(CONT'D)`.
  - Add visual page break boundaries and page number counters.
* **Dev 2:**
  - Build `apps/export-worker` using Puppeteer.
  - Implement studio screenplay PDF template (Title page, headers, footers, scene numbers, watermarking).

### Sprint 6: Story Planning Boards & Production Tools
* **Dev 1:**
  - Build Visual Corkboard (Index Cards) using `@dnd-kit/core` with drag-and-drop reordering.
  - Build Navigator 2.0 with scene length in eighths of a page ($1/8$ to $7/8$).
* **Dev 2:**
  - Build `packages/fdx` for Final Draft 12/13 XML import and export.
  - Build Production Breakdown API: Cast speaking report, Location/Set report, and script statistics.

### Sprint 7: Hardening, Polish & Deployment
* **Dev 1:**
  - Typewriter scrolling mode (locking active line at 40% viewport).
  - Writing Sprint stopwatch and daily page targets.
  - Midnight high-contrast dark theme.
* **Dev 2:**
  - Setup `compose.production.yaml` with Caddy automatic Let's Encrypt HTTPS for `scripto.ssnpictures.in`.
  - Backup scripts and database restoration drill.
  - AGPL-3.0 and third-party license audit.

---

## 6. Definition of Done & Quality Verification

Before releasing any sprint milestone, the following test checklist must pass:
1. **Schema Integrity:** Every block validates against `ScreenplayBlockSchema` with no unknown properties.
2. **Tab/Enter Fidelity:** An entire 5-page scene can be written from memory using only `Tab`, `Enter`, and alphanumeric keys without touching the mouse.
3. **Save Concurrency:** Two browser tabs open to the same script cannot overwrite each other; the second tab must receive a `409 Conflict` alert.
4. **Fountain Round-Trip:** `serializeFountain(parseFountain(text)) === text` across standard test fixtures.
5. **FDX Compatibility:** An exported `.fdx` file opens natively in Final Draft 12/13 without formatting errors.
6. **Zero Cloud Expense:** Entire stack builds, tests, and runs locally with `docker compose up` with zero paid third-party API keys.
