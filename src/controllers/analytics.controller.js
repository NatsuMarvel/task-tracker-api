const Task = require('../models/Task');
const { sendSuccess } = require('../utils/response');

const taskAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.organization;
    const now = new Date();

    const [overdueByUser, avgCompletion, statusBreakdown] = await Promise.all([
      // overdue = past due_date, not done, has an assignee
      Task.aggregate([
        {
          $match: {
            organization: orgId,
            due_date: { $lt: now },
            status: { $nin: ['DONE'] },
            assignee: { $ne: null },
          },
        },
        { $group: { _id: '$assignee', overdueCount: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            overdueCount: 1,
          },
        },
        { $sort: { overdueCount: -1 } },
      ]),

      Task.aggregate([
        { $match: { organization: orgId, status: 'DONE', completedAt: { $ne: null } } },
        {
          $group: {
            _id: '$assignee',
            avgMs: { $avg: { $subtract: ['$completedAt', '$createdAt'] } },
            completedCount: { $sum: 1 },
          },
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmpty: true } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            avgCompletionHours: { $round: [{ $divide: ['$avgMs', 3600000] }, 1] },
            completedCount: 1,
          },
        },
        { $sort: { avgCompletionHours: 1 } },
      ]),

      Task.aggregate([
        { $match: { organization: orgId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
    ]);

    return sendSuccess(res, { overdueByUser, avgCompletionTime: avgCompletion, statusBreakdown });
  } catch (err) {
    next(err);
  }
};

module.exports = { taskAnalytics };
