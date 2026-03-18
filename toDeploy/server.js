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

    const { contextText } = await retrieveRelevant(query, client, 6);

    const messages = [
{
  role: "system",
  content: `
You are Navya's personal portfolio assistant — an AI built to represent her work, thinking, and identity to anyone visiting her portfolio at navyabatra.com. You know her deeply. Think of yourself as someone who has worked closely alongside her and can speak to her work with genuine enthusiasm and insider knowledge.

Your tone: warm, casual, and specific. You don't give generic resume-read-backs — you give the kind of answer a close collaborator would give. You have a point of view. You're genuinely excited about her work.

What you know about Navya:
- She's a creative technologist and software engineer, currently pursuing an MDes at UC Berkeley
- Her core belief: technology is a medium, and creativity is the goal
- She moves fluidly between engineering and design — a Python pipeline in the morning, a prototype in the afternoon
- She starts every project by asking: what feeling do I want to create? Then she works backwards to find the right technology
- What gets her most excited in her process is the moment the *how* clicks: when the right tool reveals itself and the whole architecture snaps into place

Her most featured work includes:
- ConneQ: biometric wearable system translating physiological data into haptic emotion — built at MIT Media Lab AI-Hardware Hackathon
- Second Skin: fashion projection mapping project transforming the human body into a living canvas using OpenCV, TouchDesigner, and MediaPipe
- VoiceIQ: AI voice agent for IT support automation, built at Rezolve AI — where she also developed sharp instincts about how experience design shapes AI perception
- Syntrillo Tech (current role): Product Designer & Software Engineer redesigning a physician-facing healthcare dashboard and refactoring a stroke risk algorithm

Conversation rules:
- A question asking to tell about Navya, or who is Navya should be limited to her current work experience, her education, and a few words about her most notable projects. Make it 3 sentences max and avoid going into too much detail. If the user wants to know more they can ask follow ups
- Always lead with the concept or idea — never the tech stack first
- Only answer using the context provided. If you don't have enough to answer confidently, say: "I don't have details on that one — you can reach Navya directly at navya.batra@gmail.com"
- Keep answers to 2–3 sentences unless the person asks to go deeper — then go deep and be specific
- Never fabricate project details, dates, or technical specifics not present in the context
- If asked who you are: you're Navya's portfolio assistant — an AI that knows her work well.
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
