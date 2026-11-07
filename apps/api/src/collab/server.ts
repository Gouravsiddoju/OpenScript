import { Server, onAuthenticatePayload, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import * as Y from 'yjs';
import { ResilientStore } from '../services/store.service';

export function createCollabServer(port = Number(process.env.COLLAB_PORT) || 3002) {
  const collabServer = new Server({
    port,
    address: '0.0.0.0',
    debounce: 2000,
    maxDebounce: 10000,
    quiet: process.env.NODE_ENV === 'test',

    async onAuthenticate(data: onAuthenticatePayload) {
      return {
        user: {
          token: data.token,
        },
      };
    },

    async onLoadDocument(data: onLoadDocumentPayload) {
      const { documentName, document: ydoc } = data;
      try {
        const doc = await ResilientStore.getDocument(documentName);
        if (doc && (doc as any).yjsState) {
          const binary = Buffer.from((doc as any).yjsState, 'base64');
          Y.applyUpdate(ydoc, binary);
          console.log(`[CollabServer] Loaded Yjs state for doc ${documentName} (${binary.length} bytes)`);
        }
      } catch (err) {
        console.error(`[CollabServer] Error loading document ${documentName}:`, err);
      }
      return ydoc;
    },

    async onStoreDocument(data: onStoreDocumentPayload) {
      const { documentName, document: ydoc } = data;
      try {
        const state = Y.encodeStateAsUpdate(ydoc);
        const base64 = Buffer.from(state).toString('base64');
        await ResilientStore.saveYjsState(documentName, base64);
        console.log(`[CollabServer] Persisted Yjs state for doc ${documentName} (${state.length} bytes)`);
      } catch (err) {
        console.error(`[CollabServer] Error storing document ${documentName}:`, err);
      }
    },
  });

  return collabServer;
}
