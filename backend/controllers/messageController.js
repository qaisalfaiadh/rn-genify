import axios from "axios";

import Chat from "../models/Chat.js";
import User from "../models/User.js";

import imagekit from "../config/imageKit.js";

export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 1) {
      return res
        .status(403)
        .json({ success: false, message: "Not enough credits" });
    }

    const { chatId, prompt } = req.body;

    if (!chatId || !prompt) {
      return res
        .status(400)
        .json({ success: false, message: "Chat ID and prompt are required" });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    // Add user message to chat
    const userMessage = {
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    };

    chat.messages.push(userMessage);

    // Prepare messages for AI - include chat history
    const messagesForAI = chat.messages
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
      .slice(-20); // Keep last 20 messages for context (to avoid token limits)

    let reply;
    try {
      // Call AI API with retry logic for rate limits
      let choices;
      let retries = 0;
      const maxRetries = 5; // Increased retries
      const baseDelay = 10000; // Start with 10 seconds (much longer initial delay for rate limits)

      // Try different model names in order of preference
      const modelNames = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
      let modelIndex = 0;
      
      while (retries <= maxRetries) {
        try {
          const modelName = modelNames[modelIndex] || modelNames[0];
          console.log(`Attempting Gemini API call with model: ${modelName} (attempt ${retries + 1}/${maxRetries + 1})`);
          
          // Use Gemini REST API directly instead of OpenAI-compatible endpoint
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in environment variables");
          }
          
          // Convert messages format for Gemini API
          // Gemini expects a different format - convert from OpenAI format
          const geminiContents = messagesForAI.map(msg => {
            if (msg.role === 'system') {
              // Gemini doesn't have system role, convert to user
              return { role: 'user', parts: [{ text: msg.content }] };
            }
            return {
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            };
          });
          
          // Call Gemini REST API
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          
          const response = await axios.post(
            geminiUrl,
            {
              contents: geminiContents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 60000, // 60 second timeout
            }
          );
          
          // Extract response from Gemini format
          if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
            throw new Error("Invalid response from Gemini API");
          }
          
          const geminiResponse = response.data.candidates[0].content.parts[0].text;
          
          // Convert to OpenAI-like format for consistency
          choices = [{
            message: {
              role: 'assistant',
              content: geminiResponse
            }
          }];
          
          console.log(`Gemini API call successful with model: ${modelName}`);
          break; // Success, exit retry loop
        } catch (retryError) {
          const errorStatus = retryError.response?.status || retryError.status || retryError.statusCode;
          const errorData = retryError.response?.data || {};
          const errorMessage = retryError.message?.toLowerCase() || '';
          
          console.error(`Gemini API error (attempt ${retries + 1}):`, {
            status: errorStatus,
            message: retryError.message,
            error: errorData,
          });
          
          // Check for rate limit error
          const isRateLimit = 
            errorStatus === 429 || 
            errorStatus === 503 ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('resource exhausted') ||
            (errorData.error?.code === 429) ||
            (errorData.error?.status === 'RESOURCE_EXHAUSTED');

          // Check for invalid model/authentication errors
          const isAuthError = errorStatus === 401 || errorStatus === 403;
          const isInvalidModel = errorStatus === 400 || errorStatus === 404;
          const isModelNotFound = errorStatus === 404 && (
            errorMessage.includes('model') || 
            errorMessage.includes('not found') ||
            errorData.error?.message?.includes('model')
          );

          if (isAuthError) {
            // Don't retry auth errors
            console.error(`Non-retryable error: Authentication failed - check GEMINI_API_KEY`);
            throw retryError;
          }

          // If invalid model or model not found, try next model name
          if ((isInvalidModel || isModelNotFound) && modelIndex < modelNames.length - 1) {
            modelIndex++;
            console.log(`Model ${modelNames[modelIndex - 1]} failed (${errorStatus}), trying ${modelNames[modelIndex]}`);
            continue; // Try again with next model
          }

          if (isRateLimit && retries < maxRetries) {
            // Exponential backoff with jitter: 10s, 20s, 40s, 80s, 160s
            const exponentialDelay = baseDelay * Math.pow(2, retries);
            // Add random jitter (0-5 seconds) to avoid thundering herd
            const jitter = Math.random() * 5000;
            const delay = exponentialDelay + jitter;
            const delaySeconds = Math.round(delay / 1000);
            console.log(`⚠️ Rate limit hit (${errorStatus}), retrying after ${delaySeconds}s (attempt ${retries + 1}/${maxRetries})`);
            
            // Check if there's a retry-after header from the API
            const retryAfter = retryError.response?.headers?.['retry-after'] || 
                             retryError.response?.headers?.['Retry-After'];
            if (retryAfter) {
              const retryAfterSeconds = parseInt(retryAfter, 10);
              if (retryAfterSeconds > delaySeconds) {
                console.log(`API suggests waiting ${retryAfterSeconds}s, using that instead`);
                await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
              } else {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            } else {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            retries++;
            continue;
          }
          
          // If rate limit and max retries reached, return a helpful error
          if (isRateLimit) {
            console.error(`❌ Rate limit exceeded after ${maxRetries} retries`);
            const retryAfter = retryError.response?.headers?.['retry-after'] || 
                             retryError.response?.headers?.['Retry-After'] || 
                             60;
            throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
          }
          
          // If invalid model and no more models to try, or max retries reached
          if (isInvalidModel || isModelNotFound) {
            console.error(`All model names failed. Last error: ${retryError.message}`);
            if (errorData.error?.message) {
              console.error(`Gemini API error details:`, errorData.error.message);
            }
          }
          
          // If not rate limit or max retries reached, throw the error
          throw retryError;
        }
      }

      if (!choices || !choices[0] || !choices[0].message) {
        throw new Error("Invalid response from AI service");
      }

      // Create reply message
      reply = {
        role: choices[0].message.role || "assistant",
        content: choices[0].message.content || "",
        timestamp: Date.now(),
        isImage: false,
      };
    } catch (apiError) {
      console.error("API Error in textMessageController:", {
        status: apiError.status || apiError.statusCode || apiError.response?.status,
        message: apiError.message,
        error: apiError.error || apiError.response?.data,
      });
      
      // Remove the user message we just added since API call failed
      chat.messages.pop();
      await chat.save();
      
      // Handle rate limit errors specifically - check multiple error structures
      const errorStatus = apiError.status || apiError.statusCode || apiError.response?.status;
      const errorMessage = apiError.message?.toLowerCase() || '';
      const isRateLimit = 
        errorStatus === 429 || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('quota') ||
        (apiError.error?.code === 429) ||
        (apiError.response?.data?.error?.code === 429);

      if (isRateLimit) {
        // Extract retry-after from error if available
        const retryAfter = apiError.response?.headers?.['retry-after'] || 
                          apiError.response?.headers?.['Retry-After'] || 
                          apiError.retryAfter ||
                          120; // Default to 2 minutes if not specified
        
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
          retryAfter: parseInt(retryAfter, 10),
        });
      }
      
      // Handle authentication errors
      if (errorStatus === 401 || errorStatus === 403) {
        return res.status(errorStatus).json({
          success: false,
          message: "Authentication failed. Please check your API configuration.",
        });
      }
      
      // Handle invalid model/request errors
      if (errorStatus === 400) {
        const detailedMessage = apiError.response?.data?.error?.message || 
                               apiError.error?.message || 
                               "Invalid request. Please check your prompt and try again.";
        return res.status(400).json({
          success: false,
          message: detailedMessage,
        });
      }
      
      // For other API errors, throw to be caught by outer catch
      throw apiError;
    }

    // Add AI reply to chat
    chat.messages.push(reply);

    // Save chat with both messages
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    // Send response after successful save
    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("Error in textMessageController:", {
      message: error.message,
      status: error.status || error.statusCode || error.response?.status,
      stack: error.stack,
    });
    
    // Determine appropriate status code - check multiple error structures
    let statusCode = 500;
    let errorMessage = error.message || "Failed to process message";
    
    // Extract status from various error structures (OpenAI SDK, axios, etc.)
    const status = error.status || error.statusCode || error.response?.status;
    
    // Check for rate limit
    const errorMsgLower = (error.message || '').toLowerCase();
    const isRateLimit = 
      status === 429 || 
      errorMsgLower.includes('rate limit') ||
      errorMsgLower.includes('quota');
    
    if (isRateLimit) {
      statusCode = 429;
      errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
    } else if (status === 401 || status === 403) {
      statusCode = status;
      errorMessage = "Authentication failed. Please check your API key.";
    } else if (status === 400) {
      statusCode = 400;
      // Try to extract more descriptive error message
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else {
        errorMessage = "Invalid request. Please check your input and try again.";
      }
    } else if (status >= 400 && status < 500) {
      statusCode = status;
      // Try to extract more descriptive error message
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};



