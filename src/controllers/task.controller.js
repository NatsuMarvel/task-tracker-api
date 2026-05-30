const Task = require('../models/Task');
const { VALID_TRANSITIONS } = require('../models/Task');
const { User, ROLES } = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');
const { get, set, buildTaskListKey, invalidateTaskCache } = require('../services/cache');

const listTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, priority, assignee } = req.query;
    const orgId = req.user.organization;

    // members only see tasks assigned to them
    const effectiveAssignee = req.user.role === ROLES.MEMBER ? req.user._id.toString() : assignee;

    const cacheKey = buildTaskListKey({ orgId, assigneeId: effectiveAssignee, page, limit, status, priority });
    const cached = await get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return sendSuccess(res, cached.data, 200, cached.meta);
    }

    const filter = { organization: orgId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (effectiveAssignee) filter.assignee = effectiveAssignee;

    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignee', 'name email role')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(filter),
    ]);

    const meta = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    };

    await set(cacheKey, { data: tasks, meta });

    res.setHeader('X-Cache', 'MISS');
    return sendSuccess(res, tasks, 200, meta);
  } catch (err) {
    next(err);
  }
};

const createTask = async (req, res, next) => {
  try {
    const { title, description, priority, assignee, due_date, project } = req.body;
    const orgId = req.user.organization;

    if (assignee) {
      const found = await User.findOne({ _id: assignee, organization: orgId });
      if (!found) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee must be a member of your organization');
    }

    const task = await Task.create({
      title,
      description,
      priority,
      assignee: assignee || null,
      due_date: due_date || null,
      project: project || null,
      organization: orgId,
      createdBy: req.user._id,
    });

    await task.populate('assignee', 'name email role');

    if (assignee) await invalidateTaskCache(orgId, assignee);
    await invalidateTaskCache(orgId, null);

    return sendSuccess(res, task, 201);
  } catch (err) {
    next(err);
  }
};

const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organization: req.user.organization })
      .populate('assignee', 'name email role')
      .populate('createdBy', 'name email');

    if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

    if (req.user.role === ROLES.MEMBER && task.assignee?._id.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'FORBIDDEN', 'You can only view tasks assigned to you');
    }

    return sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const { title, description, priority, assignee, due_date } = req.body;
    const orgId = req.user.organization;

    const task = await Task.findOne({ _id: req.params.id, organization: orgId });
    if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

    if (req.user.role === ROLES.MEMBER && task.assignee?.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'FORBIDDEN', 'You can only update tasks assigned to you');
    }

    const oldAssignee = task.assignee?.toString();

    if (assignee) {
      const found = await User.findOne({ _id: assignee, organization: orgId });
      if (!found) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee must be a member of your organization');
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (due_date !== undefined) task.due_date = due_date || null;

    await task.save();
    await task.populate('assignee', 'name email role');

    if (oldAssignee) await invalidateTaskCache(orgId, oldAssignee);
    if (assignee && assignee !== oldAssignee) await invalidateTaskCache(orgId, assignee);
    await invalidateTaskCache(orgId, null);

    return sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status: newStatus } = req.body;
    const orgId = req.user.organization;

    const task = await Task.findOne({ _id: req.params.id, organization: orgId });
    if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

    if (req.user.role === ROLES.MEMBER && task.assignee?.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'FORBIDDEN', 'Only the assignee can change task status');
    }

    if (!Task.isValidTransition(task.status, newStatus)) {
      const allowed = VALID_TRANSITIONS[task.status]?.join(', ') || 'none';
      return sendError(res, 422, 'INVALID_TRANSITION', `Cannot transition from ${task.status} to ${newStatus}. Allowed: ${allowed}`);
    }

    task.statusHistory.push({ from: task.status, to: newStatus, changedBy: req.user._id });
    task.status = newStatus;

    await task.save();
    await task.populate('assignee', 'name email role');

    if (task.assignee) await invalidateTaskCache(orgId, task.assignee._id.toString());
    await invalidateTaskCache(orgId, null);

    return sendSuccess(res, task);
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const orgId = req.user.organization;

    const task = await Task.findOne({ _id: req.params.id, organization: orgId });
    if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

    if (req.user.role === ROLES.MANAGER && task.createdBy.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'FORBIDDEN', 'Managers can only delete tasks they created');
    }

    const assigneeId = task.assignee?.toString();
    await task.deleteOne();

    if (assigneeId) await invalidateTaskCache(orgId, assigneeId);
    await invalidateTaskCache(orgId, null);

    return sendSuccess(res, { message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTasks, createTask, getTask, updateTask, updateStatus, deleteTask };
