Deciding which API to use: https://addepto.com/blog/google-gemini-api-vs-open-ai-api-main-differences/

Baseline — ChatGPT clone in terminal (any topic).
  Learned so far: I want to use a text-generation model vs a reasoning model. 
  My json request looks like this: 
  ({
    model: "gpt-5",
    input: "Write a one-sentence bedtime story about a unicorn."
})
  Response from the API looks like this: 
  [
    {
        "id": "msg_67b73f697ba4819183a15cc17d011509",
        "type": "message",
        "role": "assistant",
        "content": [
            {
                "type": "output_text",
                "text": "Under the soft glow of the moon, Luna the unicorn danced through fields of twinkling stardust, leaving trails of dreams for every child asleep.",
                "annotations": []
            }
        ]
    }
]

Session memory — conversation context works per run, but forgotten after exit.

Domain restriction — assistant only answers about you.
  Data ingestion + embeddings/vector DB layer comes in: you supply your own context, and the model generates text exclusively grounded in that.
  Step A: Used a system prompt guardrail with const initialPrompt
  Step B (stronger): add a retrieval layer (RAG) so it only has knowledge of your portfolio.
  Learning Points:
    cached embed score at beginning of program start instead of during so that message retrieval and api calls are a lot faster
    ?: what does the embed score do, how is it being calculated
    The embed score = cosine similarity between the query vector and stored chunk vectors. Higher score → more relevant chunk.
    currently, with every response, precompute.js and input.js create a "Context" text field with key words, terms, up to k-amount so the bot can search for that information and provide relevant information according to the embed score. 
    embeddings api call: converts text into a high-dimensional vector (e.g., 1536 numbers) that represents its meaning. These vectors are cached and compared with user queries using cosine similarity to retrieve the most relevant chunks.
  Future Improvements:
    Project details: challenges, impact, lessons learned, tech stack nuances.
    Personality/fun facts: quirky habits, triathlon, rock climbing, Letterboxd, music habits.
    External references: portfolio, LinkedIn, GitHub.
    Future goals: AI, UI/UX, product design ambitions.
    Achievements/recognitions: awards, ambassador roles, notable milestones.
    Technical depth: for projects like EcoScan, voting analysis, Hotplate.
    Granular tags for better RAG retrieval.

Current workflow: 
  precompute.js: create an embedding vector for every json entry of background data. 
  chat.js: takes user query. calls retrieval from rag.json 
  input.js: user query -> embedded vector. compares against precomputed vectors with cosine similarity. returns a json of top k relevantTexts. gives context text in phrases / sentences 
  openAI api: takes that json of context (top k relevant chunks) and generates a text response using the openAI algorithm. sends it back to my program chat.js: output openAI api's text response

Wrap my current terminal based chatbot in an API so I can deploy
  Learning points:
    Curl // a command line tool i can use to send post/fetch requests. can test any api endpoint with a structured json response and the word curl before the command
    chat.js just locally ran my logic. followed same logic in server.js so i could access the returned text object and return it within the endpoint as a json
    ?: post request vs fetch request vs get etc. ? 
  Future Improvements:
    error handling
    server-side session history? does it still follow the way chat.js does
Deploy Backend
  Add rate limits

Frontend integration — Framer calls your backend and displays answers with visuals.

//speed is pretty good thats exciting!
//add console logs to confirm endpoint is being hit, session memory by passing history instead of appending a single message
//the thinking for the first message goes to original size and then goes back after
//Chat thread resets every time I visit away from it, engage session memory
//create the posts for my highlighted portfolio pieces 
//cms pages on the front-end
//enhance performance of the bot / data provided for the bot