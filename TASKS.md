# OpenScript OSS — Master Agile Task Breakdown & Architecture Roadmap
*(The Production-Grade Open-Source Standard for Screenwriting, Story Development & Film Production)*

**Repository:** `Gouravsiddoju/OpenScript`  
**License:** AGPL-3.0  
**Target Domain:** `openscript.ssnpictures.in`  
**Lead Architect & Product Owner:** `@Gouravsiddoju`  
**Frontend & UI Engineering:** `@poshalanavateja` (Navateja)  
**Agile Tracker:** [GitHub Project #6 — Prioritized Backlog](https://github.com/users/Gouravsiddoju/projects/6/views/1?system_template=feature_release)


---

## 🧭 Executive Architecture & Domain Overview

OpenScript is built on a modular monorepo structure:
- `packages/screenplay-schema`: Canonical TypeScript & Zod AST for blocks, metadata, and production revisions.
- `packages/editor`: Tiptap screenplay engine, mathematical styling (Courier Prime 12pt), keystroke state machine, and 54-line virtual pagination.
- `packages/fountain`: Lossless Fountain plain-text parser and serializer.
- `packages/fdx`: Final Draft XML import and export engine.
- `packages/database`: PostgreSQL Drizzle ORM schema (users, projects, documents, revisions, production metadata).
- `apps/api`: Fastify REST API with Scrypt auth, optimistic locking autosave, and production report engines.
- `apps/web`: React 19 + Vite + Tailwind CSS Screenplay Studio, Corkboard, and Navigator.

---

## 📋 Comprehensive Agile Breakdown: Epics, Stories & Features

### EPIC 1: Professional Screenplay Editor & Keyboard State Machine
> *Goal: Enable continuous, frictionless writing adhering strictly to Hollywood formatting mathematics without ever touching the mouse.*

#### Story 1.1: Full Element Keyboard Navigation (Tab / Enter State Machine)
- [x] **Feature 1.1.1:** Enter on Scene Heading creates Action line.
- [x] **Feature 1.1.2:** Enter on Character cue creates Dialogue.
- [x] **Feature 1.1.3:** Enter on Dialogue creates Action.
- [x] **Feature 1.1.4:** Full cyclic `Tab` & `Shift+Tab` across all 6 elements (Scene Heading $\leftrightarrow$ Action $\leftrightarrow$ Character $\leftrightarrow$ Parenthetical $\leftrightarrow$ Dialogue $\leftrightarrow$ Transition).
- [x] **Feature 1.1.5:** Forced element shortcuts (`Ctrl+1` Scene Heading, `Ctrl+2` Action, `Ctrl+3` Character, `Ctrl+4` Parenthetical, `Ctrl+5` Dialogue, `Ctrl+6` Transition).

#### Story 1.2: Strict Typography & Auto-Formatting
- [x] **Feature 1.2.1:** Courier Prime 12pt font with exact 10 pitch, 1.5" left margin, 1.0" top/bottom/right margins.
- [x] **Feature 1.2.2:** Proper indentation for Character (2.2"), Parenthetical (1.6"), Dialogue (1.0", max width 3.5"), and Transition (right-aligned).
- [x] **Feature 1.2.3:** Strict Auto-Capitalization: Scene Headings auto-capitalize input and enforce uppercase sluglines (`INT.`, `EXT.`).
- [x] **Feature 1.2.4:** Character cue auto-capitalization and extension support (`(V.O.)`, `(O.S.)`, `(CONT'D)`).
- [ ] **Feature 1.2.5:** Native Dual Dialogue blocks (parallel speech columns).

#### Story 1.3: Predictive SmartType™ Autocomplete
- [x] **Feature 1.3.1:** Character Name Autocomplete: As you type in a Character cue, a floating popover or ghost text shows matching characters from the script; press `Tab` or `Enter` to accept.
- [x] **Feature 1.3.2:** Scene Location Autocomplete: Suggests existing sets/locations when typing in Scene Heading.
- [x] **Feature 1.3.3:** Transition Autocomplete: Suggests `CUT TO:`, `FADE OUT:`, `DISSOLVE TO:`, `SMASH CUT TO:` with single-key tab completion.
- [x] **Feature 1.3.4:** Time-of-Day Autocomplete (`DAY`, `NIGHT`, `DAWN`, `DUSK`, `CONTINUOUS`, `LATER`).

#### Story 1.4: Real-Time Dynamic Virtual Pagination Engine
- [x] **Feature 1.4.1:** Real-time 54-line Hollywood budget per physical page.
- [x] **Feature 1.4.2:** Widow/Orphan protection: Scene Headings and Character cues never stranded at bottom of page.
- [x] **Feature 1.4.3:** Dialogue splitting: automatically splits dialogue crossing page breaks with `(MORE)` and `(CONT'D)`.
- [ ] **Feature 1.4.4:** Multi-Page Canvas Rendering: visual page gap divider with page numbers and 3-hole punch indicators.

---

### EPIC 2: Story Outlining & Structure (Navigator & Corkboard)
> *Goal: Provide high-level story development, act sequencing, and scene beat boards synchronized with the script.*

#### Story 2.1: Final Draft-Style Scene Navigator & Outliner
- [x] **Feature 2.1.1:** Real-time Scene Heading extraction in sidebar with smooth-scroll jumping.
- [x] **Feature 2.1.2:** '+ Add Scene' button in Navigator and Canvas header.
- [x] **Feature 2.1.3:** Scene Folders, Acts (Act I, Act II, Act III), and Sequence grouping.
- [ ] **Feature 2.1.4:** Scene Metadata Editor: attach synopsis, color tag, characters present, and scene length (in eighths).
- [x] **Feature 2.1.5:** Selective Scene Export / Print: choose specific acts or scenes to export.

#### Story 2.2: Visual Corkboard & Beat Board
- [x] **Feature 2.2.1:** Grid and freeform index cards representing scenes.
- [x] **Feature 2.2.2:** Bidirectional story navigation: opening an index card immediately focuses and jumps to the scene in the script.
- [x] **Feature 2.2.3:** Card color-coding and metadata by setting (INT vs EXT), scene action snippets, and cast present.

---

### EPIC 3: Pre-Production Breakdown & Reports Suite
> *Goal: Automate line-producing, scheduling, and cast budgeting straight from the script.*

#### Story 3.1: Cast & Dialogue Metrics
- [x] **Feature 3.1.1:** Cast speaking table calculating line count, word count, and speaking percentage.
- [ ] **Feature 3.1.2:** Character interaction matrix: see which characters share scenes.
- [ ] **Feature 3.1.3:** Filter script by character to view only their dialogue (actor rehearsal view).

#### Story 3.2: Location & Schedule Breakdown
- [x] **Feature 3.2.1:** Group scenes by setting (INT vs EXT) and set location.
- [ ] **Feature 3.2.2:** Scene eighths calculation (1/8 of a page increments) for shoot scheduling.
- [ ] **Feature 3.2.3:** Day Out of Days (DOOD) cast availability matrix report.

---

### EPIC 4: Production Draft Revisions & Script Locking
> *Goal: Support industry-standard shooting draft revision cycles on film sets.*

#### Story 4.1: Production Revision Mode
- [ ] **Feature 4.1.1:** Standard Hollywood revision color sequence: White $\to$ Blue $\to$ Pink $\to$ Yellow $\to$ Green $\to$ Goldenrod $\to$ Buff $\to$ Salmon $\to$ Cherry.
- [ ] **Feature 4.1.2:** Right-margin revision asterisks (`*`) automatically generated for edited lines.
- [ ] **Feature 4.1.3:** Revision snapshot diffing: compare draft revisions side-by-side.

#### Story 4.2: Production Page & Scene Locking
- [ ] **Feature 4.2.1:** Locked Scene Numbering: inserting a scene after Scene 12 creates 12A, 12B.
- [ ] **Feature 4.2.2:** Locked Page Numbering: text overflowing a locked page creates A-Pages (e.g. 24A, 24B).

---

### EPIC 5: Universal Interoperability & Studio Export
> *Goal: Zero vendor lock-in with lossless round-trip support for Fountain, Final Draft FDX, and PDF.*

#### Story 5.1: Fountain Lossless Round-Trip
- [x] **Feature 5.1.1:** Fountain parser and serializer core (`packages/fountain`).
- [x] **Feature 5.1.2:** Live bidirectional synchronization between Fountain Plain-Text view and Paper Canvas in UI.
- [x] **Feature 5.1.3:** One-click `.fountain` export and download.

#### Story 5.2: Final Draft (FDX) Compatibility
- [ ] **Feature 5.2.1:** `.fdx` XML import: parse Final Draft scripts into canonical OpenScript AST.
- [ ] **Feature 5.2.2:** `.fdx` XML export: generate standard Final Draft 12/13 files with full paragraph styling.

#### Story 5.3: Studio PDF Generation
- [x] **Feature 5.3.1:** High-fidelity browser print rendering for US Letter PDF.
- [x] **Feature 5.3.2:** Industry Title Page generator (Title, Author, Based on, Contact info, Draft date).
- [ ] **Feature 5.3.3:** Watermarking engine (Confidential, Draft, Recipient Name).

---

### EPIC 6: Cloud Persistence, Concurrency & Self-Hosting
> *Goal: $0 cloud spend, self-hosted deployment with enterprise-grade data protection.*

#### Story 6.1: Concurrency & Autosave
- [x] **Feature 6.1.1:** Client-side local persistence (`localStorage`) fallback.
- [x] **Feature 6.1.2:** Optimistic concurrency control with HTTP `409 Conflict` detection in Fastify API.
- [x] **Feature 6.1.3:** Drizzle ORM PostgreSQL schema for users, sessions, documents, and revisions.

#### Story 6.2: Dual-Environment Self-Hosting
- [x] **Feature 6.2.1:** Production Docker Compose (`compose.production.yaml`) with Caddy HTTPS for `openscript.ssnpictures.in`.
- [x] **Feature 6.2.2:** Dev Staging Docker Compose (`compose.dev.yaml`) for `dev.openscript.ssnpictures.in`.
- [x] **Feature 6.2.3:** GitHub Actions CI/CD pipeline (`.github/workflows/ci-cd.yml`).

---

## ⏱️ Dynamic Agile Sprint Cadence & Timeline
*(Calibrated strictly by issue count: > 10 issues = 1 week; <= 10 issues = 2–3 days)*

| Sprint | Milestone & Focus Area | Issue Count | Duration | Start Date | End Date | Project #6 Iteration |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Sprint 1** | Architecture Baseline & Foundation | 3 issues | **3 Days** | Oct 17, 2026 | Oct 19, 2026 | `Sprint 1 (3d - 3 issues)` |
| **Sprint 2** | Screenplay Editor & Keystroke State Machine | 11 issues | **1 Week (7d)** | Oct 20, 2026 | Oct 26, 2026 | `Sprint 2 (7d - 11 issues)` |
| **Sprint 3** | Concurrency Engine & SmartType Autocomplete | 5 issues | **3 Days** | Oct 27, 2026 | Oct 29, 2026 | `Sprint 3 (3d - 5 issues)` |
| **Sprint 4** | Virtual Pagination & Production Breakdowns | 6 issues | **3 Days** | Oct 30, 2026 | Nov 01, 2026 | `Sprint 4 (3d - 6 issues)` |
| **Sprint 5** | Visual Corkboard & Story Outlining | 4 issues | **3 Days** | Nov 02, 2026 | Nov 04, 2026 | `Sprint 5 (3d - 4 issues)` |
| **Sprint 6** | Production Revisions & Self-Hosted Release | 1 issue | **2 Days** | Nov 05, 2026 | Nov 06, 2026 | `Sprint 6 (2d - 1 issues)` |

