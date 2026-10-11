const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { InferenceClient } = require("@huggingface/inference");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const dataDir = path.join(__dirname, "..", "data");
const notesFile = path.join(dataDir, "notes.json");
const envFile = path.join(__dirname, "..", ".env");
const plants = require("../data/plants.json");

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(notesFile)) {
  fs.writeFileSync(notesFile, "[]", "utf8");
}

app.use(cors());
app.use(express.json({ limit: "15mb" }));

function readNotes() {
  try {
    return JSON.parse(fs.readFileSync(notesFile, "utf8"));
  } catch {
    return [];
  }
}

function writeNotes(notes) {
  fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2), "utf8");
}

function requireHF() {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN is not configured. Check your .env file.");
  }
  return new InferenceClient(process.env.HF_TOKEN);
}

function logDetailedError(label, err) {
  console.error(label, err?.message || err);
  if (err?.cause) console.error("ERROR CAUSE:", err.cause);
}

// Health check with active model reporting
app.get("/api/health", (req, res) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
  const hasHF = Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN.trim());

  res.json({
    ok: true,
    app: "Jadi-Booti Solo",
    activeProvider: hasGroq ? "Groq (LPU Inference)" : hasHF ? "Hugging Face" : "Starter Local Mode",
    groqConfigured: hasGroq,
    hfConfigured: hasHF,
    models: {
      vision: hasGroq
        ? (process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b")
        : (process.env.HF_VISION_MODEL || "Qwen/Qwen2.5-VL-3B-Instruct"),
      chat: hasGroq
        ? (process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b")
        : (process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-7B-Instruct"),
      asr: process.env.HF_ASR_MODEL || "whisper-large-v3"
    },
    plantCatalogCount: plants.length
  });
});

// Update or set Groq API key dynamically
app.post("/api/config", (req, res) => {
  const { groqApiKey } = req.body || {};
  if (typeof groqApiKey === "string") {
    process.env.GROQ_API_KEY = groqApiKey.trim();

    try {
      if (fs.existsSync(envFile)) {
        let envContent = fs.readFileSync(envFile, "utf8");
        if (envContent.includes("GROQ_API_KEY=")) {
          envContent = envContent.replace(/GROQ_API_KEY=.*(\r?\n|$)/, `GROQ_API_KEY=${groqApiKey.trim()}$1`);
        } else {
          envContent = `GROQ_API_KEY=${groqApiKey.trim()}\n` + envContent;
        }
        fs.writeFileSync(envFile, envContent, "utf8");
      }
    } catch (e) {
      console.warn("Could not persist GROQ_API_KEY to .env:", e.message);
    }

    return res.json({ ok: true, groqConfigured: Boolean(process.env.GROQ_API_KEY) });
  }
  res.status(400).json({ error: "Invalid API key format" });
});

app.get("/api/plants", (req, res) => {
  res.json(plants);
});

app.get("/api/notes", (req, res) => {
  res.json(readNotes());
});

app.post("/api/notes", (req, res) => {
  const {
    plantId,
    plantName,
    scientificName,
    characteristics,
    potentialUses,
    photo,
    questId,
    questTitle,
    text,
    language,
    latitude,
    longitude,
    gpsEnabled,
    createdAt
  } = req.body || {};

  if (!text && !plantName && !photo) {
    return res.status(400).json({
      error: "Note text, plant identification, or photo is required."
    });
  }

  const note = {
    id: crypto.randomUUID(),
    plantId: plantId || null,
    plantName: plantName || "Nature Observation",
    scientificName: scientificName || null,
    characteristics: characteristics || null,
    potentialUses: potentialUses || null,
    photo: photo || null,
    questId: questId || null,
    questTitle: questTitle || null,
    text: (text || "").trim(),
    language: language || "English",
    gpsEnabled: Boolean(gpsEnabled),
    latitude: gpsEnabled ? latitude ?? null : null,
    longitude: gpsEnabled ? longitude ?? null : null,
    createdAt: createdAt || new Date().toISOString()
  };

  const notes = readNotes();
  notes.unshift(note);
  writeNotes(notes);

  res.status(201).json(note);
});

app.delete("/api/notes/:id", (req, res) => {
  const notes = readNotes();
  const next = notes.filter(n => n.id !== req.params.id);
  writeNotes(next);
  res.json({ ok: true });
});

// Speech-to-text with Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required." });
    }

    // Try Groq Whisper if Groq API key is present
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      try {
        const formData = new FormData();
        const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-large-v3-turbo");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}`
          },
          body: formData
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          return res.json({ text: groqData.text || "" });
        }
      } catch (groqErr) {
        console.warn("Groq transcription failed, checking fallback:", groqErr.message);
      }
    }

    // Hugging Face fallback
    const hf = requireHF();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "audio/webm"
    });

    const result = await hf.automaticSpeechRecognition({
      model: process.env.HF_ASR_MODEL || "openai/whisper-large-v3",
      data: audioBlob
    });

    res.json({ text: result.text || "" });
  } catch (err) {
    logDetailedError("TRANSCRIPTION ERROR:", err);
    res.status(500).json({
      error: err.message || "Transcription failed."
    });
  }
});

