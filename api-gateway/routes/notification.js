const express = require("express");
const axios = require("axios");
const router = express.Router();

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3003";

// Middleware to forward requests to notification service
const forwardToNotificationService = async (req, res) => {
  try {
    const { method, url, body, headers, query } = req;
    const targetUrl = `${NOTIFICATION_SERVICE_URL}${url}`;

    const config = {
      method,
      url: targetUrl,
      data: body,
      params: query,
      headers: {
        ...headers,
        "x-forwarded-for": req.ip,
        "x-forwarded-proto": req.protocol,
        "x-forwarded-host": req.get("host"),
      },
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Notification service error:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: "Notification Service Unavailable",
        message: "Unable to connect to notification service",
      });
    }
  }
};

// Notification routes
router.post("/send-email", forwardToNotificationService);
router.post("/send-sms", forwardToNotificationService);
router.post("/send-push", forwardToNotificationService);
router.get("/templates", forwardToNotificationService);
router.post("/templates", forwardToNotificationService);
router.put("/templates/:id", forwardToNotificationService);
router.delete("/templates/:id", forwardToNotificationService);
router.get("/history", forwardToNotificationService);
router.get("/history/:id", forwardToNotificationService);

module.exports = router;
