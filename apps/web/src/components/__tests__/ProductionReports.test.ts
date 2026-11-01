import { describe, it, expect } from 'vitest';
import { computeProductionReportData } from '../ProductionReports';

describe('Production Reports Computation Engine', () => {
  it('correctly extracts speaking characters, counts lines and words, and computes ratios', () => {
    const html = `
      <div class="script-scene-heading">INT. POLICE STATION - DAY</div>
      <div class="script-action">Rain streams down the dusty windows. Two detectives sit opposite each other.</div>
      <div class="script-character">VASUDEV REDDY</div>
      <div class="script-dialogue">Did you examine the fingerprints found on the weapon?</div>
      <div class="script-character">RAVI</div>
      <div class="script-parenthetical">(Sir! we found this on the ground.)</div>
      <div class="script-action">Vasudev examines the transparent evidence bag carefully.</div>
    `;

    const report = computeProductionReportData(html);

    expect(report.sceneHeadings.length).toBe(1);
    expect(report.sceneHeadings[0].location).toBe('POLICE STATION');
    expect(report.sceneHeadings[0].setting).toBe('INT');

    // Both Vasudev and Ravi must be in speaking cast
    const castNames = report.sortedCharacters.map(([name]) => name);
    expect(castNames).toContain('VASUDEV REDDY');
    expect(castNames).toContain('RAVI');

    const vasudev = report.sortedCharacters.find(([name]) => name === 'VASUDEV REDDY')?.[1];
    expect(vasudev?.lines).toBe(1);
    expect(vasudev?.words).toBe(9);

    const ravi = report.sortedCharacters.find(([name]) => name === 'RAVI')?.[1];
    expect(ravi?.lines).toBe(1);
    expect(ravi?.words).toBe(7);

    expect(report.totalWords).toBeGreaterThan(0);
    expect(report.dialogueWords).toBe(16);
    expect(report.dialogueRatio).toBeGreaterThan(0);
  });

  it('filters out non-characters from Cast Breakdown Report completely', () => {
    const html = `
      <div class="script-scene-heading">EXT. HIGHWAY - NIGHT</div>
      <div class="script-action">Headlights pierce through the dense fog.</div>
      <div class="script-character">THE NEXT DAY</div>
      <div class="script-character">IN THE NIGHT</div>
      <div class="script-character">LATER THAT DAY</div>
      <div class="script-character">AFTER FEW MONTHS</div>
      <div class="script-character">AFTER TWO DAYS</div>
      <div class="script-character">ZOOM OUT SLOWLY</div>
      <div class="script-character">THE END</div>
      <div class="script-character">MAYA</div>
      <div class="script-dialogue">The transmission has been intercepted.</div>
    `;

    const report = computeProductionReportData(html);

    const castNames = report.sortedCharacters.map(([name]) => name);
    // Only MAYA should be in the speaking cast
    expect(castNames).toEqual(['MAYA']);

    // Non-characters must be completely excluded
    expect(castNames).not.toContain('THE NEXT DAY');
    expect(castNames).not.toContain('IN THE NIGHT');
    expect(castNames).not.toContain('LATER THAT DAY');
    expect(castNames).not.toContain('AFTER FEW MONTHS');
    expect(castNames).not.toContain('AFTER TWO DAYS');
    expect(castNames).not.toContain('ZOOM OUT SLOWLY');
    expect(castNames).not.toContain('THE END');
  });

  it('extracts clean scene locations from super titles and numbered headings', () => {
    const html = `
      <div class="script-scene-heading">SUPER TITLE: "3. THE CASE"</div>
      <div class="script-action">The case files lie spread out over the steel desk.</div>
      <div class="script-scene-heading">4. THE DEATH</div>
      <div class="script-action">A crow caws on the telephone wire.</div>
      <div class="script-scene-heading">COFFEE SHOP - NIGHT</div>
      <div class="script-action">Steam rises from ceramic mugs.</div>
    `;

    const report = computeProductionReportData(html);

    expect(report.sceneHeadings.length).toBe(3);
    expect(report.sceneHeadings[0].location).toBe('3. THE CASE');
    expect(report.sceneHeadings[1].location).toBe('4. THE DEATH');
    expect(report.sceneHeadings[2].location).toBe('COFFEE SHOP');
    expect(report.sortedLocations.length).toBe(3);
  });
});
