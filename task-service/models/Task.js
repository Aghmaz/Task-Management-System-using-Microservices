const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    attachments: [
      {
        filename: String,
        url: String,
        type: String,
        size: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Task title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Task description is required"],
      trim: true,
      maxlength: [2000, "Task description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "review", "completed", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    type: {
      type: String,
      enum: ["bug", "feature", "improvement", "documentation", "testing"],
      default: "feature",
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must be assigned to someone"],
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must have a reporter"],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Task must belong to a project"],
    },
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
      default: 0,
    },
    actualHours: {
      type: Number,
      min: [0, "Actual hours cannot be negative"],
      default: 0,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    completedDate: Date,
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
      },
    ],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    subtasks: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, "Subtask title cannot exceed 200 characters"],
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        completedAt: Date,
      },
    ],
    attachments: [attachmentSchema],
    comments: [commentSchema],
    progress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: Date,
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for task age
taskSchema.virtual("age").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for days until due
taskSchema.virtual("daysUntilDue").get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
taskSchema.virtual("isOverdue").get(function () {
  if (
    !this.dueDate ||
    this.status === "completed" ||
    this.status === "cancelled"
  )
    return false;
  return new Date() > this.dueDate;
});

// Indexes for better query performance
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ isArchived: 1 });

// Pre-save middleware to update progress based on subtasks
taskSchema.pre("save", function (next) {
  if (this.subtasks && this.subtasks.length > 0) {
    const completedSubtasks = this.subtasks.filter(
      (subtask) => subtask.completed
    ).length;
    this.progress = Math.round(
      (completedSubtasks / this.subtasks.length) * 100
    );
  }

  // Update completed date when status changes to completed
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.completedDate
  ) {
    this.completedDate = new Date();
  }

  next();
});

// Static method to find overdue tasks
taskSchema.statics.findOverdueTasks = function () {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: ["completed", "cancelled"] },
  });
};

// Static method to find tasks by assignee
taskSchema.statics.findByAssignee = function (assigneeId) {
  return this.find({ assignee: assigneeId, isArchived: false });
};

// Static method to find tasks by project
taskSchema.statics.findByProject = function (projectId) {
  return this.find({ project: projectId, isArchived: false });
};

// Method to add comment
taskSchema.methods.addComment = function (userId, content, attachments = []) {
  this.comments.push({
    user: userId,
    content,
    attachments,
  });
  return this.save();
};

// Method to add subtask
taskSchema.methods.addSubtask = function (title) {
  this.subtasks.push({ title });
  return this.save();
};

// Method to complete subtask
taskSchema.methods.completeSubtask = function (subtaskIndex, userId) {
  if (this.subtasks[subtaskIndex]) {
    this.subtasks[subtaskIndex].completed = true;
    this.subtasks[subtaskIndex].completedBy = userId;
    this.subtasks[subtaskIndex].completedAt = new Date();
    return this.save();
  }
  throw new Error("Subtask not found");
};

module.exports = mongoose.model("Task", taskSchema);
