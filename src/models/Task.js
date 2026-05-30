const mongoose = require('mongoose');

const PRIORITY = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

const STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
};

// TODO -> IN_PROGRESS -> IN_REVIEW -> DONE
// any active state can go to BLOCKED, BLOCKED can go back
const VALID_TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW:   ['DONE', 'BLOCKED'],
  DONE:        [],
  BLOCKED:     ['TODO', 'IN_PROGRESS', 'IN_REVIEW'],
};

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    priority: {
      type: String,
      enum: Object.values(PRIORITY),
      default: PRIORITY.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.TODO,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    due_date: {
      type: Date,
      default: null,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statusHistory: [
      {
        from: String,
        to: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

taskSchema.index({ organization: 1, status: 1 });
taskSchema.index({ organization: 1, assignee: 1 });
taskSchema.index({ organization: 1, due_date: 1 });
taskSchema.index({ assignee: 1, status: 1 });

taskSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === STATUS.DONE && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

taskSchema.statics.isValidTransition = (from, to) => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

module.exports = mongoose.model('Task', taskSchema);
module.exports.PRIORITY = PRIORITY;
module.exports.STATUS = STATUS;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
