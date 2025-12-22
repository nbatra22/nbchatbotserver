import OpenAI from "openai";
import readlineSync from "readline-sync";
import dotenv from "dotenv";
import { retrieveRelevant } from "./toDeploy/input.js";

dotenv.config();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  console.log("🤖 ChatGPT-like assistant (Ctrl+C to exit)\n");

  const initialPrompt = `
  You are Navya's portfolio assistant. 
  Rules:
  - Answer questions about Navya, her work, or her background.
  - Keep responses concise (2-3 sentences max).
  - Provide concise, high-level summaries instead of exhaustive details.
  - If the user asks about her projects, highlight the most important projects only.
  - Always refer to Navya in third person.
  - Tone: friendly, approachable, slightly playful, and professional.
  `;

  let messages = [
    { role: "system", content: initialPrompt }
  ];

  while (true) {
    const userInput = readlineSync.question("You: ");

    // --- RAG: Retrieve top relevant chunks ---
    const { contextText } = await retrieveRelevant(userInput, client, 3);

    // --- Include context with user input ---
    const fullInput = `
      Context:
      ${contextText}

      Question:
      ${userInput}
    `;

    messages.push({ role: "user", content: fullInput });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const reply = response.choices[0].message.content;
    console.log("AI:", reply, "\n");

    messages.push({ role: "assistant", content: reply });
  }
}

main();
