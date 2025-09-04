const express = require("express");
const { body, validationResult, query } = require("express-validator");
const Task = require("../models/Task");
const Project = require("../models/Project");
const axios = require("axios");

const router = express.Router();

// Validation middleware
const validateTaskCreation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be 3-200 characters"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be 10-2000 characters"),
  body("assignee").isMongoId().withMessage("Valid assignee ID is required"),
  body("reporter").isMongoId().withMessage("Valid reporter ID is required"),
  body("project").isMongoId().withMessage("Valid project ID is required"),
  body("dueDate").isISO8601().withMessage("Valid due date is required"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
  body("type")
    .optional()
    .isIn(["bug", "feature", "improvement", "documentation", "testing"])
    .withMessage("Invalid type"),
];

const validateTaskUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be 3-200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be 10-2000 characters"),
  body("status")
    .optional()
    .isIn(["pending", "in-progress", "review", "completed", "cancelled"])
    .withMessage("Invalid status"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Valid due date is required"),
];

// Authentication middleware (simplified for demo - in production, verify JWT)
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header required" });
    }

    // In production, verify JWT token here
    // For demo purposes, we'll assume the token is valid
    req.userId = "demo-user-id"; // This should come from JWT verification
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Helper function to send notification
const sendNotification = async (type, data) => {
  try {
    const notificationServiceUrl =
      process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3003";
    await axios.post(`${notificationServiceUrl}/send-email`, {
      type,
      data,
    });
  } catch (error) {
    console.error("Failed to send notification:", error.message);
  }
};

// Routes

// GET / - Get all tasks with filtering and pagination
router.get(
  "/",
  authenticateUser,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be 1-100"),
    query("status")
      .optional()
      .isIn(["pending", "in-progress", "review", "completed", "cancelled"])
      .withMessage("Invalid status"),
    query("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority"),
    query("assignee").optional().isMongoId().withMessage("Invalid assignee ID"),
    query("project").optional().isMongoId().withMessage("Invalid project ID"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        page = 1,
        limit = 10,
        status,
        priority,
        assignee,
        project,
        search,
      } = req.query;

      const query = { isArchived: false };
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (assignee) query.assignee = assignee;
      if (project) query.project = project;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
        ];
      }

      const tasks = await Task.find(query)
        .populate("assignee", "firstName lastName email")
        .populate("reporter", "firstName lastName email")
        .populate("project", "name")
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Task.countDocuments(query);

      res.json({
        tasks,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
      });
    } catch (error) {
      console.error("Get tasks error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch tasks", message: error.message });
    }
  }
);

// POST / - Create a new task
router.post("/", authenticateUser, validateTaskCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskData = {
      ...req.body,
      reporter: req.userId, // Set reporter to current user
    };

    const task = new Task(taskData);
    await task.save();

    // Populate references for response
    await task.populate("assignee", "firstName lastName email");
    await task.populate("reporter", "firstName lastName email");
    await task.populate("project", "name");

    // Send notification to assignee
    await sendNotification("task_assigned", {
      taskId: task._id,
      taskTitle: task.title,
      assigneeEmail: task.assignee.email,
    });

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res
      .status(500)
      .json({ error: "Failed to create task", message: error.message });
  }
});

// GET /:id - Get a specific task
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignee", "firstName lastName email")
      .populate("reporter", "firstName lastName email")
      .populate("project", "name")
      .populate("dependencies", "title status priority");

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ task });
  } catch (error) {
    console.error("Get task error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch task", message: error.message });
  }
});

// PUT /:id - Update a task
router.put("/:id", authenticateUser, validateTaskUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user can update this task
    if (
      task.assignee.toString() !== req.userId &&
      task.reporter.toString() !== req.userId
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this task" });
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("assignee", "firstName lastName email")
      .populate("reporter", "firstName lastName email")
      .populate("project", "name");

    // Send notification if status changed
    if (req.body.status && req.body.status !== task.status) {
      await sendNotification("task_status_changed", {
        taskId: task._id,
        taskTitle: task.title,
        oldStatus: task.status,
        newStatus: req.body.status,
        assigneeEmail: updatedTask.assignee.email,
      });
    }

    res.json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Update task error:", error);
    res
      .status(500)
      .json({ error: "Failed to update task", message: error.message });
  }
});

