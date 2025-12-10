import express from "express";
import cors from "cors";
import "dotenv/config.js";
import connectDB from "./config/db.js";
import userRouter from "./routes/userRoutes.js";
import chatRouter from "./routes/chatRoutes.js";
import messageRouter from "./routes/messageRoutes.js";

const app = express();
await connectDB();

const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(express.json());

// Log all incoming requests for debugging (before routes)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => {
  res.send("hello from backend server");
});

app.use("/api/user", userRouter);
app.use('/api/chat',chatRouter)
app.use('/api/message',messageRouter)

// Debug route to check if message routes are registered
app.get('/api/message/debug', (req, res) => {
  res.json({ 
    message: 'Message routes are registered',
    availableRoutes: ['/api/message/text', '/api/message/image']
  });
});

// 404 handler for API routes (after all routes)
// Use a proper catch-all pattern for Express 5
app.use((req, res, next) => {
  // Only handle 404s for API routes
  if (req.path.startsWith('/api/')) {
    console.error(`404 - Route not found: ${req.method} ${req.path}`);
    return res.status(404).json({ 
      success: false, 
      message: `Route not found: ${req.method} ${req.path}`,
      availableRoutes: {
        user: ['/api/user/login', '/api/user/register', '/api/user/data'],
        chat: ['/api/chat/create', '/api/chat/get', '/api/chat/delete'],
        message: ['/api/message/text', '/api/message/image']
      }
    });
  }
  next();
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
