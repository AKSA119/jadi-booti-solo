# Jadi-Booti Solo 🌿

An AI-powered nature exploration app and botanical memory journal built for the **Touch Grass Hackathon Challenge**.

> **Touch Grass Philosophy:** The screen is the shortest part of the experience. Use open AI to help people step away from devices, discover living flora in parks and neighborhoods, complete physical outdoor missions, and record place-linked memories.

---

## 🌟 The 3 Core Pillars

### 1. AI Plant Identification (Open-Weight Vision)
- Users take a photo with their phone camera outdoors or upload a leaf/bark/flower specimen.
- Analyzed via **Meta Llama 3.2 Vision (`llama-3.2-11b-vision-preview`)** hosted on high-speed **Groq LPU** inference.
- Provides common name, botanical binomial, confidence score, leaf/bark visual characteristics, traditional ecological uses, and a clear safety uncertainty notice.
- Audio narration reads out plant stories and observation notes in natural Hindi/English speech.

### 2. Nature Quests (Outdoor Missions)
- Physical field missions that motivate users to explore the real world:
  - 🍃 **The Tri-Leaf Hunter:** Find 3 leaves with distinct geometries (serrated neem, cordate peepal, smooth oval guava/mango).
  - 🌸 **Bloom & Pollinator Watch:** Observe an active flower for 60 seconds without screen distraction.
  - 🌲 **Ancient Bark & Canopy Scout:** Touch tree bark, observe lichens or moss, and inspect the canopy.
  - 🚶 **500-Step Sensory Stroll:** Walk 500 steps outdoors noticing scents and breezes.
  - 🌿 **Sacred Herb Discovery:** Locate aromatic medicinal herbs like Tulsi or Mint.
  - 💧 **Sunlit Vein Inspector:** Examine leaf venation held against sunlight.
- Track completed tasks, earn explorer ranks (*Sprout Scout* → *Wild Wanderer* → *Master Naturalist*), and link discoveries directly to quests.

### 3. Personal Nature Journal
- Preserves your outdoor discoveries with photos, botanical classifications, transcribed voice notes, timestamps, and GPS coordinates.
- Filter memories by photo, quest status, or search by plant name.
- Listen back to memories with speech synthesis.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5, Modern CSS (Design System with Fraunces & Plus Jakarta Sans), ES Modules |
| **Backend** | Node.js (v24), Express 5 |
| **Vision Model** | **Meta Llama 3.2 11B Vision** via Groq API (`llama-3.2-11b-vision-preview`) |
| **Chat & Narration** | **Meta Llama 3.3 70B** (`llama-3.3-70b-versatile`) on Groq |
| **Speech-to-Text** | **Whisper Large v3** on Groq / Hugging Face |
| **Local Knowledge** | Curated South Asian botanical flora dataset (`plants.json`) |
| **Storage** | Local JSON database (`data/notes.json`) |

---

## 🏆 Meeting the Hackathon Requirements

1. **Open-Weight AI:** Uses Meta Llama 3.2 Vision under the Llama 3.2 Community License, hosted on Groq for sub-second inference. No closed proprietary lock-in.
2. **Encouraging the Outdoors:** Every feature—from Nature Quests to short camera interactions and voice notes—is calibrated to minimize screen time and maximize outdoor engagement.
3. **Safety & Honesty:** Displays explicit uncertainty warnings and reinforces that botanical facts and traditional uses are educational, not medical advice.

---

## 🚀 Getting Started

### 1. Setup Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Groq API key:
```env
GROQ_API_KEY=gsk_your_groq_key_here
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
```
*(You can also set or change this key directly from the in-app ⚙ Settings modal!)*

### 2. Install & Run
```bash
# On Windows PowerShell:
npm.cmd run dev

# Or with bash:
npm run dev
```

Open your browser at `http://localhost:5173` (Vite) and `http://localhost:3001` (Backend).