// DELETE /:id - Delete a task
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user can delete this task
    if (task.reporter.toString() !== req.userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this task" });
    }

    // Soft delete - mark as archived
    task.isArchived = true;
    task.archivedAt = new Date();
    task.archivedBy = req.userId;
    await task.save();

    res.json({ message: "Task archived successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    res
      .status(500)
      .json({ error: "Failed to delete task", message: error.message });
  }
});

// PATCH /:id/status - Update task status
router.patch(
  "/:id/status",
  authenticateUser,
  [
    body("status")
      .isIn(["pending", "in-progress", "review", "completed", "cancelled"])
      .withMessage("Invalid status"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status } = req.body;
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Check if user can update this task
      if (
        task.assignee.toString() !== req.userId &&
        task.reporter.toString() !== req.userId
      ) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this task" });
      }

      const oldStatus = task.status;
      task.status = status;

      if (status === "completed") {
        task.completedDate = new Date();
      }

      await task.save();

      // Send notification about status change
      await sendNotification("task_status_changed", {
        taskId: task._id,
        taskTitle: task.title,
        oldStatus,
        newStatus: status,
        assigneeEmail: task.assignee.email,
      });

      res.json({
        message: "Task status updated successfully",
        task,
      });
    } catch (error) {
      console.error("Update task status error:", error);
      res.status(500).json({
        error: "Failed to update task status",
        message: error.message,
      });
    }
  }
);

// PATCH /:id/assign - Reassign task
router.patch(
  "/:id/assign",
  authenticateUser,
  [body("assignee").isMongoId().withMessage("Valid assignee ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { assignee } = req.body;
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Check if user can reassign this task
      if (task.reporter.toString() !== req.userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to reassign this task" });
      }

      const oldAssignee = task.assignee;
      task.assignee = assignee;
      await task.save();

      // Send notification to new assignee
      await sendNotification("task_assigned", {
        taskId: task._id,
        taskTitle: task.title,
        assigneeEmail: assignee,
      });

      res.json({
        message: "Task reassigned successfully",
        task,
      });
    } catch (error) {
      console.error("Reassign task error:", error);
      res
        .status(500)
        .json({ error: "Failed to reassign task", message: error.message });
    }
  }
);

// GET /user/:userId - Get tasks assigned to a specific user
router.get("/user/:userId", authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { userId } = req.params;

    const query = { assignee: userId, isArchived: false };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate("project", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ dueDate: 1 });

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get user tasks error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user tasks", message: error.message });
  }
});

// GET /project/:projectId - Get tasks for a specific project
router.get("/project/:projectId", authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority } = req.query;
    const { projectId } = req.params;

    const query = { project: projectId, isArchived: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate("assignee", "firstName lastName email")
      .populate("reporter", "firstName lastName email")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ priority: -1, dueDate: 1 });

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get project tasks error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch project tasks", message: error.message });
  }
});

// POST /:id/comments - Add comment to task
router.post(
  "/:id/comments",
  authenticateUser,
  [
    body("content")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Comment content must be 1-1000 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content } = req.body;
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      await task.addComment(req.userId, content);

      // Populate the new comment
      await task.populate("comments.user", "firstName lastName");

      res.json({
        message: "Comment added successfully",
        task,
      });
    } catch (error) {
      console.error("Add comment error:", error);
      res
        .status(500)
        .json({ error: "Failed to add comment", message: error.message });
    }
  }
);

// GET /:id/comments - Get comments for a task
router.get("/:id/comments", authenticateUser, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("comments.user", "firstName lastName email")
      .select("comments");

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ comments: task.comments });
  } catch (error) {
    console.error("Get comments error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch comments", message: error.message });
  }
});

module.exports = router;
