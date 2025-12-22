import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const data = JSON.parse(fs.readFileSync("./rag.json", "utf-8"));

async function precomputeEmbeddings() {
  const embeddedChunks = [];

  for (const chunk of data) {
    const embResp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk.text,
    });

    embeddedChunks.push({
      ...chunk,
      embedding: embResp.data[0].embedding,
    });
  }

  fs.writeFileSync("./toDeploy/rag_embeddings.json", JSON.stringify(embeddedChunks, null, 2));
  console.log("✅ Embeddings saved to rag_embeddings.json");
}

precomputeEmbeddings();
