const express = require("express");
const { body, query, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// JWT Secret
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

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

// Authentication middleware (simplified for demo - in production, verify JWT)
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header required" });
    }

    // In production, verify JWT token here
    // For demo purposes, we'll assume the token is valid
    req.userId = "demo-admin-id"; // This should come from JWT verification
    req.userRole = "admin"; // This should come from JWT verification
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Validation middleware
const validateUserUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be 2-50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be 2-50 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("role")
    .optional()
    .isIn(["user", "admin", "manager"])
    .withMessage("Invalid role"),
  body("department")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Department must be 1-100 characters"),
  body("position")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Position must be 1-100 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const validateUserSearch = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be 1-100"),
  query("role")
    .optional()
    .isIn(["user", "admin", "manager"])
    .withMessage("Invalid role"),
  query("department")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Department must be 1-100 characters"),
  query("search").optional().isString().withMessage("Search must be a string"),
];

// Routes

// GET /users - Get all users with filtering and pagination
router.get(
  "/users",
  authenticateAdmin,
  isAdmin,
  validateUserSearch,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { page = 1, limit = 10, role, department, search } = req.query;
      const db = getDb(req);

      let whereClause = "WHERE 1=1";
      const params = [];
      let paramIndex = 1;

      if (role) {
        whereClause += ` AND role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      if (department) {
        whereClause += ` AND department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        email ILIKE $${paramIndex}
      )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const offset = (page - 1) * limit;

      const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        department,
        position,
        is_active,
        created_at,
        updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

      params.push(limit, offset);

      const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      ${whereClause}
    `;

      const [users, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2)),
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        users: users.rows,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// GET /users/:id - Get specific user details
router.get("/users/:id", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);

    const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        department,
        position,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    handleDbError(error, res);
  }
});

// PUT /users/:id - Update user details
router.put(
  "/users/:id",
  authenticateAdmin,
  isAdmin,
  validateUserUpdate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateData = req.body;
      const db = getDb(req);

      // Check if user exists
      const checkQuery = "SELECT id FROM users WHERE id = $1";
      const checkResult = await db.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(updateData[key]);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const query = `
      UPDATE users 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

      const result = await db.query(query, params);

      res.json({
        message: "User updated successfully",
        user: result.rows[0],
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// DELETE /users/:id - Delete user (soft delete)
router.delete("/users/:id", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);

    // Check if user exists
    const checkQuery = "SELECT id, role FROM users WHERE id = $1";
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deletion of other admins
    if (checkResult.rows[0].role === "admin" && req.userId !== id) {
      return res.status(403).json({ error: "Cannot delete other admin users" });
    }

    // Soft delete - mark as inactive
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, first_name, last_name, email
    `;

    const result = await db.query(query, [id]);

    res.json({
      message: "User deactivated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// POST /users/:id/activate - Activate user
router.post(
  "/users/:id/activate",
  authenticateAdmin,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = getDb(req);

      const query = `
      UPDATE users 
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, first_name, last_name, email, is_active
    `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        message: "User activated successfully",
        user: result.rows[0],
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// POST /users/:id/deactivate - Deactivate user
router.post(
  "/users/:id/deactivate",
  authenticateAdmin,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = getDb(req);

      // Prevent deactivation of other admins
      if (req.userId !== id) {
        const checkQuery = "SELECT role FROM users WHERE id = $1";
        const checkResult = await db.query(checkQuery, [id]);

        if (
          checkResult.rows.length > 0 &&
          checkResult.rows[0].role === "admin"
        ) {
          return res
            .status(403)
            .json({ error: "Cannot deactivate other admin users" });
        }
      }

      const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, first_name, last_name, email, is_active
    `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        message: "User deactivated successfully",
        user: result.rows[0],
      });
    } catch (error) {
      handleDbError(error, res);
    }
  }
);

