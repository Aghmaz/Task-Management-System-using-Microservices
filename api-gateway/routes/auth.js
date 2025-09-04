const express = require("express");
const axios = require("axios");
const router = express.Router();

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";

// Middleware to forward requests to auth service
const forwardToAuthService = async (req, res) => {
  try {
    const { method, url, body, headers, query } = req;
    const targetUrl = `${AUTH_SERVICE_URL}${url}`;

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
    console.error("Auth service error:", error.message);

    if (error.response) {
      // Forward the error response from auth service
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: "Auth Service Unavailable",
        message: "Unable to connect to authentication service",
      });
    }
  }
};

// Auth routes
router.post("/register", forwardToAuthService);
router.post("/login", forwardToAuthService);
router.post("/logout", forwardToAuthService);
router.post("/refresh-token", forwardToAuthService);
router.get("/profile", forwardToAuthService);
router.put("/profile", forwardToAuthService);
router.post("/forgot-password", forwardToAuthService);
router.post("/reset-password", forwardToAuthService);
router.post("/verify-email", forwardToAuthService);

module.exports = router;