// Helper to extract JSON from AI response and normalize data types
function parseAIJson(raw) {
  let cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Try finding json bounds if extra text was included
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let obj;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    obj = {
      commonName: cleaned.slice(0, 50) || "Unknown Plant",
      scientificName: "",
      confidence: 0.7,
      characteristics: "Observed outdoors during nature exploration.",
      potentialUses: "Educational botanical observation.",
      warning: "Identification may be uncertain. Do not consume or use without botanical verification.",
      alternatives: []
    };
  }

  // Normalize array fields to readable strings
  if (Array.isArray(obj.characteristics)) {
    obj.characteristics = obj.characteristics.join(". ");
  }
  if (Array.isArray(obj.potentialUses)) {
    obj.potentialUses = obj.potentialUses.join(". ");
  }
  if (Array.isArray(obj.warning)) {
    obj.warning = obj.warning.join(". ");
  }
  if (!Array.isArray(obj.alternatives)) {
    obj.alternatives = obj.alternatives ? [String(obj.alternatives)] : [];
  }

  return obj;
}

// AI Plant Identification using Groq Vision Model (Qwen 3.8 27B Vision)
app.post("/api/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image is required." });
    }

    const base64 = req.file.buffer.toString("base64");
    const mime = req.file.mimetype || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    let parsedResult = null;
    let providerUsed = "None";
    let lastError = null;

    // 1. Try Groq Vision first (Fast open-weight Qwen 3.8 27B Vision)
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      try {
        const groqModel = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
        console.log(`Calling Groq Vision model: ${groqModel} (image size: ${(req.file.buffer.length / 1024).toFixed(1)} KB)`);

        const prompt = `You are an expert botanical identification engine for the Touch Grass nature exploration app "Jadi-Booti Solo".
Carefully analyze the plant, tree, flower, leaf, or seed shown in this outdoor photo. Identify the EXACT species in the picture (e.g. Sunflower, Hibiscus, Rose, Neem, Peepal, Marigold, etc.).

Respond ONLY with valid JSON (no markdown formatting, no code ticks) in this exact schema:
{
  "commonName": "Primary common name of the plant shown (e.g. Sunflower, Hibiscus, Neem, Tulsi, Rose)",
  "scientificName": "Binomial scientific name (e.g. Helianthus annuus, Hibiscus rosa-sinensis)",
  "confidence": 0.92,
  "characteristics": "2-3 sentences describing key visual features (flower petals, leaf shape, venation, color, margins)",
  "potentialUses": "Brief traditional, cultural, or ecological role. Explicitly state this is for educational context, not medical advice.",
  "warning": "Field Notice: AI botanical identification is assistive and can be uncertain. Always verify with local experts before touching or ingesting unfamiliar plants.",
  "alternatives": ["Alternative species 1", "Alternative species 2"]
}
If uncertain, provide your closest educated botanical identification.`;

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 500
          })
        });

        if (!groqRes.ok) {
          const errBody = await groqRes.text();
          console.error("Groq Vision API Error:", groqRes.status, errBody);
          throw new Error(`Groq API returned ${groqRes.status}: ${errBody}`);
        }

        const groqData = await groqRes.json();
        const rawContent = groqData.choices?.[0]?.message?.content || "";
        console.log("Groq Vision Raw Output:", rawContent);
        parsedResult = parseAIJson(rawContent);
        providerUsed = `Groq Vision (${groqModel})`;
      } catch (groqErr) {
        lastError = groqErr.message;
        console.warn("Groq Vision failed, checking fallback:", groqErr.message);
      }
    }

    // 2. Try Hugging Face fallback if Groq didn't succeed and HF token exists
    if (!parsedResult && process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
      try {
        const hf = requireHF();
        const hfModel = process.env.HF_VISION_MODEL || "Qwen/Qwen2.5-VL-3B-Instruct";
        console.log(`Calling Hugging Face Vision model: ${hfModel}`);

        const out = await hf.chatCompletion({
          model: hfModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Identify the most likely plant in this photo. " +
                    "Return JSON only with keys commonName, scientificName, " +
                    "confidence (0-1), characteristics, potentialUses, warning, and alternatives (array of strings). " +
                    "If uncertain, say so. Do not invent a species."
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl }
                }
              ]
            }
          ],
          max_tokens: 400,
          temperature: 0.1
        });

        const raw = out.choices?.[0]?.message?.content || "";
        parsedResult = parseAIJson(raw);
        providerUsed = `Hugging Face (${hfModel})`;
      } catch (hfErr) {
        lastError = lastError || hfErr.message;
        console.warn("Hugging Face Vision fallback also failed:", hfErr.message);
      }
    }

    // 3. If neither AI provider succeeded, report error clearly rather than inventing a random false plant
    if (!parsedResult) {
      if (!process.env.GROQ_API_KEY || !process.env.GROQ_API_KEY.trim()) {
        return res.status(400).json({
          error: "No Groq API Key found. Click ⚙ Settings to add your free Groq key from console.groq.com."
        });
      }
      return res.status(502).json({
        error: `Could not identify the plant. ${lastError || "Please ensure the photo is clear and well lit."}`
      });
    }

    // Match with local knowledge catalog
    const commonNameLower = String(parsedResult.commonName || "").toLowerCase();
    const scientificNameLower = String(parsedResult.scientificName || "").toLowerCase();

    const matched = plants.find(p =>
      p.commonName.toLowerCase() === commonNameLower ||
      commonNameLower.includes(p.commonName.toLowerCase()) ||
      p.scientificName.toLowerCase() === scientificNameLower ||
      scientificNameLower.includes(p.scientificName.toLowerCase()) ||
      (p.hindiNames || []).some(name =>
        commonNameLower.includes(name.toLowerCase()) ||
        name.toLowerCase() === commonNameLower
      )
    );

    res.json({
      identification: parsedResult,
      knowledge: matched || null,
      provider: providerUsed,
      thumbnail: dataUrl.length < 2000000 ? dataUrl : null
    });
  } catch (err) {
    logDetailedError("PLANT IDENTIFICATION ERROR:", err);
    res.status(500).json({
      error: err.message || "Plant identification failed."
    });
  }
});

