import OpenAI from "openai";

// Gemini API with OpenAI-compatible endpoint
// Note: Gemini's OpenAI-compatible API endpoint structure
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", // Remove trailing slash
  defaultQuery: { key: process.env.GEMINI_API_KEY },
});


export default openai;