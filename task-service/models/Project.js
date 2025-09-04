const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: [100, "Project name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
      trim: true,
      maxlength: [1000, "Project description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "cancelled"],
      default: "planning",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Project must have an owner"],
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "manager", "developer", "tester", "viewer"],
          default: "developer",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    startDate: {
      type: Date,
      required: [true, "Project start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Project end date is required"],
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
    budget: {
      type: Number,
      min: [0, "Budget cannot be negative"],
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
      },
    ],
    categories: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Category cannot exceed 50 characters"],
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
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

// Virtual for project duration
projectSchema.virtual("duration").get(function () {
  if (!this.startDate || !this.endDate) return null;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for project progress (based on tasks)
projectSchema.virtual("progress").get(function () {
  // This would be calculated based on associated tasks
  return 0;
});

// Virtual for days until deadline
projectSchema.virtual("daysUntilDeadline").get(function () {
  if (!this.endDate) return null;
  const now = new Date();
  const deadline = new Date(this.endDate);
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
projectSchema.virtual("isOverdue").get(function () {
  if (
    !this.endDate ||
    this.status === "completed" ||
    this.status === "cancelled"
  )
    return false;
  return new Date() > this.endDate;
});

// Indexes for better query performance
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ status: 1, priority: 1 });
projectSchema.index({ endDate: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ isArchived: 1 });
projectSchema.index({ "members.user": 1 });

// Pre-save middleware
projectSchema.pre("save", function (next) {
  // Ensure end date is after start date
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error("End date must be after start date"));
  }
  next();
});

// Static method to find active projects
projectSchema.statics.findActiveProjects = function () {
  return this.find({ status: "active", isArchived: false });
};

// Static method to find projects by member
projectSchema.statics.findByMember = function (userId) {
  return this.find({
    "members.user": userId,
    isArchived: false,
  });
};

// Static method to find overdue projects
projectSchema.statics.findOverdueProjects = function () {
  return this.find({
    endDate: { $lt: new Date() },
    status: { $nin: ["completed", "cancelled"] },
  });
};

// Method to add member
projectSchema.methods.addMember = function (userId, role = "developer") {
  const existingMember = this.members.find(
    (member) => member.user.toString() === userId.toString()
  );
  if (existingMember) {
    existingMember.role = role;
  } else {
    this.members.push({ user: userId, role });
  }
  return this.save();
};

// Method to remove member
projectSchema.methods.removeMember = function (userId) {
  this.members = this.members.filter(
    (member) => member.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to check if user is member
projectSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString()
  );
};

// Method to check if user has role
projectSchema.methods.hasRole = function (userId, role) {
  const member = this.members.find(
    (member) => member.user.toString() === userId.toString()
  );
  return member && member.role === role;
};

module.exports = mongoose.model("Project", projectSchema);