// GET /system/health - Get system health information
router.get("/system/health", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const db = getDb(req);

    // Get database statistics
    const userCountQuery = "SELECT COUNT(*) as count FROM users";
    const activeUserCountQuery =
      "SELECT COUNT(*) as count FROM users WHERE is_active = true";
    const adminCountQuery =
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'";

    const [userCount, activeUserCount, adminCount] = await Promise.all([
      db.query(userCountQuery),
      db.query(activeUserCountQuery),
      db.query(adminCountQuery),
    ]);

    // Get system information
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString(),
    };

    res.json({
      system: systemInfo,
      database: {
        totalUsers: parseInt(userCount.rows[0].count),
        activeUsers: parseInt(activeUserCount.rows[0].count),
        adminUsers: parseInt(adminCount.rows[0].count),
        connectionStatus: "Connected",
      },
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /system/logs - Get system logs (mock data for demo)
router.get("/system/logs", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, level, startDate, endDate } = req.query;

    // In production, this would fetch from a logging database
    // For demo purposes, we'll return mock data
    const mockLogs = [
      {
        id: 1,
        level: "INFO",
        message: "User authentication successful",
        userId: "user123",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        level: "WARN",
        message: "Failed login attempt",
        userId: "unknown",
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 3,
        level: "ERROR",
        message: "Database connection timeout",
        userId: "system",
        ipAddress: "127.0.0.1",
        userAgent: "Node.js/18.0.0",
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
    ];

    // Filter logs based on query parameters
    let filteredLogs = mockLogs;

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) >= start
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) <= end
      );
    }

    // Pagination
    const total = filteredLogs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    res.json({
      logs: paginatedLogs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Get system logs error:", error);
    res.status(500).json({
      error: "Failed to fetch system logs",
      message: error.message,
    });
  }
});

// GET /system/metrics - Get system performance metrics
router.get("/system/metrics", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const db = getDb(req);

    // Get user activity metrics
    const userActivityQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    const userActivity = await db.query(userActivityQuery);

    // Get role distribution
    const roleDistributionQuery = `
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      WHERE is_active = true
      GROUP BY role
    `;

    const roleDistribution = await db.query(roleDistributionQuery);

    // Get department distribution
    const departmentDistributionQuery = `
      SELECT 
        COALESCE(department, 'Unassigned') as department,
        COUNT(*) as count
      FROM users
      WHERE is_active = true
      GROUP BY department
      ORDER BY count DESC
    `;

    const departmentDistribution = await db.query(departmentDistributionQuery);

    res.json({
      userActivity: userActivity.rows.map((row) => ({
        date: row.date,
        new_users: parseInt(row.new_users),
      })),
      roleDistribution: roleDistribution.rows.map((row) => ({
        role: row.role,
        count: parseInt(row.count),
      })),
      departmentDistribution: departmentDistribution.rows.map((row) => ({
        department: row.department,
        count: parseInt(row.count),
      })),
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// POST /system/backup - Trigger system backup
router.post("/system/backup", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const { type = "full", description } = req.body;

    // In production, this would trigger an actual backup process
    // For demo purposes, we'll just return a success message
    const backupId = `backup_${Date.now()}`;

    console.log("System backup requested:", {
      backupId,
      type,
      description,
      requestedBy: req.userId,
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: "System backup initiated successfully",
      backupId,
      type,
      status: "processing",
      estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    });
  } catch (error) {
    console.error("System backup error:", error);
    res.status(500).json({
      error: "Failed to initiate system backup",
      message: error.message,
    });
  }
});

// GET /audit-logs - Get audit logs
router.get("/audit-logs", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      entityType,
      startDate,
      endDate,
    } = req.query;
    const db = getDb(req);

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      whereClause += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (entityType) {
      whereClause += ` AND entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `;

    const [auditLogs, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      auditLogs: auditLogs.rows,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// GET /audit-logs/:id - Get specific audit log details
router.get("/audit-logs/:id", authenticateAdmin, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);

    const query = `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    res.json({ auditLog: result.rows[0] });
  } catch (error) {
    handleDbError(error, res);
  }
});

module.exports = router;
