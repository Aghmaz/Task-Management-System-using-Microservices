const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");

const router = express.Router();

// JWT Secret
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Validation middleware
const validateRegistration = [
  body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be 2-50 characters"),
  body("lastName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be 2-50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("role")
    .optional()
    .isIn(["user", "admin", "manager"])
    .withMessage("Invalid role"),
];

const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Routes

// POST /register - User registration
router.post("/register", validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      position,
      phoneNumber,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: role || "user",
      department,
      position,
      phoneNumber,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: "User registered successfully",
      user: user.getPublicProfile(),
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ error: "Registration failed", message: error.message });
  }
});

// POST /login - User login
router.post("/login", validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Invalid credentials or inactive account" });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      user: user.getPublicProfile(),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed", message: error.message });
  }
});

// GET /profile - Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch profile", message: error.message });
  }
});

// PUT /profile - Update user profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      department,
      position,
      phoneNumber,
      preferences,
    } = req.body;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (department) updateData.department = department;
    if (position) updateData.position = position;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (preferences)
      updateData.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({
      message: "Profile updated successfully",
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res
      .status(500)
      .json({ error: "Profile update failed", message: error.message });
  }
});

// POST /logout - User logout (client-side token removal)
router.post("/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logout successful" });
});

// POST /refresh-token - Refresh JWT token
router.post("/refresh-token", authenticateToken, async (req, res) => {
  try {
    const newToken = generateToken(req.user._id);
    res.json({
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res
      .status(500)
      .json({ error: "Token refresh failed", message: error.message });
  }
});

// POST /forgot-password - Request password reset
router.post(
  "/forgot-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          message:
            "If an account with that email exists, a password reset link has been sent",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

      await user.save();

      // TODO: Send email with reset link
      // For now, just return success message
      res.json({ message: "Password reset link sent to your email" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        error: "Password reset request failed",
        message: error.message,
      });
    }
  }
);

// POST /reset-password - Reset password with token
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      // Update password and clear reset token
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Reset password error:", error);
      res
        .status(500)
        .json({ error: "Password reset failed", message: error.message });
    }
  }
);

// POST /verify-email - Verify email with token
router.post(
  "/verify-email",
  [body("token").notEmpty().withMessage("Verification token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res
          .status(400)
          .json({ error: "Invalid or expired verification token" });
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      res
        .status(500)
        .json({ error: "Email verification failed", message: error.message });
    }
  }
);

// Admin routes
// GET /users - Get all users (admin only)
router.get("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const query = { isActive: true };
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch users", message: error.message });
  }
});

module.exports = router;
