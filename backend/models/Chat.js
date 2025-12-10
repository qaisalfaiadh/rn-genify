import mongoose from "mongoose";

const chatSchmea = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, required: true },
    name: { type: String, required: true },
    messages: [
      {
        isImage: { type: Boolean, required: true },
        isPublished: { type: Boolean, required: false },
        role: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchmea);

export default Chat;
