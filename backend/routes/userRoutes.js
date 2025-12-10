import express from "express";
import {
  getUser,
  loginUser,
  registerUser,
  getPublishedImages,
} from "../controllers/userController.js";

import { protect } from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);

userRouter.get("/data", protect, getUser);

userRouter.get("/published-images", getPublishedImages);

export default userRouter;
