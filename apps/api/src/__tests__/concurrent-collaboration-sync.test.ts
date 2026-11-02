import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../server';
import { FastifyInstance } from 'fastify';
import { EmailService } from '../services/email.service';

describe('Concurrent Multi-Writer Collaboration & Realtime Sync Tests', () => {
  let server: FastifyInstance;
  let writer1Token: string;
  let writer1Id: string;
  let writer2Token: string;
  let writer2Id: string;
  let projectId: string;
  let documentId: string;

  beforeAll(async () => {
    vi.spyOn(EmailService, 'sendInviteEmail').mockResolvedValue(true);
    vi.spyOn(EmailService, 'sendInviteConfirmationEmail').mockResolvedValue(true);

    server = buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  it('1. Owner (Writer 1) registers, creates project and initial screenplay document', async () => {
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `gourav-${Date.now()}@studio.com`,
        password: 'SecurePassword123!',
        displayName: 'Gourav Siddoju',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regData = JSON.parse(regRes.body);
    writer1Token = regData.token;
    writer1Id = regData.user.id;

    // Create project
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${writer1Token}` },
      payload: {
        name: 'THE LAST DOWNLOAD',
        description: 'Collaborative Sci-Fi Feature',
      },
    });

    expect(projRes.statusCode).toBe(201);
    const projData = JSON.parse(projRes.body);
    projectId = projData.project.id;

    // Create initial screenplay document
    const docRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/documents`,
      headers: { authorization: `Bearer ${writer1Token}` },
      payload: {
        title: 'THE LAST DOWNLOAD',
        fountainText: 'INT. CONTROL ROOM - NIGHT\n\nGourav monitors the mainframe terminal.\n',
      },
    });

    expect(docRes.statusCode).toBe(201);
    const docData = JSON.parse(docRes.body);
    documentId = docData.document.id;
    expect(docData.document.revisionNumber).toBe(1);
  });

  it('2. Co-writer (Writer 2 / Navateja) is invited, activates, and joins the screenplay', async () => {
    const inviteEmail = `navateja-${Date.now()}@studio.com`;
    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: { authorization: `Bearer ${writer1Token}` },
      payload: {
        email: inviteEmail,
        role: 'co-writer',
        projectName: 'THE LAST DOWNLOAD',
      },
    });

    expect(inviteRes.statusCode).toBe(201);

    // Navateja activates account
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: inviteEmail,
        password: 'NavatejaPassword123!',
        displayName: 'Poshala Navateja',
      },
    });

    expect(regRes.statusCode).toBe(200);
    const regData = JSON.parse(regRes.body);
    writer2Token = regData.token;
    writer2Id = regData.user.id;

    // Verify roster reports Navateja as active co-writer
    const rosterRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: { authorization: `Bearer ${writer1Token}` },
    });

    expect(rosterRes.statusCode).toBe(200);
    const roster = JSON.parse(rosterRes.body).collaborators;
    const navatejaMember = roster.find((m: any) => m.email.toLowerCase() === inviteEmail.toLowerCase());
    expect(navatejaMember).toBeDefined();
    expect(navatejaMember.role).toBe('co-writer');
    expect(navatejaMember.status).toBe('active');
  });

  it('3. Both writers send concurrent autosave updates without 409 conflict lockup', async () => {
    const baseRev = 1;

    const nowIso = new Date().toISOString();
    const meta = {
      title: 'THE LAST DOWNLOAD',
      credit: 'written by',
      authors: ['Gourav Siddoju'],
      draftLabel: 'First Draft',
      draftColor: 'White',
      isLocked: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const b1Id = crypto.randomUUID();
    const b2Id = crypto.randomUUID();
    const b3Id = crypto.randomUUID();
    const b4Id = crypto.randomUUID();

    const writer1Payload = {
      schemaVersion: 2,
      id: documentId,
      projectId,
      revisionNumber: baseRev,
      metadata: meta,
      content: [
        { id: b1Id, type: 'sceneHeading', text: 'INT. CONTROL ROOM - NIGHT', marks: [], isOmitted: false },
        { id: b2Id, type: 'action', text: 'Gourav monitors the mainframe terminal. Alarm sounds.', marks: [], isOmitted: false },
      ],
    };

    const writer2Payload = {
      schemaVersion: 2,
      id: documentId,
      projectId,
      revisionNumber: baseRev,
      metadata: meta,
      content: [
        { id: b1Id, type: 'sceneHeading', text: 'INT. CONTROL ROOM - NIGHT', marks: [], isOmitted: false },
        { id: b2Id, type: 'action', text: 'Gourav monitors the mainframe terminal.', marks: [], isOmitted: false },
        { id: b3Id, type: 'character', text: 'NAVATEJA', marks: [], isOmitted: false },
        { id: b4Id, type: 'dialogue', text: 'The download is at 99 percent.', marks: [], isOmitted: false },
      ],
    };

    // Dispatch concurrently
    const [res1, res2] = await Promise.all([
      server.inject({
        method: 'PATCH',
        url: `/api/v1/documents/${documentId}`,
        headers: { authorization: `Bearer ${writer1Token}` },
        payload: {
          revisionNumber: baseRev,
          content: writer1Payload,
        },
      }),
      server.inject({
        method: 'PATCH',
        url: `/api/v1/documents/${documentId}`,
        headers: { authorization: `Bearer ${writer2Token}` },
        payload: {
          revisionNumber: baseRev,
          content: writer2Payload,
        },
      }),
    ]);

    // Neither request must fail with 409
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const data1 = JSON.parse(res1.body);
    const data2 = JSON.parse(res2.body);

    expect(data1.newRevisionNumber).toBeGreaterThan(baseRev);
    expect(data2.newRevisionNumber).toBeGreaterThan(baseRev);
  });

  it('4. Realtime presence broadcasts scene locations and typing status between co-writers', async () => {
    // Writer 1 pings presence in Scene 1
    const p1Res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/presence`,
      headers: { authorization: `Bearer ${writer1Token}` },
      payload: {
        userId: writer1Id,
        displayName: 'Gourav Siddoju',
        color: '#f59e0b',
        role: 'owner',
        activeSceneHeading: 'INT. CONTROL ROOM - NIGHT',
        isTyping: true,
      },
    });

    expect(p1Res.statusCode).toBe(200);
    const p1Data = JSON.parse(p1Res.body);
    expect(p1Data.peers.length).toBeGreaterThanOrEqual(1);

    // Writer 2 pings presence in Scene 2
    const p2Res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/presence`,
      headers: { authorization: `Bearer ${writer2Token}` },
      payload: {
        userId: writer2Id,
        displayName: 'Poshala Navateja',
        color: '#ec4899',
        role: 'co-writer',
        activeSceneHeading: 'EXT. ROOFTOP - CONTINUOUS',
        isTyping: false,
      },
    });

    expect(p2Res.statusCode).toBe(200);
    const p2Data = JSON.parse(p2Res.body);

    // Writer 2 receives Writer 1's active scene and typing status
    const peer1 = p2Data.peers.find((p: any) => p.userId === writer1Id);
    expect(peer1).toBeDefined();
    expect(peer1.displayName).toBe('Gourav Siddoju');
    expect(peer1.activeSceneHeading).toBe('INT. CONTROL ROOM - NIGHT');
    expect(peer1.isTyping).toBe(true);

    // Verify doc revision is returned for instant zero-lag syncing
    expect(p2Data.docRevision).toBeDefined();
    expect(typeof p2Data.docRevision).toBe('number');
  });

  it('5. Screenplay document contains clean text with ZERO conflict comment artifacts', async () => {
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/documents/${documentId}`,
      headers: { authorization: `Bearer ${writer1Token}` },
    });

    expect(getRes.statusCode).toBe(200);
    const docData = JSON.parse(getRes.body).document;
    const docJsonString = JSON.stringify(docData.contentJson);

    expect(docJsonString).not.toContain('CONFLICT IN SCENE');
    expect(docJsonString).not.toContain('SERVER VERSION');
    expect(docJsonString).not.toContain('YOUR LOCAL DRAFT');
    expect(docJsonString).not.toContain('END SCENE CONFLICT');
  });
});
