import fs from "fs";

// Load precomputed embeddings
const embeddedChunks = JSON.parse(fs.readFileSync("./rag_embeddings.json", "utf-8"));

// --- Cosine similarity ---
function cosineSim(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

// --- Retrieve top-k relevant chunks ---
export async function retrieveRelevant(userInput, client, k = 3) {
  const inputEmb = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: userInput,
  });
  const inputVector = inputEmb.data[0].embedding;

  const ranked = embeddedChunks
    .map(chunk => ({
      ...chunk,
      score: cosineSim(inputVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const contextText = ranked.map(c => c.text).join("\n");

  return { relevantChunks: ranked, contextText };
}