// Narration generation
app.post("/api/narrate", async (req, res) => {
  try {
    const { plant, userNotes = [] } = req.body || {};

    if (!plant) {
      return res.status(400).json({ error: "Plant data is required." });
    }

    const sources = (plant.sources || [])
      .map(s => `${s.name}: ${s.url}`)
      .join("\n");

    const notes = userNotes
      .map(n => `- ${n.text}`)
      .join("\n") || "No personal note yet.";

    const prompt = `You are the narration engine for Jadi-Booti Solo.
Only use the supplied plant facts and personal notes. Do not invent folklore, medical claims, locations, or species details.
Give a 45-70 word friendly, warm narration for someone who is currently walking outdoors in nature.
Mention the source names for factual claims. Personal notes should be clearly described as the user's own observation.
If traditional use is mentioned, state it is traditional knowledge and not medical advice.

PLANT FACTS:
Name: ${plant.commonName}
Scientific name: ${plant.scientificName}
Summary: ${plant.summary || plant.characteristics}
Ecology: ${plant.ecology || "Provides shelter, food, and nectar for local biodiversity."}
Traditional note: ${plant.traditionalNote || plant.potentialUses}

SOURCES:
${sources || "Local Botanical Field Collection"}

USER NOTES:
${notes}`;

    // Try Groq Chat first
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      try {
        const groqChatModel = process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b";
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: groqChatModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 180,
            temperature: 0.2
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          return res.json({
            narration: groqData.choices?.[0]?.message?.content || ""
          });
        }
      } catch (groqErr) {
        console.warn("Groq narration failed, trying fallback:", groqErr.message);
      }
    }

    // Hugging Face fallback
    if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
      try {
        const hf = requireHF();
        const out = await hf.chatCompletion({
          model: process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-7B-Instruct",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 180,
          temperature: 0.2
        });

        return res.json({
          narration: out.choices?.[0]?.message?.content || ""
        });
      } catch (hfErr) {
        console.warn("HF narration failed:", hfErr.message);
      }
    }

    // Default template narration if no AI is available
    res.json({
      narration: `You are observing ${plant.commonName} (${plant.scientificName}). ${plant.summary || "A notable plant in your local environment."} ${plant.traditionalNote || ""} Take a deep breath and observe its leaf patterns against the daylight.`
    });
  } catch (err) {
    logDetailedError("NARRATION ERROR:", err);
    res.status(500).json({
      error: err.message || "Narration failed."
    });
  }
});

app.listen(PORT, () => {
  console.log(`🌿 Jadi-Booti Solo server running at: http://localhost:${PORT}`);
});
