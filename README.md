# Team Task Tracker API

A production-grade REST API for team-based task management with JWT authentication, role-based access control (RBAC), Redis caching, and full Docker containerization.

---

## Quick Start

```bash
git clone <repo-url> && cd task-tracker-api
docker compose up --build
```

That's it. The API is available at `http://localhost:3000`.

| URL | Description |
|-----|-------------|
| `http://localhost:3000/api/v1` | API base |
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost:3000/health` | Health check |

---

## Tech Stack

- **Runtime**: Node.js 20 + Express.js
- **Database**: MongoDB 7 (Mongoose ODM)
- **Cache**: Redis 7 (ioredis)
- **Auth**: JWT (access token 15min + refresh token 7d with rotation)
- **Docs**: Swagger / OpenAPI 3.0
- **Container**: Docker + Docker Compose

---

## API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/auth/register` | Public | Register user (creates org on first user) |
| POST | `/api/v1/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Public | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Auth | Invalidate refresh token |
| GET  | `/api/v1/auth/me` | Auth | Get current user |

### Tasks
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET  | `/api/v1/tasks` | All | List tasks (paginated + filtered) |
| POST | `/api/v1/tasks` | Manager+ | Create task |
| GET  | `/api/v1/tasks/:id` | All | Get task |
| PATCH | `/api/v1/tasks/:id` | All* | Update task fields |
| PATCH | `/api/v1/tasks/:id/status` | Assignee/Manager+ | Change status (state machine) |
| DELETE | `/api/v1/tasks/:id` | Manager+ | Delete task |

### Users (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List org users |
| GET | `/api/v1/users/:id` | Get user |
| PATCH | `/api/v1/users/:id` | Update role/status |
| DELETE | `/api/v1/users/:id` | Deactivate user |

### Projects (Manager+)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/:id` | Get project |
| PATCH | `/api/v1/projects/:id` | Update project |
| DELETE | `/api/v1/projects/:id` | Archive project |

### Analytics (Bonus — Manager+)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/tasks` | Overdue count per user + avg completion time |

---

## Role Permissions

| Action | ADMIN | MANAGER | MEMBER |
|--------|-------|---------|--------|
| Manage users | ✅ | ❌ | ❌ |
| Create/delete projects | ✅ | ✅ | ❌ |
| Create tasks | ✅ | ✅ | ❌ |
| Update any task | ✅ | ✅ | ❌ |
| Update own task | ✅ | ✅ | ✅ |
| Change task status | ✅ | ✅ | Own tasks only |
| View all tasks | ✅ | ✅ | ❌ |
| View own tasks | ✅ | ✅ | ✅ |

> **RBAC is enforced at the middleware level** — role checks happen before any controller logic runs.

---

## Status Transitions (State Machine)

```
TODO → IN_PROGRESS → IN_REVIEW → DONE
 ↘          ↘            ↘
            BLOCKED (reachable from any active state)
BLOCKED → TODO | IN_PROGRESS | IN_REVIEW
DONE → (terminal, no further transitions)
```

Invalid transitions return `422 INVALID_TRANSITION` with allowed next states in the message.

---

## Caching Strategy

**What is cached**: Task list results per assignee, keyed by:
```
tasks:org:{orgId}:assignee:{assigneeId}:page:{n}:limit:{n}:status:{s}:priority:{p}
```

**TTL**: 5 minutes (configurable via `CACHE_TTL` env var)

**Invalidation**: On any task mutation (create / update / delete / status change), all cache keys for the affected assignee(s) in that org are deleted using Redis `SCAN` + `DEL`. This is a **targeted pattern delete** — not a full cache flush — so other assignees' cached data stays intact.

**Why SCAN instead of KEYS**: `KEYS pattern` blocks Redis for the scan duration. `SCAN` is cursor-based and non-blocking, safe for production.

**Graceful degradation**: If Redis is unavailable, the API continues to function — cache errors are caught and logged as warnings, never as fatal errors.

---

## Database Design Decisions

### Schema Overview

```
Organization
  ├── Users (many) — org members with roles
  ├── Projects (many) — grouping of tasks
  └── Tasks (many)
        ├── assignee → User
        ├── createdBy → User
        └── project → Project
```

### Indexes

```js
// User
{ organization: 1, email: 1 }   // unique user lookup within org
{ organization: 1, role: 1 }    // filter users by role in org

// Task
{ organization: 1, status: 1 }  // most common filter: tasks by status
{ organization: 1, assignee: 1 } // cache key pattern + MEMBER task views
{ organization: 1, due_date: 1 } // overdue task analytics
{ assignee: 1, status: 1 }       // individual assignee task board
```

### Design Decision: Soft Deletes for Users

Users are **deactivated** (`isActive: false`) rather than hard-deleted. Reason: Tasks reference users via `assignee` and `createdBy`. Hard-deleting a user would orphan those references, breaking task history and analytics. Deactivation preserves referential integrity while preventing login.

### Design Decision: Status History Array

Task documents embed a `statusHistory` array (who changed what, when). This avoids a separate `TaskStatusHistory` collection and makes audit trails free to query — at the cost of slightly larger documents. Given tasks rarely exceed 20–30 status changes in their lifetime, the document size stays well within MongoDB's 16MB limit.

---

## Error Response Format

All errors follow a consistent structure:

```json
{
  "status": 422,
  "code": "INVALID_TRANSITION",
  "message": "Cannot transition from IN_PROGRESS to DONE. Allowed: IN_REVIEW, BLOCKED"
}
```

---

## Running Tests

```bash
# Requires local MongoDB and optionally Redis
npm test
```

Tests cover:
- Auth flow: register, login, refresh token rotation, token reuse detection
- Task RBAC: creation permissions by role
- Status machine: valid transitions, invalid transitions, terminal state
- Access control: MEMBER can only access own tasks

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `MONGO_URI` | required | MongoDB connection string |
| `JWT_ACCESS_SECRET` | required | Access token signing key |
| `JWT_REFRESH_SECRET` | required | Refresh token signing key |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `CACHE_TTL` | `300` | Cache TTL in seconds |

---

## What I Would Improve Given More Time

1. **WebSocket / SSE notifications** — real-time push when a task's status changes (assignee gets notified immediately)
2. **Rate limiting per user** — current rate limit is IP-based; per-JWT-user limiting would be more precise
3. **Pagination cursor** — replace page/offset pagination with cursor-based pagination for large datasets (avoids skip performance degradation)
4. **Event sourcing for tasks** — full audit trail via event log rather than embedded history array
5. **Integration with notification service** — email/Slack alerts for overdue tasks
6. **React frontend** — task board with drag-and-drop status columns
7. **CI/CD pipeline** — GitHub Actions for lint, test, build, push to container registry
8. **API versioning strategy** — currently hardcoded as `/api/v1`; would add a proper versioning middleware
