import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";
import { retrieveRelevant } from "./input.js";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Redis client
// REDIS_URL can be something like: redis://:password@host:port
const redis = new Redis(process.env.REDIS_URL);

// TTL for session history in seconds (e.g., 30 minutes)
const SESSION_TTL = 1800;

// --- Ping endpoint ---
// Frontend hits this on page load to warm up and receive a sessionId
app.get("/ping", async (req, res) => {
  try {
    let { sessionId } = req.query;

    // Generate new UUID if not provided
    if (!sessionId) {
      sessionId = uuidv4();
    }

    // Ensure a session entry exists in Redis with empty history
    const exists = await redis.exists(`session:${sessionId}`);
    if (!exists) {
      await redis.set(`session:${sessionId}`, JSON.stringify([]), "EX", SESSION_TTL);
    } else {
      // Refresh TTL
      await redis.expire(`session:${sessionId}`, SESSION_TTL);
    }

    res.json({ sessionId, message: "pong" });
  } catch (err) {
    console.error("Error in /ping:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Chat endpoint ---
// Accepts { sessionId, query }
app.post("/chat", async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    if (!query || !sessionId) {
      return res.status(400).json({ error: "Missing 'query' or 'sessionId' in request body" });
    }

    // Retrieve conversation history from Redis
    let historyRaw = await redis.get(`session:${sessionId}`);
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // Retrieve top-k context from portfolio data
    const { contextText } = await retrieveRelevant(query, client, 3);

    const initialPrompt = `
      You are Navya's portfolio assistant.
      Rules:
      - Answer questions about Navya, her work, or her background.
      - Keep responses concise (2-3 sentences max).
      - Provide high-level summaries, not exhaustive details.
      - If the user asks about projects, highlight only the most important ones.
      - Always refer to Navya in third person.
      - Tone: friendly, approachable, slightly playful, and professional.
    `;

    // Build messages for OpenAI
    const messages = [
      { role: "system", content: initialPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })), // previous conversation
      {
        role: "user",
        content: `
          Context:
          ${contextText}

          Question:
          ${query}
        `,
      },
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = response.choices[0].message.content;

    // Update session history in Redis
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: reply });

    await redis.set(`session:${sessionId}`, JSON.stringify(history), "EX", SESSION_TTL);

    res.json({ text: reply });
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
