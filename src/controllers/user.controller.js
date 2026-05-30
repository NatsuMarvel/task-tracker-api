const { User, ROLES } = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');

const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({ organization: req.user.organization, isActive: true }).sort({ createdAt: -1 });
    return sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;

    const user = await User.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');

    if (req.params.id === req.user._id.toString() && isActive === false) {
      return sendError(res, 400, 'INVALID_OPERATION', 'You cannot deactivate your own account');
    }

    if (role && Object.values(ROLES).includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return sendError(res, 400, 'INVALID_OPERATION', 'You cannot delete your own account');
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );
    if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');

    return sendSuccess(res, { message: 'User deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, getUser, updateUser, deleteUser };
