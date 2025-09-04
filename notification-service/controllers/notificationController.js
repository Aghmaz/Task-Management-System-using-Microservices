const express = require("express");
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// Email configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "your-email@gmail.com",
      pass: process.env.SMTP_PASS || "your-app-password",
    },
  });
};

// Email templates
const emailTemplates = {
  taskAssigned: `
    <h2>New Task Assigned</h2>
    <p>Hello,</p>
    <p>You have been assigned a new task: <strong>{{taskTitle}}</strong></p>
    <p><strong>Task ID:</strong> {{taskId}}</p>
    <p><strong>Priority:</strong> {{priority}}</p>
    <p><strong>Due Date:</strong> {{dueDate}}</p>
    <p>Please log in to your dashboard to view the complete task details.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,

  taskStatusChanged: `
    <h2>Task Status Updated</h2>
    <p>Hello,</p>
    <p>The status of task <strong>{{taskTitle}}</strong> has been changed from <strong>{{oldStatus}}</strong> to <strong>{{newStatus}}</strong>.</p>
    <p><strong>Task ID:</strong> {{taskId}}</p>
    <p>Please check your dashboard for more details.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,

  taskOverdue: `
    <h2>Task Overdue Alert</h2>
    <p>Hello,</p>
    <p>The following task is overdue:</p>
    <p><strong>Task:</strong> {{taskTitle}}</p>
    <p><strong>Task ID:</strong> {{taskId}}</p>
    <p><strong>Due Date:</strong> {{dueDate}}</p>
    <p>Please update the task status or request an extension.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,

  projectUpdate: `
    <h2>Project Update</h2>
    <p>Hello,</p>
    <p>There has been an update to project <strong>{{projectName}}</strong>.</p>
    <p><strong>Update:</strong> {{updateMessage}}</p>
    <p>Please check your dashboard for more details.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,

  welcome: `
    <h2>Welcome to Task Management System</h2>
    <p>Hello {{firstName}},</p>
    <p>Welcome to our task management platform! Your account has been successfully created.</p>
    <p>You can now log in and start managing your tasks.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,

  passwordReset: `
    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>You have requested a password reset for your account.</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="{{resetLink}}">Reset Password</a></p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>This link will expire in 10 minutes.</p>
    <br>
    <p>Best regards,<br>Task Management System</p>
  `,
};

// Compile email templates
const compiledTemplates = {};
Object.keys(emailTemplates).forEach((key) => {
  compiledTemplates[key] = handlebars.compile(emailTemplates[key]);
});

// Validation middleware
const validateEmailRequest = [
  body("to").isEmail().withMessage("Valid recipient email is required"),
  body("subject")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Subject must be 1-200 characters"),
  body("template")
    .optional()
    .isIn(Object.keys(emailTemplates))
    .withMessage("Invalid email template"),
  body("data").optional().isObject().withMessage("Data must be an object"),
];

const validateSMSRequest = [
  body("to")
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage("Valid phone number is required"),
  body("message")
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage("Message must be 1-160 characters"),
];

// Routes

// POST /send-email - Send email notification
router.post("/send-email", validateEmailRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, subject, template, data, html, text } = req.body;

    let emailContent;
    if (template && compiledTemplates[template]) {
      emailContent = compiledTemplates[template](data || {});
    } else if (html) {
      emailContent = html;
    } else if (text) {
      emailContent = text;
    } else {
      return res
        .status(400)
        .json({ error: "Template, HTML, or text content is required" });
    }

    const transporter = createEmailTransporter();

    const mailOptions = {
      from:
        process.env.SMTP_FROM ||
        "Task Management System <noreply@taskmanagement.com>",
      to,
      subject: subject || "Task Management System Notification",
      html: emailContent,
      text: emailContent.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
    };

    const info = await transporter.sendMail(mailOptions);

    // Log the email (in production, save to database)
    console.log("Email sent successfully:", {
      messageId: info.messageId,
      to,
      subject,
      template: template || "custom",
    });

    res.json({
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({
      error: "Failed to send email",
      message: error.message,
    });
  }
});

// POST /send-sms - Send SMS notification
router.post("/send-sms", validateSMSRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, message } = req.body;

    // In production, integrate with SMS service like Twilio
    // For demo purposes, we'll just log the SMS
    console.log("SMS would be sent:", {
      to,
      message,
      timestamp: new Date().toISOString(),
    });

    // Simulate SMS sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    res.json({
      message: "SMS sent successfully",
      to,
      messageId: `sms_${Date.now()}`,
    });
  } catch (error) {
    console.error("Send SMS error:", error);
    res.status(500).json({
      error: "Failed to send SMS",
      message: error.message,
    });
  }
});

// POST /send-push - Send push notification
router.post(
  "/send-push",
  [
    body("userId").notEmpty().withMessage("User ID is required"),
    body("title")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Title must be 1-100 characters"),
    body("body")
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage("Body must be 1-500 characters"),
    body("data").optional().isObject().withMessage("Data must be an object"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, title, body, data } = req.body;

      // In production, integrate with push notification service like Firebase
      // For demo purposes, we'll just log the push notification
      console.log("Push notification would be sent:", {
        userId,
        title,
        body,
        data,
        timestamp: new Date().toISOString(),
      });

      // Simulate push notification sending delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      res.json({
        message: "Push notification sent successfully",
        userId,
        notificationId: `push_${Date.now()}`,
      });
    } catch (error) {
      console.error("Send push notification error:", error);
      res.status(500).json({
        error: "Failed to send push notification",
        message: error.message,
      });
    }
  }
);

// GET /templates - Get available email templates
router.get("/templates", (req, res) => {
  try {
    const templates = Object.keys(emailTemplates).map((key) => ({
      name: key,
      description: getTemplateDescription(key),
      variables: getTemplateVariables(key),
    }));

    res.json({ templates });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({
      error: "Failed to fetch templates",
      message: error.message,
    });
  }
});

// POST /templates - Create custom email template
router.post(
  "/templates",
  [
    body("name")
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Template name must be 1-50 characters"),
    body("subject")
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Subject must be 1-200 characters"),
    body("html")
      .trim()
      .isLength({ min: 10 })
      .withMessage("HTML content must be at least 10 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, subject, html, description } = req.body;

      // In production, save custom templates to database
      // For demo purposes, we'll just log the template creation
      console.log("Custom template created:", {
        name,
        subject,
        description,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        message: "Template created successfully",
        template: { name, subject, description },
      });
    } catch (error) {
      console.error("Create template error:", error);
      res.status(500).json({
        error: "Failed to create template",
        message: error.message,
      });
    }
  }
);

// PUT /templates/:id - Update email template
router.put(
  "/templates/:id",
  [
    body("subject")
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Subject must be 1-200 characters"),
    body("html")
      .optional()
      .trim()
      .isLength({ min: 10 })
      .withMessage("HTML content must be at least 10 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateData = req.body;

      // In production, update template in database
      // For demo purposes, we'll just log the update
      console.log("Template updated:", {
        id,
        updateData,
        timestamp: new Date().toISOString(),
      });

      res.json({
        message: "Template updated successfully",
        templateId: id,
      });
    } catch (error) {
      console.error("Update template error:", error);
      res.status(500).json({
        error: "Failed to update template",
        message: error.message,
      });
    }
  }
);

// DELETE /templates/:id - Delete email template
router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // In production, delete template from database
    // For demo purposes, we'll just log the deletion
    console.log("Template deleted:", {
      id,
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: "Template deleted successfully",
      templateId: id,
    });
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({
      error: "Failed to delete template",
      message: error.message,
    });
  }
});

// GET /history - Get notification history
router.get("/history", async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    // In production, fetch from database
    // For demo purposes, we'll return mock data
    const mockHistory = [
      {
        id: "1",
        type: "email",
        recipient: "user@example.com",
        subject: "Task Assigned",
        status: "sent",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "2",
        type: "sms",
        recipient: "+1234567890",
        message: "Task status updated",
        status: "sent",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    res.json({
      notifications: mockHistory,
      totalPages: 1,
      currentPage: parseInt(page),
      total: mockHistory.length,
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({
      error: "Failed to fetch notification history",
      message: error.message,
    });
  }
});

// GET /history/:id - Get specific notification details
router.get("/history/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // In production, fetch from database
    // For demo purposes, we'll return mock data
    const mockNotification = {
      id,
      type: "email",
      recipient: "user@example.com",
      subject: "Task Assigned",
      content: "You have been assigned a new task",
      status: "sent",
      timestamp: new Date().toISOString(),
      metadata: {
        taskId: "task123",
        userId: "user456",
      },
    };

    res.json({ notification: mockNotification });
  } catch (error) {
    console.error("Get notification details error:", error);
    res.status(500).json({
      error: "Failed to fetch notification details",
      message: error.message,
    });
  }
});

// Helper functions
function getTemplateDescription(templateName) {
  const descriptions = {
    taskAssigned: "Sent when a task is assigned to a user",
    taskStatusChanged: "Sent when task status is updated",
    taskOverdue: "Sent when a task becomes overdue",
    projectUpdate: "Sent for project-related updates",
    welcome: "Sent to new users upon registration",
    passwordReset: "Sent when password reset is requested",
  };
  return descriptions[templateName] || "Custom email template";
}

function getTemplateVariables(templateName) {
  const variables = {
    taskAssigned: ["taskTitle", "taskId", "priority", "dueDate"],
    taskStatusChanged: ["taskTitle", "taskId", "oldStatus", "newStatus"],
    taskOverdue: ["taskTitle", "taskId", "dueDate"],
    projectUpdate: ["projectName", "updateMessage"],
    welcome: ["firstName"],
    passwordReset: ["resetLink"],
  };
  return variables[templateName] || [];
}

module.exports = router;
