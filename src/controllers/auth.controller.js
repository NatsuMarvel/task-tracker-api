const { User, ROLES } = require('../models/User');
const Organization = require('../models/Organization');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const { name, email, password, organizationName, role } = req.body;

    let org = await Organization.findOne({ name: organizationName });
    if (!org) {
      org = await Organization.create({ name: organizationName });
    }

    const existing = await User.findOne({ email, organization: org._id });
    if (existing) {
      return sendError(res, 409, 'DUPLICATE_ERROR', 'Email already registered in this organization');
    }

    // first user in a new org becomes admin automatically
    const orgUserCount = await User.countDocuments({ organization: org._id });
    const assignedRole = orgUserCount === 0 ? ROLES.ADMIN : (role || ROLES.MEMBER);

    const user = await User.create({ name, email, password, role: assignedRole, organization: org._id });

    const payload = { userId: user._id, orgId: org._id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, { user, accessToken, refreshToken }, 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isActive: true }).select('+password +refreshToken');
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const payload = { userId: user._id, orgId: user.organization, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, { user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return sendError(res, 401, 'TOKEN_REUSE', 'Refresh token already used or invalid');
    }

    const payload = { userId: user._id, orgId: user.organization, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res) => {
  return sendSuccess(res, { user: req.user });
};

module.exports = { register, login, refresh, logout, me };
