import express from "express";
import { PORT } from "./src/config.js";
import { getSession, addMessage, getSessionCount } from "./src/sessions.js";
import { processConversation } from "./src/agent.js";

const app = express();

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  if (req.method === "POST" && req.body) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Logistics proxy assistant is running",
    activeSessions: getSessionCount()
  });
});

// Main conversation endpoint
app.post("/", async (req, res) => {
  try {
    const { sessionID, msg } = req.body;
    
    // Validate input
    if (!sessionID) {
      return res.status(400).json({ error: "sessionID is required" });
    }
    
    if (!msg) {
      return res.status(400).json({ error: "msg is required" });
    }
    
    console.log(`📨 Session: ${sessionID}`);
    console.log(`💬 Message: ${msg}`);
    
    // Get conversation history
    const history = getSession(sessionID);
    
    // Add user message to history
    addMessage(sessionID, "user", msg);
    
    // Process with AI agent
    console.log(`🤖 Processing with AI...`);
    const response = await processConversation(getSession(sessionID));
    
    // Add assistant response to history
    addMessage(sessionID, "assistant", response);
    
    console.log(`✅ Response: ${response}`);
    
    // Return response
    res.json({ msg: response });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 Logistics Proxy Assistant");
  console.log("=".repeat(50));
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/`);
  console.log(`✓ Main endpoint: POST http://localhost:${PORT}/`);
  console.log("\n💡 Expose publicly with:");
  console.log(`   ngrok http ${PORT}`);
  console.log(`   ssh -p 443 -R0:localhost:${PORT} a.pinggy.io`);
  console.log("\n⏳ Waiting for requests...\n");
});


