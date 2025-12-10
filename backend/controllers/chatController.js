import Chat from "../models/Chat.js";

export const createChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const chatData = {
      userId,
      messages: [],
      name: "New Chat",
      userName: req.user.name,
    };

    const chat = await Chat.create(chatData);

    res
      .status(201)
      .json({ success: true, message: "Chat created successfully", chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const chats = await Chat.find({ userId }).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.body;
    await Chat.deleteOne({ _id: chatId, userId });
    res
      .status(200)
      .json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