export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 2) {
      return res
        .status(403)
        .json({ success: false, message: "Not enough credits" });
    }

    const { chatId, prompt, isPublished } = req.body;

    if (!chatId || !prompt) {
      return res
        .status(400)
        .json({ success: false, message: "Chat ID and prompt are required" });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    // Add user message to chat
    const userMessage = {
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    };

    chat.messages.push(userMessage);

    let reply;
    try {
      // Generate image using ImageKit with retry logic for rate limits
      let aiImageResponse;
      let retries = 0;
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      const encodedPrompt = encodeURIComponent(prompt);
      const genrateImageUrl = `${
        process.env.IMAGEKIT_URL_ENDPOINT
      }/ik-genimg-prompt-${encodedPrompt}/genify/${Date.now()}.png?tr=w-800,h-800`;

      // Retry logic for image generation
      while (retries <= maxRetries) {
        try {
          aiImageResponse = await axios.get(genrateImageUrl, {
            responseType: "arraybuffer",
            timeout: 30000, // 30 second timeout
          });
          break; // Success, exit retry loop
        } catch (retryError) {
          // Check for rate limit error
          const isRateLimit = 
            retryError.response?.status === 429 || 
            retryError.status === 429 ||
            retryError.statusCode === 429 ||
            (retryError.message && retryError.message.toLowerCase().includes('rate limit'));

          if (isRateLimit && retries < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, retries);
            console.log(`Rate limit hit for image generation, retrying after ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
            continue;
          }
          // If not rate limit or max retries reached, throw the error
          throw retryError;
        }
      }

      const base64Image = `data:image/png;base64,${Buffer.from(
        aiImageResponse.data,
        "binary"
      ).toString("base64")}`;

      const uploadResponse = await imagekit.upload({
        file: base64Image,
        fileName: `genify/ai-image-${Date.now()}.png`,
        folder: "genify",
      });

      if (!uploadResponse || !uploadResponse.url) {
        throw new Error("Failed to upload image");
      }

      // Create reply message
      reply = {
        role: "assistant",
        content: uploadResponse.url,
        timestamp: Date.now(),
        isImage: true,
        isPublished: isPublished || false,
      };
    } catch (apiError) {
      // Handle rate limit and other API errors - check multiple error structures
      const isRateLimit = 
        apiError.response?.status === 429 || 
        apiError.status === 429 ||
        apiError.statusCode === 429 ||
        (apiError.message && apiError.message.toLowerCase().includes('rate limit'));

      if (isRateLimit) {
        // Remove the user message we just added since API call failed
        chat.messages.pop();
        await chat.save();
        
        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded. Please wait a moment and try again.",
          retryAfter: 60, // Suggest waiting 60 seconds
        });
      }
      
      // For other API errors, also rollback the user message
      chat.messages.pop();
      await chat.save();
      
      throw apiError;
    }

    // Add AI reply to chat
    chat.messages.push(reply);

    // Save chat with both messages
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

    // Send response after successful save
    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("Error in imageMessageController:", error);
    
    // Determine appropriate status code - check multiple error structures
    let statusCode = 500;
    let errorMessage = error.message || "Failed to generate image";
    
    // Extract status from various error structures (axios, ImageKit, etc.)
    const status = error.status || error.statusCode || error.response?.status;
    
    // Check for rate limit
    const isRateLimit = 
      status === 429 || 
      (error.message && error.message.toLowerCase().includes('rate limit'));
    
    if (isRateLimit) {
      statusCode = 429;
      errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
    } else if (status === 401 || status === 403) {
      statusCode = status;
      errorMessage = "Authentication failed. Please check your API credentials.";
    } else if (status >= 400 && status < 500) {
      statusCode = status;
      // Try to extract more descriptive error message
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};
