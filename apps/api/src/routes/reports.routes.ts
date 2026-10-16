import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, documents } from '@openscript/database';
import { CanonicalScreenplayDocument } from '@openscript/screenplay-schema';

export const reportRoutes: FastifyPluginAsync = async (server) => {
  // Cast Speaking Report
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id/reports/speaking-cast', async (request, reply) => {
    const { id } = request.params;
    const docRow = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!docRow) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const doc = docRow.contentJson as CanonicalScreenplayDocument;
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

        if (i + 1 < doc.content.length && doc.content[i + 1].type === 'dialogue') {
          const words = doc.content[i + 1].text.trim().split(/\s+/).filter(Boolean).length;
          entry.dialogueCount++;
          entry.wordCount += words;
          totalScriptWords += words;
        }
      }
    }

    const report = Array.from(castMap.entries()).map(([characterName, data]) => ({
      characterName,
      totalScenes: data.scenes.size,
      totalDialogueBlocks: data.dialogueCount,
      totalWords: data.wordCount,
      percentageOfScript: totalScriptWords > 0 ? Number(((data.wordCount / totalScriptWords) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.totalWords - a.totalWords);

    return {
      documentId: id,
      totalSpeakingCharacters: report.length,
      totalScriptWords,
      castReport: report,
    };
  });

  // Location / Set Breakdown Report
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id/reports/locations', async (request, reply) => {
    const { id } = request.params;
    const docRow = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!docRow) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const doc = docRow.contentJson as CanonicalScreenplayDocument;
    const locationMap = new Map<string, { type: string; scenes: { sceneNumber?: string; text: string }[] }>();

    let sceneCounter = 1;
    for (const block of doc.content) {
      if (block.type === 'sceneHeading') {
        const text = block.text.trim().toUpperCase();
        const isInt = text.startsWith('INT');
        const settingType = isInt ? 'INT' : text.startsWith('EXT') ? 'EXT' : 'OTHER';

        if (!locationMap.has(text)) {
          locationMap.set(text, { type: settingType, scenes: [] });
        }

        locationMap.get(text)!.scenes.push({
          sceneNumber: block.sceneNumber || String(sceneCounter),
          text,
        });
        sceneCounter++;
      }
    }

    const locations = Array.from(locationMap.entries()).map(([location, data]) => ({
      location,
      settingType: data.type,
      totalOccurrences: data.scenes.length,
      scenes: data.scenes,
    })).sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    return {
      documentId: id,
      totalUniqueLocations: locations.length,
      locations,
    };
  });
};
