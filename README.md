> [!IMPORTANT]
> **DEVELOPER PLAYBOOK:** For the complete, code-level 2-developer task breakdown, exact algorithms, database schemas, and state machine code, see the **[Developer Execution Guide](file:///d:/PROJECTS/Scriptwriter/DEVELOPER_EXECUTION_GUIDE.md)**.
# OpenScript OSS — Professional Developer Architecture & Product Specification
*(The Production-Grade Open-Source Standard for Screenwriting, Story Development & Film Production)*

**Status:** Official Architecture Baseline & Developer Specification (Production-Grade)  
**Project Type:** Full-Featured Open-Source, Self-Hostable, Browser-Based Screenplay Writing & Pre-Production Platform  
**License:** GNU Affero General Public License v3.0 (AGPL-3.0)  
**Deployment Priority:** Self-hosted first (Zero cloud dependencies)  
**Target Domain:** `openscript.ssnpictures.in` (SSN Pictures ecosystem)  
**Target Benchmarks:** Direct open-source alternative to **Final Draft 13**, **Arc Studio Pro**, **WriterDuet**, and **Highland 2**  
**Cost Objective:** $0 recurring software spend for the core application stack  

---

## 1. Executive Summary & Scope Expansion

OpenScript OSS is a professional-grade screenplay writing and film development workspace. While initial specifications envisioned a lightweight Fountain/markdown editor, this updated specification expands Scripto into an **elaborate, enterprise-grade screenwriting suite comparable to industry-standard paid tools (Final Draft, WriterDuet, Arc Studio)**, tailored for independent screenwriters, writers' rooms, and film production houses like SSN Pictures.

The core promise remains absolute: **100% free, self-hostable, and zero proprietary cloud dependencies**, running from a clean Docker Compose stack.

### 1.1 Competitive Feature Matrix

| Feature Domain | Final Draft 13 | Arc Studio Pro | WriterDuet | Highland 2 | OpenScript OSS (Target) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Pricing** | $250+ (Perpetual/Paid) | $69–$119/yr | $99–$199/yr | $69 (Mac only) | **$0 / 100% Free & Open Source (AGPL-3.0)** |
| **Hosting / Cloud** | Proprietary Cloud | Proprietary SaaS | Proprietary SaaS | Local Files | **Self-Hostable (Docker, Caddy, Local DB)** |
| **Screenplay Formatting** | Industry Standard | Industry Standard | Industry Standard | Fountain-based | **Full Industry Standard (Courier Prime 12pt, exact indents)** |
| **Real-Time Dynamic Pagination** | Real-time Pages | Real-time Pages | Real-time Pages | Approximate | **Real-Time Virtual Page Breaks + 54-line Engine** |
| **Dual Dialogue** | Yes | Yes | Yes | Limited | **Native Side-by-Side Dual Dialogue Blocks** |
| **SmartType™ Autocomplete** | Yes | Yes | Yes | Limited | **Characters, Locations, Scene Prefixes, Time-of-Day** |
| **Tab / Enter Keystroke Engine** | Standard | Standard | Standard | Custom | **Deterministic Screenplay State Machine** |
| **Story Planning / Beat Board** | Beat Board 2.0 | Visual Plot Cards | Mind Map / Cards | Scratchpad | **Unlimited Outline Lanes + Drag-and-Drop Index Cards** |
| **Navigator / Outline** | Navigator 2.0 | Scene Outline | Filterable Scenes | Basic Navigator | **Scene Stats, Eighths of a Page, Cast/Tag Filter** |
| **Revision Mode (Colors & Stars)** | Full (9 Colors) | Color Revisions | Full Revision Cycle | Revision Asterisks | **Full Hollywood Revision Colors + Right-Margin Asterisks** |
| **Production Page Locking** | Locked Pages (A-Pages)| Locked Pages | Locked Pages | No | **Locked Pages (e.g. 24A, 24B) & Locked Scene Numbers** |
| **Production Reports** | Cast, Location, DOOD | Basic Cast | Advanced Stats | Character Stats | **Speaking Cast Report, Location/Set Report, Scene Eighths** |
| **Import / Export** | FDX, PDF | FDX, Fountain, PDF | FDX, Fountain, PDF | Fountain, PDF, FDX | **FDX (Final Draft XML), Fountain, and Standard PDF** |
| **Writing Focus & Ergonomics** | Typewriter, Sprint | Focus Mode | Typewriter View | Sprint Timer | **Typewriter Scrolling, Sprint Stopwatch, Dark/Midnight** |
| **Realtime Collaboration (Phase 2)** | Yes | Yes | Yes | No | **Yjs + Hocuspocus WebSockets (Self-Hosted)** |

---

## 🚀 Quick Start & How to Run

### Prerequisites
- **Node.js**: `v20.x` or `v22.x+` (`node -v`)
- **pnpm**: `v9.x` or `v12.x+` (enable with `corepack enable && corepack prepare pnpm@12.14.0 --activate`)
- **Git**: Installed with repository access
- *(Optional)* **Docker & Docker Compose**: For local containerized Postgres and full-stack preview

### 1. Clone & Setup Repository
```bash
git clone https://github.com/Gouravsiddoju/OpenScript.git
cd OpenScript
git checkout dev  # Active development branch
```

### 2. Install Monorepo Dependencies
```bash
pnpm install
```

### 3. Run the Automated Test Suite (Vitest)
Run all unit test suites across the monorepo (Fountain lossless parser, 54-line virtual pagination engine, AST validation):
```bash
pnpm test
```

### 4. Start Local Development Servers

You can launch both the React web application and the Fastify backend API simultaneously:

#### Run Full Stack (Frontend + Backend):
```bash
pnpm dev
```

#### Run Frontend Only (Screenplay Canvas & UI):
```bash
pnpm --filter web run dev
```
*Opens the screenplay studio interface at **`http://localhost:5173`**.*

#### Run Backend API Only (Fastify REST Server):
```bash
pnpm --filter api run dev
```
*Runs the Fastify server on **`http://localhost:3000`** (Health check: `http://localhost:3000/api/v1/health`).*

### 5. Build All Workspace Packages
```bash
pnpm build
```

---

## 🐳 Dual-Environment Hosting with Docker Compose

OpenScript provides pre-configured, production-grade Docker Compose stacks:

### A. Dev Preview Hosting (`dev.openscript.ssnpictures.in`)
Launches the staging preview stack with an isolated dev database (`openscript-dev-postgres`), Dev API, Dev Web SPA, and Caddy reverse proxy:
```bash
docker compose -f compose.dev.yaml up -d --build
```

### B. Production Release Hosting (`openscript.ssnpictures.in`)
Launches the production stack running the verified `release` branch with persistent volumes and automatic Let's Encrypt SSL:
```bash
docker compose -f compose.production.yaml up -d --build
```

---

## 🌿 Branch Workflow & Contributing
- **`release` (Default Branch):** The primary branch deployed to production (`openscript.ssnpictures.in`). Code here is strictly tested, reviewed, and approved.
- **`dev` (Development Branch):** The active branch where developers implement user stories, features, and fixes. All pull requests and feature branches merge into `dev`.

---

## 2. Professional Screenplay Formatting & Pagination Engine

Screenplay formatting is not arbitrary; it is an exact mathematical standard developed by Hollywood where **1 formatted page approximately equals 1 minute of screen time**.

### 2.1 Exact Page & Typography Standards
* **Font:** Courier Prime 12pt (10 pitch — exactly 10 characters per inch horizontally, 6 lines per inch vertically).
* **Page Dimensions:** US Letter (8.5" x 11") as primary; international A4 (8.27" x 11.69") selectable.
* **Page Margins:**
  * Top Margin: 1.0 inch (line 1 begins on line 7).
  * Bottom Margin: 1.0 inch.
  * Left Margin: 1.5 inches (0.5 inch binding allowance + 1.0 inch margin).
  * Right Margin: 1.0 inch (max text width: 6.0 inches = 60 characters).

### 2.2 Strict Block Indentations & Widths

| Element | Left Margin Offset | Left Indent from 1.5" Margin | Max Width / Length | Text Case |
| :--- | :---: | :---: | :---: | :---: |
| **Scene Heading** | 1.5" | 0.0" (column 1) | 6.0" (60 chars) | UPPERCASE |
| **Action / Description** | 1.5" | 0.0" (column 1) | 6.0" (60 chars) | Sentence case |
| **Character Cue** | 3.7" | 2.2" (column 22) | 3.8" (38 chars) | UPPERCASE |
| **Parenthetical** | 3.1" | 1.6" (column 16) | 2.4" (24 chars) | (lowercase inside parens) |
| **Dialogue** | 2.5" | 1.0" (column 10) | 3.5" (35 chars) | Sentence case |
| **Transition** | 6.0" | Right-aligned or 4.5" | ~1.5" (15 chars) | UPPERCASE + colon |
| **Shot** | 1.5" | 0.0" (column 1) | 6.0" (60 chars) | UPPERCASE |
| **Dual Dialogue (Left)** | 2.0" | 0.5" | 2.7" (27 chars) | Parallel column |
| **Dual Dialogue (Right)**| 5.0" | 3.5" | 2.7" (27 chars) | Parallel column |

### 2.3 Real-Time Dynamic Virtual Pagination Engine
Unlike generic rich-text editors that scroll infinitely, Scripto calculates page breaks dynamically as the user types:
* **Line Budget:** Exactly 54 to 55 lines per physical page.
* **Automatic `(MORE)` and `(CONT'D)` Generation:**
  * If a dialogue block crosses a page break, the engine automatically splits the dialogue, places `(MORE)` at the bottom of the first page, and inserts `CHARACTER NAME (CONT'D)` at the top of the next page.
* **Widow & Orphan Suppression:**
  * A **Scene Heading** cannot appear as the final line of a page; it must have at least 2 lines of action following it, or it is pushed to the top of the next page.
  * A **Character Cue** cannot be separated from its dialogue across a page break.
  * Single-line orphan dialogue at the top of a page is automatically prevented.
* **Visual Page Divider:** A distinct visual page boundary showing page numbers, header lines, and standard 3-hole punch indicators in the left margin.

---

## 3. High-Speed Keyboard Navigation & SmartType™ State Machine

Professional screenwriters write without touching the mouse. Scripto implements the standard industry Tab/Enter keystroke state machine.

### 3.1 Deterministic Tab/Enter State Machine

```
                   ┌──────────────────────────────────────────────┐
                   │                                              │
                   ▼                                              │ Enter (Double)
       ┌──────────────────────┐  Enter   ┌─────────────────────┐ │
       │    Scene Heading     │ ───────► │       Action        │ ─┘
       └──────────────────────┘          └─────────────────────┘
                                                │       ▲
                                            Tab │       │ Enter (on blank line)
                                                ▼       │
                                         ┌─────────────────────┐
                                         │    Character Cue    │
                                         └─────────────────────┘
                                                │
                                          Enter │
                                                ▼
       ┌──────────────────────┐  Enter   ┌─────────────────────┐
       │    Parenthetical     │ ◄─────── │      Dialogue       │
       └──────────────────────┘   Tab    └─────────────────────┘
                  │                                 │
            Enter │                           Enter │ (Double)
                  ▼                                 ▼
       ┌──────────────────────┐          ┌─────────────────────┐
       │   Dialogue (Cont'd)  │          │       Action        │
       └──────────────────────┘          └─────────────────────┘
```

| Current Block | Keystroke | Next Block Action |
| :--- | :--- | :--- |
| **Scene Heading** | `Enter` | Creates **Action** block |
| **Action** | `Enter` | Creates another **Action** block |
| **Action** | `Tab` | Converts current empty line to **Character Cue** |
| **Character Cue** | `Enter` | Creates **Dialogue** block directly beneath |
| **Dialogue** | `Tab` | Creates **Parenthetical** |
| **Dialogue** | `Enter` | Creates **Action** block (or next Character if double-pressed) |
| **Parenthetical** | `Enter` | Returns to **Dialogue** |
| **Transition** | `Enter` | Creates **Scene Heading** |

### 3.2 SmartType™ Predictive Autocomplete
* **Character Names:** As soon as a Character block is initiated, typing `M` surfaces an instantaneous popup list of all existing characters (e.g., `MAYA`, `MARCUS`), sorted by frequency. Pressing `Enter` auto-completes and shifts to Dialogue.
* **Scene Heading Prefixes:** Typing `I` automatically suggests `INT.`, `E` suggests `EXT.`, `I/E` suggests `INT./EXT.`.
* **Locations:** After typing the prefix, typing space surfaces a list of all established locations in the script (e.g., `COFFEE SHOP`, `POLICE PRECINCT - ROOFTOP`).
* **Time-of-Day:** Typing `-` surfaces `DAY`, `NIGHT`, `DAWN`, `DUSK`, `LATER`, `CONTINUOUS`, `SAME`.

---

## 4. Story Planning, Outlining & Pre-Production Suite

Comparable to Final Draft's Beat Board™ and Arc Studio's Plot Cards:

### 4.1 Visual Corkboard & Virtual Index Cards
* **One Card Per Scene:** Automatically generated from the script or created in the corkboard first.
* **Card Attributes:**
  * Scene Heading & Scene Number
  * Synopsis / Summary (up to 300 characters)
  * Act / Sequence Tag (e.g., Act 1, Inciting Incident, Midpoint, Climax)
  * Color-coded tag (e.g., Red = Thriller Plot, Blue = Romantic Subplot)
  * Cast members appearing in the scene
* **Two-Way Sync:** Dragging and dropping index cards on the Corkboard automatically reorganizes the scenes in the actual script document in real time!

### 4.2 Multi-Lane Outline Editor / Beat Board
* Horizontal or vertical timeline lanes for parallel plot tracking (A-Story, B-Story, Character Arcs).
* Built-in standard story structure templates:
  * 3-Act Classical Structure (Setup, Confrontation, Resolution)
  * Blake Snyder's *Save the Cat!* 15-Beat Sheet
  * The Hero's Journey (Monomyth)
  * Dan Harmon's Story Circle

### 4.3 Navigator 2.0 (Script Intelligence Panel)
* Collapsible sidebar displaying every scene heading.
* **Scene Length in Eighths of a Page:** Shows exact industry measurement (e.g., `Scene 14: 1 3/8 pgs`).
* **Search & Multi-Filter:**
  * Filter scenes by specific character (e.g., show only scenes where MAYA speaks).
  * Filter by INT vs. EXT or DAY vs. NIGHT.
  * In-cell editing of scene titles and summaries.

---

## 5. Production Management & Studio Revision Suite

For production houses like **SSN Pictures**, scripts go through shooting draft revisions where script locking and breakdown reports are mandatory.

### 5.1 Hollywood Standard Color Revision Cycle
When a production draft is locked, changes are tracked using industry standard revision colors:
1. **White** (Original Production Draft)
2. **Blue** (1st Revision)
3. **Pink** (2nd Revision)
4. **Yellow** (3rd Revision)
5. **Green** (4th Revision)
6. **Goldenrod** (5th Revision)
7. **Buff** (6th Revision)
8. **Salmon** (7th Revision)
9. **Cherry** (8th Revision)
10. **Second Blue / Second Pink...**

* **Revision Marks (Asterisks):** When Revision Mode is active, any edited line automatically gets an asterisk (`*`) placed in the extreme right margin.
* **Highlight Color:** Edited text can optionally be highlighted in the current revision color.

### 5.2 Production Page Locking & A-Pages
* Once the script is locked for shooting, page numbers must never change.
* If a writer adds 15 lines to Page 32, the extra text does not shift Page 33 to 34. Instead, Scripto automatically creates **Page 32A**, **Page 32B**, maintaining page continuity for production departments.
* **Locked Scene Numbers:** Inserting a scene between Scene 4 and Scene 5 automatically numbers the new scene **Scene A5** or **Scene 4A**.
* **Omitted Scenes:** Removing a scene marks it as `SCENE 12 - OMITTED` so shooting schedules remain intact.

### 5.3 Automated Production Breakdown Reports
One-click generation of essential film production reports:
1. **Cast / Speaking Report:** Every character ranked by number of speaking scenes, total dialogue lines, and word counts.
2. **Location & Set Report:** All unique scenes grouped by location (e.g., all 8 scenes at `INT. HOTEL ROOM` grouped together for shooting schedule optimization).
3. **Day-Out-of-Days (DOOD) Summary:** Visual matrix of which characters are working on which script days.
4. **Pacing & Ratio Statistics:**
   * Action vs. Dialogue percentage ratio.
   * Total estimated run time (based on 1 page = 1 min).
   * Scene duration distribution graph.

---

## 6. Dual Editing Modes & Universal Interoperability (Fountain + FDX)

### 6.1 Mode 1: Screenplay Mode (Tiptap / ProseMirror)
* Complete WYSIWYG page view with simulated paper margins, real-time page breaks, and Courier Prime rendering.
* Seamless block formatting, drag-to-reorder, and keyboard shortcuts.

### 6.2 Mode 2: Fountain Plain-Text Mode (CodeMirror 6)
* Direct source editing using John August's Fountain plain-text syntax.
* Full syntax highlighting for headings, characters, transitions, boneyard notes (`/* ... */`), synopses (`= ...`), and sections (`# ...`).
* Bidirectional round-trip engine: Switching between Screenplay Mode and Fountain Mode guarantees zero loss of document structure or metadata.

### 6.3 Final Draft XML (.fdx) Bi-Directional Interoperability
* **Import `.fdx`:** Native XML parser converting Final Draft elements, dual dialogue, script notes, and title pages directly into Scripto's canonical AST.
* **Export `.fdx`:** Export valid Final Draft 12/13 compatible XML files so writers can share scripts with directors, agents, and studios who require `.fdx`.

### 6.4 Studio-Grade PDF Export
* Export standard screenplay PDF with:
  * Industry standard Title Page (Title, Byline, Author, Based on, Contact / Agency info).
  * Dynamic Running Header (`Title - Draft Date - Page #`).
  * Scene numbers in left and right margins.
  * Revision asterisks in the right margin.
  * Custom diagonal watermark (e.g., `CONFIDENTIAL - PROPERTY OF SSN PICTURES - COPY FOR CAST`).

---

## 7. Writer Ergonomics & Focus Tools

* **Typewriter Scrolling Mode:** The active typing line is locked vertically at 40% of the screen height, scrolling the document upward smoothly as you type.
* **Writing Sprint Stopwatch & Goals:**
  * Target daily page goal or word goal (e.g., "Write 5 pages today").
  * 15/25/45-minute sprint stopwatch with notification bells.
  * Daily writing streaks and productivity analytics.
* **Dialogue Isolator / Character Filter:**
  * Highlight only one character's lines throughout the script to review their unique voice, vocabulary, and emotional progression.
* **Cinematic Dark & Midnight Themes:**
  * High-contrast OLED pure black theme (`#000000`), Dark Gray Studio theme, and classical Paper/Parchment theme.

---

## 8. Canonical Screenplay Document Schema (TypeScript AST)

```typescript
export type ScreenplayBlockType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'dualDialogue'
  | 'transition'
  | 'shot'
  | 'general'
  | 'note';

export interface InlineMark {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough';
  from: number;
  to: number;
}

export interface ScreenplayBlock {
  id: string; // Persistent UUID
  type: ScreenplayBlockType;
  text: string;
  marks?: InlineMark[];
  sceneNumber?: string; // e.g. "14", "14A"
  isOmitted?: boolean;
  revisionColor?: 'white' | 'blue' | 'pink' | 'yellow' | 'green' | 'goldenrod' | 'buff' | 'salmon' | 'cherry';
  revisionMark?: boolean; // Right-margin asterisk
  sceneMeta?: {
    location?: string;
    setting?: 'INT' | 'EXT' | 'INT/EXT';
    timeOfDay?: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | 'LATER' | 'CONTINUOUS';
    synopsis?: string;
    colorTag?: string; // Hex color for Corkboard
    act?: string; // e.g. "Act I"
    charactersPresent?: string[];
  };
  dualDialoguePair?: {
    leftCharacter: string;
    leftDialogue: string;
    rightCharacter: string;
    rightDialogue: string;
  };
}

export interface CanonicalScreenplayDocument {
  schemaVersion: 2;
  id: string;
  metadata: {
    title: string;
    credit?: string; // e.g. "written by"
    authors: string[];
    source?: string; // e.g. "Based on the short story by..."
    draftLabel: string; // e.g. "First Revised Draft"
    draftColor: string; // e.g. "Blue"
    contactInfo?: string;
    copyright?: string;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
  };
  content: ScreenplayBlock[];
}
```

---

## 9. Phased Development Roadmap

### Phase 1: MVP Core (Screenplay Engine, Fountain, Export, Projects)
* [x] Architecture & Domain Modeling.
* [x] Monorepo setup (`pnpm`, Fastify, Vite, PostgreSQL, Drizzle ORM).
* [x] Canonical AST & Zod validation schema (`@openscript/screenplay-schema`).
* [x] Tiptap WYSIWYG Screenplay Mode with Tab/Enter state machine (`packages/editor`).
* [x] Dynamic Virtual Pagination & 54-Line Page Break Engine with widow/orphan protection.
* [x] Fountain plain-text lossless parser & serializer with passing Vitest test suite (`packages/fountain`).
* [x] Local autosave, version-aware conflict detection (`409 Conflict`), and revision snapshots.
* [x] Production breakdown reports (Cast speaking stats, lines, and Location sets).
* [x] Dual-environment Docker Compose stacks & Caddy reverse proxy for `openscript.ssnpictures.in` & `dev.openscript.ssnpictures.in`.
* [ ] SmartType autocomplete (Character names & Scene Headings).
* [ ] FDX (Final Draft XML) Import & Export (`packages/fdx`).
* [ ] Studio PDF Export (with Title Page and Watermarking).

### Phase 2: Story Outlining & Production Suite
* [ ] Corkboard & Index Card View with bidirectional drag-and-drop sync.
* [ ] Beat Board & Multi-Lane Outline Editor.
* [ ] Production Draft Revision Mode (Hollywood colors + right-margin asterisks).
* [ ] Page Locking (A-Pages) & Locked Scene Numbers.
* [x] Automated Production Reports (Cast Speaking metrics, Location/Set breakdown).
* [ ] Typewriter Scrolling Mode & Sprint Stopwatch.

### Phase 3: Realtime Collaboration & Team Rooms
* [ ] Authenticated Yjs + Hocuspocus WebSocket rooms.
* [ ] Live cursors, collaborative co-writing, and presence.
* [ ] Granular role permissions (Owner, Co-Writer, Commenter/Producer, Read-Only Viewer).
* [ ] Anchored ScriptNotes & commenting threads.

---

## 10. Conclusion

OpenScript OSS is not a basic markdown editor with a script skin; it is engineered to be a **genuine, comprehensive alternative to Final Draft 13 and WriterDuet**. By building directly on standard screenplay mathematics, predictive keyboard workflows, professional revision tracking, and production breakdown reporting, Scripto empowers indie filmmakers and production houses to write, develop, and budget their films on a **100% free, private, self-hosted platform**.


