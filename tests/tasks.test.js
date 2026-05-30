const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { User } = require('../src/models/User');
const Organization = require('../src/models/Organization');
const Task = require('../src/models/Task');

process.env.MONGO_URI = 'mongodb://localhost:27017/tasktracker_task_test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.REDIS_HOST = 'localhost';

let adminToken, managerToken, memberToken;
let adminId, managerId, memberId;
let taskId;
let orgId;

const registerUser = async (name, email, orgName) => {
  const reg = await request(app).post('/api/v1/auth/register').send({
    name, email, password: 'password123', organizationName: orgName,
  });
  return { token: reg.body.data.accessToken, userId: reg.body.data.user._id };
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Organization.deleteMany({});
  await Task.deleteMany({});

  // Admin registers (and creates org) — first user always becomes ADMIN
  const adminRes = await registerUser('Admin User', 'admin2@test.com', 'Task Test Org');
  adminToken = adminRes.token;
  adminId = adminRes.userId;

  // Get orgId
  const org = await Organization.findOne({ name: 'Task Test Org' });
  orgId = org._id;

  // Register manager as MEMBER, then admin promotes them
  const managerRes = await registerUser('Manager User', 'manager@test.com', 'Task Test Org');
  managerToken = managerRes.token;
  managerId = managerRes.userId;
  await request(app)
    .patch(`/api/v1/users/${managerId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'MANAGER' });

  const memberRes = await registerUser('Member User', 'member@test.com', 'Task Test Org');
  memberToken = memberRes.token;
  memberId = memberRes.userId;
});

afterAll(async () => {
  await User.deleteMany({});
  await Organization.deleteMany({});
  await Task.deleteMany({});
  await mongoose.disconnect();
});

describe('Task RBAC', () => {
  describe('POST /api/v1/tasks', () => {
    it('ADMIN should create a task', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Task',
          description: 'A test task',
          priority: 'HIGH',
          assignee: memberId,
          due_date: new Date(Date.now() + 86400000 * 7).toISOString(),
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Test Task');
      taskId = res.body.data._id;
    });

    it('MEMBER should NOT be able to create a task', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Member Task' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should reject task with past due_date', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Old Task', due_date: '2020-01-01T00:00:00Z' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/future date/);
    });

    it('should reject task without title', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'No title task' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('ADMIN should see all tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('MEMBER should only see their assigned tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach((task) => {
        expect(task.assignee._id).toBe(memberId);
      });
    });
  });

  describe('Status Transitions (State Machine)', () => {
    it('MEMBER (assignee) can advance status: TODO → IN_PROGRESS', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('should reject invalid transition: IN_PROGRESS → DONE (skips IN_REVIEW)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'DONE' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('can transition to BLOCKED from active state', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'BLOCKED' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('BLOCKED');
    });

    it('MANAGER can advance status of any task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
    });

    it('non-assignee MEMBER cannot change task status', async () => {
      // Create another member
      const otherMember = await registerUser('Other Member', 'other@test.com', 'Task Test Org');
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${otherMember.token}`)
        .send({ status: 'IN_REVIEW' });
      expect(res.status).toBe(403);
    });

    it('should complete transition chain: IN_PROGRESS → IN_REVIEW → DONE', async () => {
      const r1 = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_REVIEW' });
      expect(r1.status).toBe(200);

      const r2 = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DONE' });
      expect(r2.status).toBe(200);
      expect(r2.body.data.status).toBe('DONE');
    });

    it('DONE is terminal — no further transitions allowed', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_REVIEW' });
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/v1/tasks', () => {
    it('MEMBER cannot delete tasks', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it('ADMIN can delete any task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
