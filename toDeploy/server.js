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

// ---------- OpenAI ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Redis (SINGLE INSTANCE) ----------
console.log("REDIS_URL:", process.env.REDIS_URL || "MISSING");
const redis = new Redis(process.env.REDIS_URL, {
  tls: {},              // required for Azure
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("✅ Connected to Azure Redis (single instance)");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

// ---------- Config ----------
const SESSION_TTL = 1800; // 30 minutes

// ---------- Ping ----------
app.get("/ping", async (req, res) => {
  try {
    let { sessionId } = req.query;
    if (!sessionId) sessionId = uuidv4();

    const key = `session:${sessionId}`;

    const exists = await redis.exists(key);
    if (!exists) {
      await redis.set(key, JSON.stringify([]), "EX", SESSION_TTL);
    } else {
      await redis.expire(key, SESSION_TTL);
    }

    res.json({ sessionId, message: "pong" });
  } catch (err) {
    console.error("Error in /ping:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- Chat ----------
app.post("/chat", async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    if (!query || !sessionId) {
      return res.status(400).json({ error: "Missing query or sessionId" });
    }

    const key = `session:${sessionId}`;

    const historyRaw = await redis.get(key);
    const history = historyRaw ? JSON.parse(historyRaw) : [];

    const { contextText } = await retrieveRelevant(query, client, 3);

    const messages = [
      {
        role: "system",
        content: `
You are Navya's portfolio assistant.
Rules:
- Answer questions about Navya, her work, or her background.
- Keep responses concise (2–3 sentences max).
- Provide high-level summaries only.
- Always refer to Navya in the third person.
- Tone: friendly, approachable, professional.
        `,
      },
      ...history,
      {
        role: "user",
        content: `Context:\n${contextText}\n\nQuestion:\n${query}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = response.choices[0].message.content;

    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: reply });

    await redis.set(key, JSON.stringify(history), "EX", SESSION_TTL);

    res.json({ text: reply });
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
