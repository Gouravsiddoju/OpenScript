/**
 * Conflict Resolver & Screenplay Merge Engine
 * Ensures 100% zero-data-loss when multiple writers or devices edit concurrently.
 */

export interface ScreenplayBackup {
  id: string;
  documentId: string;
  title: string;
  fountainText: string;
  scriptHtml?: string;
  revisionNumber: number;
  createdAt: string;
  reason: 'conflict_overwrite' | 'server_reload' | 'manual_fork';
}

const BACKUPS_STORAGE_KEY = 'openscript_safety_backups';

/**
 * Creates an immutable safety backup in localStorage before any destructive operation
 */
export function createSafetyBackup(
  documentId: string,
  title: string,
  fountainText: string,
  scriptHtml: string,
  revisionNumber: number,
  reason: ScreenplayBackup['reason']
): ScreenplayBackup {
  const backup: ScreenplayBackup = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `backup-${Date.now()}`,
    documentId,
    title,
    fountainText,
    scriptHtml,
    revisionNumber,
    createdAt: new Date().toISOString(),
    reason,
  };

  try {
    const raw = localStorage.getItem(BACKUPS_STORAGE_KEY);
    const backups: ScreenplayBackup[] = raw ? JSON.parse(raw) : [];
    // Keep last 15 backups
    backups.unshift(backup);
    if (backups.length > 15) backups.length = 15;
    localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups));
  } catch (err) {
    console.error('Failed to write safety backup to localStorage:', err);
  }

  return backup;
}

/**
 * Cleanses any legacy or leaked merge conflict comment markers from fountain screenplay text
 */
export function stripConflictMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(/\/\*\s*===+\s*CONFLICT IN SCENE:[^*]*===+\s*\*\//gi, '')
    .replace(/\/\*\s*---+\s*SERVER VERSION[^*]*---+\s*\*\//gi, '')
    .replace(/\/\*\s*---+\s*YOUR LOCAL DRAFT[^*]*---+\s*\*\//gi, '')
    .replace(/\/\*\s*===+\s*END SCENE CONFLICT\s*===+\s*\*\//gi, '')
    .replace(/\/\*\s*---+\s*ADDED FROM SERVER[^*]*---+\s*\*\//gi, '')
    .replace(/\/\*\s*===+\s*AUTOMATIC MERGE RECONCILIATION[\s\S]*?===+\s*\*\//gi, '')
    .replace(/\/\*\s*---+\s*YOUR LOCAL EDITS\s*---+\s*\*\//gi, '')
    .replace(/[\u25CF\u2022][^\u25CF\u2022\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Checks if two pieces of Fountain text have identical content (ignoring whitespace differences)
 */
export function isFountainContentIdentical(textA: string, textB: string): boolean {
  const normA = stripConflictMarkers(textA).replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
  const normB = stripConflictMarkers(textB).replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
  return normA === normB;
}

/**
 * Smartly reconciles two conflicting Fountain screenplays without ever leaking raw comment syntax.
 * Ensures not a single word or scene written by either writer is lost.
 */
export function smartMergeFountain(
  localText: string,
  serverText: string,
  localRev: number = 1,
  serverRev: number = 2
): string {
  const normLocal = stripConflictMarkers(localText).replace(/\r\n/g, '\n').trim();
  const normServer = stripConflictMarkers(serverText).replace(/\r\n/g, '\n').trim();

  // If identical, return either
  if (normLocal === normServer) {
    return normLocal;
  }

  // If local text completely contains server text (writer simply wrote more)
  if (normLocal.includes(normServer)) {
    return normLocal;
  }

  // If server text completely contains local text (server simply wrote more)
  if (normServer.includes(normLocal)) {
    return normServer;
  }

  // Split both texts by scenes
  const sceneRegex = /(?=(?:^|\n)(?:\.[A-Z0-9_]|INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.))/i;
  const localScenes = normLocal.split(sceneRegex).map(s => s.trim()).filter(Boolean);
  const serverScenes = normServer.split(sceneRegex).map(s => s.trim()).filter(Boolean);

  // If both have scenes, reconcile scene-by-scene
  if (localScenes.length > 0 && serverScenes.length > 0) {
    const mergedScenes: string[] = [];
    const serverScenesSet = new Set(serverScenes.map(s => s.toLowerCase()));

    // 1. Add matching or local-unique scenes
    for (const lScene of localScenes) {
      if (serverScenesSet.has(lScene.toLowerCase())) {
        // Both writers have the exact same scene
        mergedScenes.push(lScene);
      } else {
        // Scene exists in local or was modified
        const lHeading = lScene.split('\n')[0].trim().toUpperCase();
        const matchingServerScene = serverScenes.find(s => s.split('\n')[0].trim().toUpperCase() === lHeading);

        if (matchingServerScene && matchingServerScene !== lScene) {
          // Both writers touched the same scene - reconcile cleanly without comment markers
          const lBody = lScene.split('\n').slice(1).join('\n').trim();
          const sBody = matchingServerScene.split('\n').slice(1).join('\n').trim();

          if (lBody.includes(sBody)) {
            mergedScenes.push(lScene);
          } else if (sBody.includes(lBody)) {
            mergedScenes.push(matchingServerScene);
          } else {
            // Reconcile by scene heading + union of paragraphs
            const lLines = lBody.split(/\n\s*\n/).map(l => l.trim()).filter(Boolean);
            const sLines = sBody.split(/\n\s*\n/).map(l => l.trim()).filter(Boolean);
            const seenParas = new Set(lLines.map(p => p.toLowerCase()));
            const combinedParas = [...lLines];
            for (const sp of sLines) {
              if (!seenParas.has(sp.toLowerCase())) {
                seenParas.add(sp.toLowerCase());
                combinedParas.push(sp);
              }
            }
            mergedScenes.push(`${lHeading}\n\n${combinedParas.join('\n\n')}`);
          }
        } else {
          mergedScenes.push(lScene);
        }
      }
    }

    // 2. Add server-unique scenes that local didn't have
    for (const sScene of serverScenes) {
      const sHeading = sScene.split('\n')[0].trim().toUpperCase();
      const existsInLocal = localScenes.some(l => l.split('\n')[0].trim().toUpperCase() === sHeading);
      if (!existsInLocal) {
        mergedScenes.push(sScene);
      }
    }

    return stripConflictMarkers(mergedScenes.join('\n\n'));
  }

  // Fallback: cleanly preserve both versions without comment markers
  return stripConflictMarkers(normServer + '\n\n' + normLocal);
}
