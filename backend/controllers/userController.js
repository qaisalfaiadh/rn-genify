import User from "../models/User.js";

import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import Chat from "../models/Chat.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });


    await Chat.create({
      userId:user._id,
      userName:user.name,
      name:"New Chat",
      messages:[],
    })


    const token = generateToken(user._id);

    res.status(201).json({ success: true, token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        const token = generateToken(user._id);
        return res.status(200).json({ success: true, token });
      }
    }

    return res.status(400).json({ success: false, message: "Invalid email or password" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getPublishedImages = async (req, res) => {
  try {
    const publishedImagesMessages = await Chat.aggregate([
      { $unwind: "$messages" },
      {
        $match: {
          "messages.isImage": true,
          "messages.isPublished": true,
        },
      },
      {
        $project: {
        _id: 0,
          imageUrl: "$messages.content",
          userName: "$userName",
        },
      },
    ]);

    res.json({ success: true, images: publishedImagesMessages.reverse() });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
