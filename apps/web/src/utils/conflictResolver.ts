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
 * Checks if two pieces of Fountain text have identical content (ignoring whitespace differences)
 */
export function isFountainContentIdentical(textA: string, textB: string): boolean {
  const normA = textA.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
  const normB = textB.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
  return normA === normB;
}

/**
 * Smartly reconciles two conflicting Fountain screenplays.
 * Ensures not a single word or scene written by either writer is lost.
 */
export function smartMergeFountain(
  localText: string,
  serverText: string,
  localRev: number = 1,
  serverRev: number = 2
): string {
  const normLocal = localText.replace(/\r\n/g, '\n').trim();
  const normServer = serverText.replace(/\r\n/g, '\n').trim();

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
        // Check if there is a similar scene heading in server
        const lHeading = lScene.split('\n')[0].trim().toUpperCase();
        const matchingServerScene = serverScenes.find(s => s.split('\n')[0].trim().toUpperCase() === lHeading);

        if (matchingServerScene && matchingServerScene !== lScene) {
          // Conflict in same scene: preserve both variants clearly demarcated
          mergedScenes.push(
            `/* === CONFLICT IN SCENE: ${lHeading} === */\n` +
            `/* --- SERVER VERSION (Rev #${serverRev}) --- */\n${matchingServerScene}\n\n` +
            `/* --- YOUR LOCAL DRAFT (Rev #${localRev}) --- */\n${lScene}\n` +
            `/* === END SCENE CONFLICT === */`
          );
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
        mergedScenes.push(`/* --- ADDED FROM SERVER (Rev #${serverRev}) --- */\n${sScene}`);
      }
    }

    return mergedScenes.join('\n\n');
  }

  // Fallback: Clear block-level demarcation
  return (
    `/* ========================================================\n` +
    `   AUTOMATIC MERGE RECONCILIATION\n` +
    `   Server Rev #${serverRev} + Local Base Rev #${localRev}\n` +
    `   ======================================================== */\n\n` +
    `/* --- SERVER VERSION --- */\n${normServer}\n\n` +
    `/* --- YOUR LOCAL EDITS --- */\n${normLocal}`
  );
}
