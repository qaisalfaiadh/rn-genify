import express from "express";

import { protect } from "../middleware/auth.js";

import {
  imageMessageController,
  textMessageController,
} from "../controllers/messageController.js";


const messageRouter = express.Router(); 

// Add logging middleware to see incoming requests
messageRouter.use((req, res, next) => {
  console.log(`[Message Router] ${req.method} ${req.path}`);
  next();
});

messageRouter.post('/text', protect, textMessageController);
messageRouter.post('/image', protect, imageMessageController);

export default messageRouter;



