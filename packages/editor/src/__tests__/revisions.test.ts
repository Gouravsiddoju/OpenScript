import { describe, it, expect } from 'vitest';
import { calculateLockedSceneNumber, HOLLYWOOD_REVISION_SEQUENCE } from '@openscript/screenplay-schema';

describe('Hollywood Production Revisions & Locked Numbering Engine', () => {
  it('follows the standard Hollywood revision draft sequence', () => {
    expect(HOLLYWOOD_REVISION_SEQUENCE[0].color).toBe('white');
    expect(HOLLYWOOD_REVISION_SEQUENCE[1].color).toBe('blue');
    expect(HOLLYWOOD_REVISION_SEQUENCE[2].color).toBe('pink');
    expect(HOLLYWOOD_REVISION_SEQUENCE[3].color).toBe('yellow');
    expect(HOLLYWOOD_REVISION_SEQUENCE[4].color).toBe('green');
    expect(HOLLYWOOD_REVISION_SEQUENCE[5].color).toBe('goldenrod');
    expect(HOLLYWOOD_REVISION_SEQUENCE[6].color).toBe('buff');
    expect(HOLLYWOOD_REVISION_SEQUENCE[7].color).toBe('salmon');
    expect(HOLLYWOOD_REVISION_SEQUENCE[8].color).toBe('cherry');
  });

  it('calculates locked scene numbers correctly for inserts', () => {
    // Empty
    expect(calculateLockedSceneNumber([], 0)).toBe('1');

    // Inserting at end of 1, 2, 3
    expect(calculateLockedSceneNumber(['1', '2', '3'], 3)).toBe('4');

    // Inserting between 1 and 2
    expect(calculateLockedSceneNumber(['1', '2'], 1)).toBe('1A');

    // Inserting between 1A and 2
    expect(calculateLockedSceneNumber(['1', '1A', '2'], 2)).toBe('1B');

    // Inserting before 1
    expect(calculateLockedSceneNumber(['1', '2'], 0)).toBe('A1');
  });
});
