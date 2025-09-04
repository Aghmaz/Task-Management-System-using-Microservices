const express = require("express");
const { query, validationResult } = require("express-validator");
const moment = require("moment");

const router = express.Router();

// Validation middleware
const validateDateRange = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO date"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be 1-100"),
];

// Helper function to get database connection
const getDb = (req) => req.app.locals.db;

// Helper function to handle database errors
const handleDbError = (error, res) => {
  console.error("Database error:", error);
  res.status(500).json({
    error: "Database operation failed",
    message: error.message,
  });
};

// Routes

// GET /dashboard - Get dashboard overview
router.get("/dashboard", async (req, res) => {
  try {
    const db = getDb(req);

    // Get total counts
    const totalUsersQuery =
      "SELECT COUNT(*) as count FROM users WHERE is_active = true";
    const totalProjectsQuery =
      "SELECT COUNT(*) as count FROM projects WHERE is_archived = false";
    const totalTasksQuery =
      "SELECT COUNT(*) as count FROM tasks WHERE is_archived = false";

    // Get status counts
    const taskStatusQuery = `
      SELECT status, COUNT(*) as count 
      FROM tasks 
      WHERE is_archived = false 
      GROUP BY status
    `;

    // Get overdue tasks count
    const overdueTasksQuery = `
      SELECT COUNT(*) as count 
      FROM tasks 
      WHERE due_date < CURRENT_TIMESTAMP 
        AND status NOT IN ('completed', 'cancelled') 
        AND is_archived = false
    `;

    // Get recent activity
    const recentActivityQuery = `
      SELECT 
        'task' as type,
        t.title as description,
        t.created_at as timestamp,
        u.first_name || ' ' || u.last_name as user_name
      FROM tasks t
      JOIN users u ON t.reporter_id = u.id
      WHERE t.is_archived = false
      UNION ALL
      SELECT 
        'project' as type,
        p.name as description,
        p.created_at as timestamp,
        u.first_name || ' ' || u.last_name as user_name
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.is_archived = false
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    // Execute queries
    const [
      totalUsers,
      totalProjects,
      totalTasks,
      taskStatuses,
      overdueTasks,
      recentActivity,
    ] = await Promise.all([
      db.query(totalUsersQuery),
      db.query(totalProjectsQuery),
      db.query(totalTasksQuery),
      db.query(taskStatusQuery),
      db.query(overdueTasksQuery),
      db.query(recentActivityQuery),
    ]);

    // Calculate completion rate
    const completedTasks =
      taskStatuses.rows.find((row) => row.status === "completed")?.count || 0;
    const completionRate =
      totalTasks.rows[0].count > 0
        ? Math.round((completedTasks / totalTasks.rows[0].count) * 100)
        : 0;

    res.json({
      overview: {
        totalUsers: parseInt(totalUsers.rows[0].count),
        totalProjects: parseInt(totalProjects.rows[0].count),
        totalTasks: parseInt(totalTasks.rows[0].count),
        overdueTasks: parseInt(overdueTasks.rows[0].count),
        completionRate,
      },
      taskStatuses: taskStatuses.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /tasks/summary - Get task summary report
router.get("/tasks/summary", validateDateRange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const db = getDb(req);

    let whereClause = "WHERE t.is_archived = false";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND t.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND t.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.type,
        t.due_date,
        t.progress,
        t.estimated_hours,
        t.actual_hours,
        u.first_name || ' ' || u.last_name as assignee_name,
        u.email as assignee_email,
        p.name as project_name,
        t.created_at,
        t.updated_at
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      JOIN projects p ON t.project_id = p.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      JOIN projects p ON t.project_id = p.id
      ${whereClause}
    `;

    const [tasks, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      tasks: tasks.rows,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /users/performance - Get user performance report
router.get("/users/performance", validateDateRange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, department, role } = req.query;
    const db = getDb(req);

    let whereClause = "WHERE u.is_active = true";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND t.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND t.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (department) {
      whereClause += ` AND u.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (role) {
      whereClause += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    const query = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as full_name,
        u.department,
        u.role,
        u.email,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN t.status = 'in-progress' THEN 1 END) as in_progress_tasks,
        COALESCE(SUM(t.actual_hours), 0) as total_hours_worked,
        COALESCE(AVG(t.actual_hours), 0) as avg_hours_per_task,
        COALESCE(
          AVG(CASE WHEN t.status = 'completed' 
            THEN EXTRACT(EPOCH FROM (t.completed_date - t.start_date))/3600 
            END), 0
        ) as avg_completion_time_hours,
        COALESCE(
          (COUNT(CASE WHEN t.status = 'completed' AND t.completed_date <= t.due_date THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 0)) * 100, 0
        ) as on_time_completion_rate
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assignee_id AND t.is_archived = false
      ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, u.department, u.role, u.email
      ORDER BY completed_tasks DESC, total_hours_worked DESC
    `;

    const result = await db.query(query, params);

    res.json({
      users: result.rows.map((row) => ({
        ...row,
        total_tasks: parseInt(row.total_tasks),
        completed_tasks: parseInt(row.completed_tasks),
        pending_tasks: parseInt(row.pending_tasks),
        in_progress_tasks: parseInt(row.in_progress_tasks),
        total_hours_worked: parseFloat(row.total_hours_worked),
        avg_hours_per_task: parseFloat(row.avg_hours_per_task),
        avg_completion_time_hours: parseFloat(row.avg_completion_time_hours),
        on_time_completion_rate: parseFloat(row.on_time_completion_rate),
      })),
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /projects/status - Get project status report
router.get("/projects/status", validateDateRange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, status, priority } = req.query;
    const db = getDb(req);

    let whereClause = "WHERE p.is_archived = false";
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND p.start_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND p.end_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      whereClause += ` AND p.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    const query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.priority,
        p.start_date,
        p.end_date,
        p.estimated_hours,
        p.actual_hours,
        p.budget,
        u.first_name || ' ' || u.last_name as owner_name,
        u.email as owner_email,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN t.status = 'in-progress' THEN 1 END) as in_progress_tasks,
        ROUND(
          CASE 
            WHEN COUNT(t.id) > 0 THEN 
              (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100
            ELSE 0 
          END, 2
        ) as completion_percentage,
        p.created_at,
        p.updated_at
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN tasks t ON p.id = t.project_id AND t.is_archived = false
      ${whereClause}
      GROUP BY p.id, p.name, p.description, p.status, p.priority, p.start_date, p.end_date, 
               p.estimated_hours, p.actual_hours, p.budget, u.first_name, u.last_name, u.email,
               p.created_at, p.updated_at
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, params);

    res.json({
      projects: result.rows.map((row) => ({
        ...row,
        total_tasks: parseInt(row.total_tasks),
        completed_tasks: parseInt(row.completed_tasks),
        pending_tasks: parseInt(row.pending_tasks),
        in_progress_tasks: parseInt(row.in_progress_tasks),
        estimated_hours: parseFloat(row.estimated_hours),
        actual_hours: parseFloat(row.actual_hours),
        budget: parseFloat(row.budget),
        completion_percentage: parseFloat(row.completion_percentage),
      })),
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// POST /generate-report - Generate custom report
router.post(
  "/generate-report",
  [
    query("type")
      .isIn(["tasks", "users", "projects", "performance", "custom"])
      .withMessage("Invalid report type"),
    query("format")
      .optional()
      .isIn(["json", "csv", "pdf"])
      .withMessage("Invalid format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, format = "json", parameters = {} } = req.body;
      const db = getDb(req);

      // In production, this would generate and save the report
      // For demo purposes, we'll just return a success message
      const reportId = `report_${Date.now()}`;

      console.log("Report generation requested:", {
        reportId,
        type,
        format,
        parameters,
        timestamp: new Date().toISOString(),
      });

      res.json({
        message: "Report generation started",
        reportId,
        status: "processing",
        estimatedCompletion: moment().add(5, "minutes").toISOString(),
      });
    } catch (error) {
      console.error("Generate report error:", error);
      res.status(500).json({
        error: "Failed to generate report",
        message: error.message,
      });
    }
  }
);

// GET /reports - Get list of generated reports
router.get("/reports", async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const db = getDb(req);

    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id,
        name,
        description,
        type,
        status,
        generated_by,
        file_path,
        file_size,
        created_at,
        completed_at
      FROM reports
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reports
      ${whereClause}
    `;

    const [reports, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      reports: reports.rows,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /reports/:id - Get specific report details
router.get("/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);

    const query = `
      SELECT 
        id,
        name,
        description,
        type,
        parameters,
        generated_by,
        file_path,
        file_size,
        status,
        created_at,
        completed_at
      FROM reports
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report: result.rows[0] });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /analytics/task-completion - Get task completion analytics
router.get(
  "/analytics/task-completion",
  validateDateRange,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, groupBy = "day" } = req.query;
      const db = getDb(req);

      let dateFormat, groupClause;
      switch (groupBy) {
        case "hour":
          dateFormat = "YYYY-MM-DD HH24:00";
          groupClause = "DATE_TRUNC('hour', t.completed_date)";
          break;
        case "day":
          dateFormat = "YYYY-MM-DD";
          groupClause = "DATE(t.completed_date)";
          break;
        case "week":
          dateFormat = "YYYY-WW";
          groupClause = "DATE_TRUNC('week', t.completed_date)";
          break;
        case "month":
          dateFormat = "YYYY-MM";
          groupClause = "DATE_TRUNC('month', t.completed_date)";
          break;
        default:
          dateFormat = "YYYY-MM-DD";
          groupClause = "DATE(t.completed_date)";
      }

      let whereClause =
        "WHERE t.status = 'completed' AND t.is_archived = false";
      const params = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND t.completed_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND t.completed_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      const query = `
      SELECT 
        ${groupClause} as period,
        COUNT(*) as completed_tasks,
        AVG(EXTRACT(EPOCH FROM (t.completed_date - t.start_date))/3600) as avg_completion_time_hours,
        SUM(t.actual_hours) as total_hours
      FROM tasks t
      ${whereClause}
      GROUP BY ${groupClause}
      ORDER BY period
    `;

      const result = await db.query(query, params);

      res.json({
        analytics: result.rows.map((row) => ({
          period: row.period,
          completed_tasks: parseInt(row.completed_tasks),
          avg_completion_time_hours: parseFloat(row.avg_completion_time_hours),
          total_hours: parseFloat(row.total_hours),
        })),
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// GET /analytics/user-productivity - Get user productivity analytics
router.get(
  "/analytics/user-productivity",
  validateDateRange,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, department } = req.query;
      const db = getDb(req);

      let whereClause = "WHERE u.is_active = true";
      const params = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND t.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND t.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (department) {
        whereClause += ` AND u.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      const query = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as full_name,
        u.department,
        u.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COALESCE(SUM(t.actual_hours), 0) as total_hours,
        COALESCE(
          AVG(CASE WHEN t.status = 'completed' 
            THEN EXTRACT(EPOCH FROM (t.completed_date - t.start_date))/3600 
            END), 0
        ) as avg_completion_time,
        COALESCE(
          (COUNT(CASE WHEN t.status = 'completed' AND t.completed_date <= t.due_date THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 0)) * 100, 0
        ) as on_time_rate
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assignee_id AND t.is_archived = false
      ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, u.department, u.role
      ORDER BY completed_tasks DESC, total_hours DESC
    `;

      const result = await db.query(query, params);

      res.json({
        productivity: result.rows.map((row) => ({
          ...row,
          total_tasks: parseInt(row.total_tasks),
          completed_tasks: parseInt(row.completed_tasks),
          total_hours: parseFloat(row.total_hours),
          avg_completion_time: parseFloat(row.avg_completion_time),
          on_time_rate: parseFloat(row.on_time_rate),
        })),
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// GET /analytics/project-timeline - Get project timeline analytics
router.get(
  "/analytics/project-timeline",
  validateDateRange,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, status } = req.query;
      const db = getDb(req);

      let whereClause = "WHERE p.is_archived = false";
      const params = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND p.start_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND p.end_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND p.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const query = `
      SELECT 
        p.id,
        p.name,
        p.status,
        p.start_date,
        p.end_date,
        p.estimated_hours,
        p.actual_hours,
        EXTRACT(EPOCH FROM (p.end_date - p.start_date))/86400 as duration_days,
        EXTRACT(EPOCH FROM (CURRENT_DATE - p.start_date))/86400 as days_elapsed,
        CASE 
          WHEN p.end_date < CURRENT_DATE AND p.status NOT IN ('completed', 'cancelled') THEN 'overdue'
          WHEN p.end_date >= CURRENT_DATE AND p.status NOT IN ('completed', 'cancelled') THEN 'on_track'
          ELSE p.status
        END as timeline_status
      FROM projects p
      ${whereClause}
      ORDER BY p.start_date DESC
    `;

      const result = await db.query(query, params);

      res.json({
        timeline: result.rows.map((row) => ({
          ...row,
          duration_days: parseFloat(row.duration_days),
          days_elapsed: parseFloat(row.days_elapsed),
          estimated_hours: parseFloat(row.estimated_hours),
          actual_hours: parseFloat(row.actual_hours),
        })),
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

module.exports = router;
