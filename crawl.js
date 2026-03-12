const fs = require("fs");
const puppeteer = require("puppeteer");
const { v4: uuidv4 } = require("uuid");

const START_URL = "https://www.navyabatra.com/";
const CHUNK_SIZE = 600;
const visited = new Set();
const queue = [START_URL];
const entries = [];

function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function crawl() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  while (queue.length > 0) {
    const url = queue.shift();

    if (visited.has(url)) continue;
    visited.add(url);

    try {
      console.log("Crawling:", url);
      await page.goto(url, { waitUntil: "networkidle2" });

      // Extract page text
      const text = await page.evaluate(() => document.body.innerText);
      const chunks = chunkText(text, CHUNK_SIZE);
      chunks.forEach(chunk => {
        entries.push({
          id: "auto_" + uuidv4(),
          type: "portfolio_auto",
          text: chunk,
          tags: ["portfolio", "auto_generated"],
          source: url
        });
      });

      // Find internal links
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a"))
          .map(a => a.href)
          .filter(href => href.includes(window.location.origin)) // internal links only
      );

      // Add new links to queue if not visited
      links.forEach(link => {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      });

      console.log("Queue length:", queue.length);

    } catch (err) {
      console.log("Failed to crawl:", url, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync(
    "./rag_auto.json",
    JSON.stringify(entries, null, 2)
  );

  console.log("Generated rag_auto.json with", entries.length, "entries");
}

crawl();