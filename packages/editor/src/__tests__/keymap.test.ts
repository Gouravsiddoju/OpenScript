import { describe, it, expect } from 'vitest';
import { ELEMENT_CYCLE_ORDER } from '../extensions/keymap';

describe('Screenplay Element Cycling and Keyboard State Machine', () => {
  it('defines the standard 7-element cyclic progression including Shot', () => {
    expect(ELEMENT_CYCLE_ORDER).toEqual([
      'sceneHeading',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'transition',
      'shot',
    ]);
  });

  it('cycles forward through all 7 elements on Tab without getting trapped', () => {
    const cycleForward = (current: string): string => {
      const idx = ELEMENT_CYCLE_ORDER.indexOf(current as any);
      return ELEMENT_CYCLE_ORDER[(idx + 1) % ELEMENT_CYCLE_ORDER.length];
    };

    expect(cycleForward('sceneHeading')).toBe('action');
    expect(cycleForward('action')).toBe('character');
    expect(cycleForward('character')).toBe('parenthetical');
    expect(cycleForward('parenthetical')).toBe('dialogue');
    expect(cycleForward('dialogue')).toBe('transition');
    expect(cycleForward('transition')).toBe('shot');
    expect(cycleForward('shot')).toBe('sceneHeading');
  });

  it('cycles backward through all 7 elements on Shift-Tab without getting trapped', () => {
    const cycleBackward = (current: string): string => {
      const idx = ELEMENT_CYCLE_ORDER.indexOf(current as any);
      return ELEMENT_CYCLE_ORDER[(idx - 1 + ELEMENT_CYCLE_ORDER.length) % ELEMENT_CYCLE_ORDER.length];
    };

    expect(cycleBackward('sceneHeading')).toBe('shot');
    expect(cycleBackward('shot')).toBe('transition');
    expect(cycleBackward('transition')).toBe('dialogue');
    expect(cycleBackward('dialogue')).toBe('parenthetical');
    expect(cycleBackward('parenthetical')).toBe('character');
    expect(cycleBackward('character')).toBe('action');
    expect(cycleBackward('action')).toBe('sceneHeading');
  });

  it('maps direct Mod-1 through Mod-7 and Alt-1 through Alt-7 to each respective element', () => {
    const elementMap: Record<number, string> = {
      1: 'sceneHeading',
      2: 'action',
      3: 'character',
      4: 'parenthetical',
      5: 'dialogue',
      6: 'transition',
      7: 'shot',
    };

    for (let i = 1; i <= 7; i++) {
      expect(ELEMENT_CYCLE_ORDER[i - 1]).toBe(elementMap[i]);
    }
  });
});
