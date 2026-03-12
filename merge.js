//this file merges my RAG files

const fs = require("fs");

const manual = JSON.parse(fs.readFileSync("./rag.json"));
const auto = JSON.parse(fs.readFileSync("./rag_auto.json"));

const combined = [...manual, ...auto];

fs.writeFileSync(
  "./rag_combined.json",
  JSON.stringify(combined, null, 2)
);

console.log("Merged RAG files → rag_combined.json");