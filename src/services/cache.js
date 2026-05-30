const { getRedis } = require('../config/redis');

const TTL = parseInt(process.env.CACHE_TTL || '300');

// key format: tasks:org:{orgId}:assignee:{id|all}:page:{n}:limit:{n}:status:{s}:priority:{p}
const buildTaskListKey = ({ orgId, assigneeId, page, limit, status, priority }) => {
  return `tasks:org:${orgId}:assignee:${assigneeId || 'all'}:page:${page}:limit:${limit}:status:${status || 'all'}:priority:${priority || 'all'}`;
};

const get = async (key) => {
  try {
    const val = await getRedis().get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const set = async (key, value) => {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', TTL);
  } catch {
    // redis down, just skip caching
  }
};

// uses SCAN instead of KEYS to avoid blocking redis on large datasets
const deletePattern = async (pattern) => {
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // non-fatal
  }
};

const invalidateTaskCache = async (orgId, assigneeId) => {
  await deletePattern(`tasks:org:${orgId}:assignee:${assigneeId || 'all'}:*`);
};

module.exports = { get, set, buildTaskListKey, invalidateTaskCache };
