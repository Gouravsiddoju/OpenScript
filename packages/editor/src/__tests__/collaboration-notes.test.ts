import { describe, it, expect } from 'vitest';
import { 
  ScriptNoteSchema, 
  ScriptNoteReplySchema,
  LivePresenceSchema,
  canEditScreenplay,
  canAddNotes,
  canProposeSceneTakes,
  canFinalizeSceneTake,
  canReorderScenes,
  canManageTeam,
  isWatermarkRequired,
  SceneTakeSchema,
  CollaboratorRole
} from '@openscript/screenplay-schema';

describe('Phase 3 Collaboration & ScriptNotes Engine', () => {
  it('validates canonical ScriptNote schema with thread replies', () => {
    const noteId = '11111111-1111-1111-1111-111111111111';
    const blockId = '22222222-2222-2222-2222-222222222222';
    const docId = '33333333-3333-3333-3333-333333333333';

    const note = ScriptNoteSchema.parse({
      id: noteId,
      blockId,
      documentId: docId,
      authorName: 'Navateja',
      authorColor: '#3b82f6',
      category: 'dialogue',
      content: 'Make dialogue punchier to accelerate scene pacing.',
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          authorName: 'Gourav (SSN)',
          authorColor: '#f59e0b',
          content: 'Agreed. Revised in Pink Draft.',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(note.category).toBe('dialogue');
    expect(note.authorName).toBe('Navateja');
    expect(note.replies.length).toBe(1);
    expect(note.replies[0].authorName).toBe('Gourav (SSN)');
    expect(note.resolved).toBe(false);
  });

  it('enforces strict role-based edit permissions (canEditScreenplay)', () => {
    expect(canEditScreenplay('owner')).toBe(true);
    expect(canEditScreenplay('co-writer')).toBe(true);
    expect(canEditScreenplay('guest')).toBe(false);
    expect(canEditScreenplay('commenter')).toBe(false);
    expect(canEditScreenplay('reader')).toBe(false);
  });

  it('enforces feedback permissions (canAddNotes)', () => {
    expect(canAddNotes('owner')).toBe(true);
    expect(canAddNotes('co-writer')).toBe(true);
    expect(canAddNotes('guest')).toBe(true);
    expect(canAddNotes('commenter')).toBe(true);
    expect(canAddNotes('reader')).toBe(false);
  });

  it('enforces scene takes proposal vs finalization authority (canProposeSceneTakes & canFinalizeSceneTake)', () => {
    // Both owner and co-writer can propose takes
    expect(canProposeSceneTakes('owner')).toBe(true);
    expect(canProposeSceneTakes('co-writer')).toBe(true);
    expect(canProposeSceneTakes('guest')).toBe(false);
    expect(canProposeSceneTakes('reader')).toBe(false);

    // ONLY the Owner can finalize and choose the winning scene take
    expect(canFinalizeSceneTake('owner')).toBe(true);
    expect(canFinalizeSceneTake('co-writer')).toBe(false);
    expect(canFinalizeSceneTake('guest')).toBe(false);
    expect(canFinalizeSceneTake('reader')).toBe(false);
  });

  it('enforces scene structural management and team administration', () => {
    expect(canReorderScenes('owner')).toBe(true);
    expect(canReorderScenes('co-writer')).toBe(true);
    expect(canReorderScenes('guest')).toBe(false);
    expect(canReorderScenes('reader')).toBe(false);

    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('co-writer')).toBe(false);
    expect(canManageTeam('guest')).toBe(false);
    expect(canManageTeam('reader')).toBe(false);
  });

  it('enforces security watermark rules for read-only roles', () => {
    expect(isWatermarkRequired('reader')).toBe(true);
    expect(isWatermarkRequired('owner')).toBe(false);
    expect(isWatermarkRequired('co-writer')).toBe(false);
    expect(isWatermarkRequired('guest')).toBe(false);
  });

  it('validates SceneTake schema structure', () => {
    const take = SceneTakeSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      sceneId: 3,
      takeNumber: 2,
      title: 'Take 2 (Noir Dramatic Ending)',
      fountainText: 'INT. OFFICE - NIGHT\n\nRain drums against the dark blinds.',
      authorName: 'Sarah Jenkins',
      authorRole: 'co-writer',
      createdAt: new Date().toISOString(),
      isFinalized: false,
    });

    expect(take.sceneId).toBe(3);
    expect(take.takeNumber).toBe(2);
    expect(take.title).toBe('Take 2 (Noir Dramatic Ending)');
    expect(take.authorRole).toBe('co-writer');
    expect(take.isFinalized).toBe(false);
  });

  it('validates live presence pulse schema with collaborator cursor tracking', () => {
    const presence = LivePresenceSchema.parse({
      userId: '11111111-1111-1111-1111-111111111111',
      displayName: 'Navateja',
      color: '#3b82f6',
      role: 'co-writer',
      activeBlockId: '22222222-2222-2222-2222-222222222222',
      cursorOffset: 14,
      isTyping: true,
      lastPing: Date.now(),
    });

    expect(presence.displayName).toBe('Navateja');
    expect(presence.role).toBe('co-writer');
    expect(presence.isTyping).toBe(true);
    expect(presence.cursorOffset).toBe(14);
  });

  it('supports note resolution toggle workflow', () => {
    const note = ScriptNoteSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      blockId: '22222222-2222-2222-2222-222222222222',
      documentId: '33333333-3333-3333-3333-333333333333',
      authorName: 'Sarah (Producer)',
      category: 'legal',
      content: 'Clear trademark for soda can prop.',
      createdAt: new Date().toISOString(),
      resolved: false,
    });

    const resolvedNote = {
      ...note,
      resolved: true,
      resolvedAt: new Date().toISOString(),
    };

    expect(resolvedNote.resolved).toBe(true);
    expect(resolvedNote.resolvedAt).toBeDefined();
  });
});
