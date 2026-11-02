import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../server';
import { FastifyInstance } from 'fastify';
import { EmailService } from '../services/email.service';

describe('Collaboration Invite & Accept Full Flow E2E Tests', () => {
  let server: FastifyInstance;
  let ownerToken: string;
  let ownerId: string;
  let projectId: string;

  beforeAll(async () => {
    // Mock external email delivery for fast, hermetic test runs
    vi.spyOn(EmailService, 'sendInviteEmail').mockResolvedValue(true);
    vi.spyOn(EmailService, 'sendInviteConfirmationEmail').mockResolvedValue(true);

    server = buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  it('1. Owner registers and creates a screenplay project', async () => {
    const ownerEmail = `director-${Date.now()}@studio.com`;
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: ownerEmail,
        password: 'DirectorPassword123!',
        displayName: 'Christopher Nolan',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regData = JSON.parse(regRes.body);
    expect(regData.user.email).toBe(ownerEmail);
    expect(regData.token).toBeDefined();

    ownerToken = regData.token;
    ownerId = regData.user.id;

    // Create a new project
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        name: 'THE LAST DOWNLOAD',
        description: 'Sci-fi thriller about AI consciousness',
      },
    });

    expect(projRes.statusCode).toBe(201);
    const projData = JSON.parse(projRes.body);
    projectId = projData.project.id;
    expect(projectId).toBeDefined();
    expect(projData.project.name).toBe('THE LAST DOWNLOAD');
  });

  it('2. Owner invites a co-writer by email', async () => {
    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        email: 'poshalanavateja-test@gmail.com',
        role: 'co-writer',
      },
    });

    expect(inviteRes.statusCode).toBe(201);
    const inviteData = JSON.parse(inviteRes.body);
    expect(inviteData.collaborator).toBeDefined();
    expect(inviteData.collaborator.email).toBe('poshalanavateja-test@gmail.com');
    expect(inviteData.collaborator.role).toBe('co-writer');
    expect(inviteData.isDuplicate).toBe(false);

    // Verify duplicate invite updates role gracefully without duplicate rows
    const dupRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        email: 'poshalanavateja-test@gmail.com',
        role: 'co-writer',
      },
    });
    expect(dupRes.statusCode).toBe(201);
    const dupData = JSON.parse(dupRes.body);
    expect(dupData.isDuplicate).toBe(true);
  });

  it('3. Invited co-writer activates account via Sign In (Auto-activation)', async () => {
    // When Navateja lands on the page and enters his email and desired password in Sign In
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'poshalanavateja-test@gmail.com',
        password: 'NavatejaSecretPassword123!',
      },
    });

    // Should succeed with 200, activate account, and issue session token!
    expect(loginRes.statusCode).toBe(200);
    const loginData = JSON.parse(loginRes.body);
    expect(loginData.user.email).toBe('poshalanavateja-test@gmail.com');
    expect(loginData.token).toBeDefined();
    expect(loginData.message).toContain('activated');

    const navatejaToken = loginData.token;

    // Verify subsequent login with the same password succeeds
    const secondLoginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'poshalanavateja-test@gmail.com',
        password: 'NavatejaSecretPassword123!',
      },
    });
    expect(secondLoginRes.statusCode).toBe(200);

    // Verify wrong password fails
    const wrongPassRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'poshalanavateja-test@gmail.com',
        password: 'WrongPassword!',
      },
    });
    expect(wrongPassRes.statusCode).toBe(401);

    // Verify Navateja can access the project
    const accessRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${navatejaToken}`,
      },
    });
    expect(accessRes.statusCode).toBe(200);

    // Verify the project appears in Navateja's project dashboard list
    const projListRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${navatejaToken}`,
      },
    });
    expect(projListRes.statusCode).toBe(200);
    const projListData = JSON.parse(projListRes.body);
    const foundProject = projListData.projects.find((p: any) => p.id === projectId);
    expect(foundProject).toBeDefined();
  });

  it('4. Owner invites second collaborator who activates via Register tab', async () => {
    const editorEmail = `editor-${Date.now()}@studio.com`;

    // Owner invites editor
    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        email: editorEmail,
        role: 'commenter',
      },
    });
    expect(inviteRes.statusCode).toBe(201);

    // Collaborator clicks link and goes to "Create Production Account" (Register)
    const registerRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: editorEmail,
        password: 'EditorPassword456!',
        displayName: 'Thelma Schoonmaker',
      },
    });

    // Should NOT return 409 Conflict! Should activate and return 200 with session!
    expect(registerRes.statusCode).toBe(200);
    const registerData = JSON.parse(registerRes.body);
    expect(registerData.user.email).toBe(editorEmail);
    expect(registerData.user.displayName).toBe('Thelma Schoonmaker');
    expect(registerData.token).toBeDefined();

    // Verify collaborator can access the project
    const editorToken = registerData.token;
    const accessRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${editorToken}`,
      },
    });
    expect(accessRes.statusCode).toBe(200);
  });

  it('5. Uninvited stranger is denied access to private project', async () => {
    const strangerEmail = `stranger-${Date.now()}@otherstudio.com`;
    const regRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: strangerEmail,
        password: 'StrangerPass123!',
        displayName: 'Stranger',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const strangerToken = JSON.parse(regRes.body).token;

    // Stranger tries to access the project
    const accessRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${strangerToken}`,
      },
    });
    expect(accessRes.statusCode).toBe(403);

    // Stranger views their project list - should NOT contain the private project
    const projListRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${strangerToken}`,
      },
    });
    expect(projListRes.statusCode).toBe(200);
    const projListData = JSON.parse(projListRes.body);
    const hasProject = projListData.projects.some((p: any) => p.id === projectId);
    expect(hasProject).toBe(false);
  });

  it('6. Collaborators roster reports active status for activated members', async () => {
    const rosterRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/collaborators`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });

    expect(rosterRes.statusCode).toBe(200);
    const rosterData = JSON.parse(rosterRes.body);
    expect(rosterData.collaborators).toBeDefined();

    const navatejaMember = rosterData.collaborators.find(
      (c: any) => c.email === 'poshalanavateja-test@gmail.com'
    );
    expect(navatejaMember).toBeDefined();
    expect(navatejaMember.status).toBe('active');
  });
});
