const { sendError } = require('../utils/response');
const { ROLES } = require('../models/User');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'FORBIDDEN', `Access denied. Required role: ${roles.join(' or ')}`);
    }
    next();
  };
};

const adminOnly = authorize(ROLES.ADMIN);
const managerOrAbove = authorize(ROLES.ADMIN, ROLES.MANAGER);
const allRoles = authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.MEMBER);

// members can only touch tasks assigned to them
const ownTaskOrAbove = (req, res, next) => {
  if (!req.task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  const { user, task } = req;
  if (user.role === ROLES.MEMBER && task.assignee?.toString() !== user._id.toString()) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only access tasks assigned to you');
  }
  next();
};

// only the assignee (or manager+) can change a task's status
const canChangeStatus = (req, res, next) => {
  if (!req.task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  const { user, task } = req;
  if (user.role === ROLES.MEMBER && task.assignee?.toString() !== user._id.toString()) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the assignee can change this task status');
  }
  next();
};

const sameOrg = (orgField = 'organization') => {
  return (req, res, next) => {
    const resourceOrg =
      req.task?.[orgField]?.toString() ||
      req.project?.[orgField]?.toString() ||
      req.targetUser?.[orgField]?.toString();

    if (resourceOrg && resourceOrg !== req.user.organization.toString()) {
      return sendError(res, 403, 'FORBIDDEN', 'Access to resources outside your organization is denied');
    }
    next();
  };
};

module.exports = { authorize, adminOnly, managerOrAbove, allRoles, ownTaskOrAbove, canChangeStatus, sameOrg, ROLES };
