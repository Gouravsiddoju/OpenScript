import { describe, it, expect } from 'vitest';
import { stripConflictMarkers, smartMergeFountain, isFountainContentIdentical } from '../conflictResolver';

describe('Screenplay Conflict Resolver & Sanitizer Unit Tests', () => {
  it('1. stripConflictMarkers cleanses legacy or leaked conflict comments completely', () => {
    const dirtyText = `
/* === CONFLICT IN SCENE: I/E. HOME/LIVING ROOM NIGHT === */
/* --- SERVER VERSION (Rev #2167) --- */
I/E. HOME/LIVING ROOM NIGHT

Arjun in the home stabbing someone on the ground.

/* --- YOUR LOCAL DRAFT (Rev #2136) --- */
I/E. HOME/LIVING ROOM NIGHT

Arjun in the home stabbing someone on the ground.
THE CAMERA IS PLACE FROM BACK AND ONLY HIM AND SWING OF KNIFE APPEARS.
/* === END SCENE CONFLICT === */

CUT TO:
`;

    const cleaned = stripConflictMarkers(dirtyText);
    expect(cleaned).not.toContain('/* === CONFLICT');
    expect(cleaned).not.toContain('/* --- SERVER VERSION');
    expect(cleaned).not.toContain('/* --- YOUR LOCAL DRAFT');
    expect(cleaned).not.toContain('/* === END SCENE CONFLICT');
    expect(cleaned).toContain('I/E. HOME/LIVING ROOM NIGHT');
    expect(cleaned).toContain('Arjun in the home stabbing someone on the ground.');
    expect(cleaned).toContain('THE CAMERA IS PLACE FROM BACK');
  });

  it('2. smartMergeFountain reconciles two differing scenes with ZERO comment markers', () => {
    const localText = `
INT. COFFEE SHOP - DAY

Gourav types furiously on his mechanical keyboard.

NAVATEJA
Did the autosave go through?
`;

    const serverText = `
INT. COFFEE SHOP - DAY

Gourav types furiously on his mechanical keyboard.
The barista hands him an espresso.

NAVATEJA
Did the autosave go through?

GOURAV
Yes, 100% zero data loss.
`;

    const merged = smartMergeFountain(localText, serverText, 10, 11);

    // Absolutely zero raw conflict syntax allowed
    expect(merged).not.toContain('/*');
    expect(merged).not.toContain('*/');
    expect(merged).not.toContain('CONFLICT');
    expect(merged).not.toContain('SERVER VERSION');
    expect(merged).not.toContain('YOUR LOCAL DRAFT');

    // Both writers' scene contributions are present
    expect(merged).toContain('INT. COFFEE SHOP - DAY');
    expect(merged).toContain('Gourav types furiously on his mechanical keyboard.');
    expect(merged).toContain('The barista hands him an espresso.');
    expect(merged).toContain('NAVATEJA');
    expect(merged).toContain('Did the autosave go through?');
    expect(merged).toContain('GOURAV');
    expect(merged).toContain('Yes, 100% zero data loss.');
  });

  it('3. smartMergeFountain seamlessly combines multiple independent scenes from different writers', () => {
    const localText = `
EXT. ROOFTOP - NIGHT

Rain lashes against the glass canopy. Gourav stares out across the city.
`;

    const serverText = `
INT. SERVER ROOM - NIGHT

Navateja inspects the blinking green diodes on the rack.
`;

    const merged = smartMergeFountain(localText, serverText, 5, 6);

    expect(merged).not.toContain('/*');
    expect(merged).toContain('EXT. ROOFTOP - NIGHT');
    expect(merged).toContain('Rain lashes against the glass canopy.');
    expect(merged).toContain('INT. SERVER ROOM - NIGHT');
    expect(merged).toContain('Navateja inspects the blinking green diodes');
  });

  it('4. isFountainContentIdentical ignores whitespace and legacy markers', () => {
    const textA = `
INT. OFFICE - DAY
Gourav is writing.
`;
    const textB = `
INT. OFFICE - DAY

Gourav is writing.
`;
    const textWithMarker = `
/* === CONFLICT IN SCENE: INT. OFFICE - DAY === */
INT. OFFICE - DAY
Gourav is writing.
/* === END SCENE CONFLICT === */
`;

    expect(isFountainContentIdentical(textA, textB)).toBe(true);
    expect(isFountainContentIdentical(textA, textWithMarker)).toBe(true);
  });
});
