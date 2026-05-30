const Project = require('../models/Project');
const { User } = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');

const listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ organization: req.user.organization, isActive: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    return sendSuccess(res, projects);
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const { name, description, members } = req.body;

    if (members?.length) {
      const validCount = await User.countDocuments({ _id: { $in: members }, organization: req.user.organization });
      if (validCount !== members.length) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'All members must belong to your organization');
      }
    }

    const project = await Project.create({
      name,
      description,
      members: members || [],
      organization: req.user.organization,
      createdBy: req.user._id,
    });

    return sendSuccess(res, project, 201);
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, organization: req.user.organization })
      .populate('members', 'name email role')
      .populate('createdBy', 'name email');
    if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { name, description, members } = req.body;

    const project = await Project.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (members) project.members = members;

    await project.save();
    return sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );
    if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return sendSuccess(res, { message: 'Project archived successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listProjects, createProject, getProject, updateProject, deleteProject };
