import "./style.css";

const API = "http://localhost:3001/api";

// App State
let activeTab = "scout"; // "scout" | "quests" | "journal"
let selectedPlant = null;
let currentIdentification = null;
let currentPhotoDataUrl = null;
let activeQuestForScout = null;
let gpsEnabled = true;
let coords = null;
let mediaRecorder = null;
let audioChunks = [];
let journalFilter = "all";
let journalSearchQuery = "";
let serverHealth = { groqConfigured: false, models: {} };

// Nature Quests Definition
const DEFAULT_QUESTS = [
  {
    id: "tri-leaf",
    title: "The Tri-Leaf Hunter",
    difficulty: "Beginner",
    icon: "🍃",
    desc: "Step outdoors and find 3 leaves with distinctly different shapes: serrated (like Neem), heart-shaped (like Peepal), and smooth oval (like Mango or Guava).",
    tasks: [
      { id: "leaf1", label: "Find a serrated or jagged leaf edge (e.g. Neem)" },
      { id: "leaf2", label: "Find a cordate or heart-shaped leaf (e.g. Peepal)" },
      { id: "leaf3", label: "Find a smooth broad oval leaf (e.g. Mango/Guava)" }
    ]
  },
  {
    id: "bloom-pollinator",
    title: "Bloom & Pollinator Watch",
    difficulty: "Easy",
    icon: "🌸",
    desc: "Locate an open outdoor wildflower or garden blossom. Spend 60 quiet seconds observing it to see if any bees, ants, or insects visit its petals.",
    tasks: [
      { id: "bloom1", label: "Find an open flowering plant in natural light" },
      { id: "bloom2", label: "Count its petals or note petal color pattern" },
      { id: "bloom3", label: "Observe for 60 seconds without screen distraction" }
    ]
  },
  {
    id: "ancient-bark",
    title: "Ancient Bark & Canopy Scout",
    difficulty: "Explorer",
    icon: "🌲",
    desc: "Approach a mature tree (like Banyan, Neem, or Ashoka). Touch its bark texture, observe any moss or lichen, and glance upward into its crown.",
    tasks: [
      { id: "bark1", label: "Feel the ridges or texture of the main trunk" },
      { id: "bark2", label: "Spot any lichens, moss, or aerial roots" },
      { id: "bark3", label: "Look up and observe the canopy silhouette" }
    ]
  },
  {
    id: "mindful-walk",
    title: "500-Step Sensory Stroll",
    difficulty: "Wellness",
    icon: "🚶",
    desc: "Put your phone in your pocket, walk 500 steps around your park or neighborhood, and pay attention to earthy scents, rustling wind, and sunlight.",
    tasks: [
      { id: "walk1", label: "Leave indoor screens behind for a 10-minute loop" },
      { id: "walk2", label: "Notice 2 distinct sounds in the outdoor breeze" },
      { id: "walk3", label: "Feel the ground underfoot and breathe fresh air" }
    ]
  },
  {
    id: "herbal-scout",
    title: "Sacred Herb Discovery",
    difficulty: "Intermediate",
    icon: "🌿",
    desc: "Spot an aromatic or traditional medicinal herb growing near homes or open soil, such as Tulsi (Holy Basil), Mint, or Aloe Vera.",
    tasks: [
      { id: "herb1", label: "Locate an aromatic medicinal herb outdoors" },
      { id: "herb2", label: "Gently rub a fallen leaf to notice the natural scent" },
      { id: "herb3", label: "Record its common and scientific identity" }
    ]
  },
  {
    id: "vein-architecture",
    title: "Sunlit Vein Inspector",
    difficulty: "Micro-Discovery",
    icon: "💧",
    desc: "Pick up a freshly fallen green leaf from the ground and hold it up against the sun. Trace the branching network of xylem veins transporting water.",
    tasks: [
      { id: "vein1", label: "Pick up a clean fallen leaf from the ground" },
      { id: "vein2", label: "Hold it against the sunlight to reveal veins" },
      { id: "vein3", label: "Observe whether venation is parallel or netted" }
    ]
  }
];

function loadQuestProgress() {
  try {
    const saved = localStorage.getItem("jadibooti_quests");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveQuestProgress(progress) {
  try {
    localStorage.setItem("jadibooti_quests", JSON.stringify(progress));
  } catch (e) {
    console.warn("Could not save quest progress:", e);
  }
}

let questProgress = loadQuestProgress();

// Render Root Structure
const root = document.querySelector("#root");

function renderApp() {
  root.innerHTML = `
    <header class="app-header">
      <div class="header-container">
        <div class="brand-wrapper">
          <div class="brand-crest" title="Jadi-Booti Botanical Field Notebook">
            <svg class="crest-svg" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="22" r="21" stroke="#2d6a4f" stroke-width="1.2" stroke-opacity="0.35" stroke-dasharray="2 2"/>
              <circle cx="22" cy="22" r="18" fill="#1b4332"/>
              <path d="M22 30C22 30 22 17 22 13M22 13C20.5 16 16.5 17 15 19C13.5 21 15 23.5 18 22.5C20.5 21.5 21.8 17.5 22 13ZM22 13C23.5 16 27.5 17 29 19C30.5 21 29 23.5 26 22.5C23.5 21.5 22.2 17.5 22 13ZM22 22C19.5 23.5 17 25 17 27C17 28.5 18.5 29.5 20.5 28.5C22 27.5 22 24.5 22 22ZM22 22C24.5 23.5 27 25 27 27C27 28.5 25.5 29.5 23.5 28.5C22 27.5 22 24.5 22 22Z" stroke="#e8f3ec" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="brand-text">
            <div class="brand-eyebrow-row">
              <span class="brand-badge-elegant">Botanical Field Memory</span>
              <span class="brand-dot-separator">•</span>
              <span class="brand-devanagari">जड़ी-बूटी</span>
            </div>
            <h1 class="brand-title">Jadi-Booti <span class="brand-title-solo">Solo</span></h1>
          </div>
        </div>

        <div class="header-actions">
          <div id="aiStatusPill" class="status-pill-elegant">
            <span class="status-pulse-dot"></span>
            <span id="aiStatusLabel" class="status-label">Open Vision Active</span>
          </div>

          <button id="settingsBtn" class="header-action-btn" title="Settings & Groq API Key">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="header-gold-line"></div>
    </header>

    <main class="app-main">
      <!-- Hero Banner -->
      <section class="touch-grass-banner">
        <div class="banner-content">
          <div class="banner-tag">🌱 Outdoor Intelligence • Open Weights</div>
          <h2>Explore Nature With Open AI, Not Closed Chatbots.</h2>
          <p>
            Jadi-Booti Solo turns walks into living botanical memories. Use fast Groq-hosted vision to identify plants, take on outdoor quests, record multilingual voice notes, and build your personal nature journal.
          </p>
          <div class="banner-stats">
            <div class="stat-item">
              <span class="stat-num" id="statCompletedQuests">0 / 6</span>
              <span class="stat-label">Outdoor Quests</span>
            </div>
            <div class="stat-item">
              <span class="stat-num" id="statJournalCount">0</span>
              <span class="stat-label">Saved Memories</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">Open Vision</span>
              <span class="stat-label">Groq LPU Engine</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button class="tab-btn ${activeTab === 'scout' ? 'active' : ''}" data-tab="scout">
          🌿 Botanical Scout
        </button>
        <button class="tab-btn ${activeTab === 'quests' ? 'active' : ''}" data-tab="quests">
          🎯 Nature Quests <span class="tab-badge" id="tabQuestBadge">0/6</span>
        </button>
        <button class="tab-btn ${activeTab === 'journal' ? 'active' : ''}" data-tab="journal">
          📖 Field Journal <span class="tab-badge" id="tabJournalBadge">0</span>
        </button>
      </nav>

      <!-- Location Memory Strip -->
      <div class="location-strip">
        <div class="location-info">
          <div class="loc-icon">📍</div>
          <div>
            <strong id="gpsTitleText">Location Memory is Active</strong>
            <span id="gpsSubText">Your field notes and plant photos will be anchored to where you stand.</span>
          </div>
        </div>
        <label class="switch" title="Toggle GPS tracking">
          <input type="checkbox" id="gpsToggleInput" ${gpsEnabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <!-- Tab 1: Botanical Scout -->
      <div id="tabContentScout" class="${activeTab === 'scout' ? '' : 'hidden'}">
        <div class="two-col-grid">
          <!-- Step 1: Capture Plant -->
          <section class="nature-card">
            <div class="card-header">
              <span class="step-tag">Step 01 • Open Vision</span>
              <span id="activeQuestTag" class="status-pill hidden">🎯 Quest Attached</span>
            </div>
            <h3 class="card-title">Identify Plant or Tree</h3>
            <p class="card-subtitle">Take a live photo outdoors or upload a leaf/flower from your walk.</p>

            <div id="photoDropArea" class="photo-capture-box">
              <div class="capture-icon-group">📸 🌿</div>
              <div class="capture-prompt">Capture or Drop Plant Photo</div>
              <div class="capture-sub">Analyzed with Open-Weight Vision on Groq LPU</div>
            </div>

            <div class="button-row">
              <label class="btn-primary" style="flex:1.2;">
                📷 Camera Shutter
                <input id="cameraInput" type="file" accept="image/*" capture="environment" hidden>
              </label>
              <label class="btn-secondary">
                🖼 Upload File
                <input id="uploadInput" type="file" accept="image/*" hidden>
              </label>
            </div>

            <div id="specimenPreviewArea" class="specimen-preview-wrap hidden">
              <img id="specimenImg" src="" alt="Specimen Preview">
              <span class="preview-badge">Field Specimen</span>
              <button id="clearPhotoBtn" class="retake-btn">✕ Retake</button>
            </div>

            <div id="identifyStatusMsg" class="feedback-status"></div>
          </section>

          <!-- Step 2: Voice & Observation Note -->
          <section class="nature-card">
            <div class="card-header">
              <span class="step-tag">Step 02 • Voice & Sense</span>
            </div>
            <h3 class="card-title">Record Personal Note</h3>
            <p class="card-subtitle">Speak freely in Hindi, English, or mixed Hinglish about what you notice.</p>

            <div class="recorder-box">
              <button id="recordToggleBtn" class="record-btn-trigger">
                🎙 Start Voice Note
              </button>
              <span id="recorderTimerText" class="recorder-timer">00:00</span>
            </div>

            <textarea id="noteInputBox" class="note-input-area" placeholder="Describe the aroma, habitat, leaf feel, or how the walk feels today… (Or speak using the microphone above)"></textarea>

            <div class="button-row">
              <button id="saveMemoryDirectBtn" class="btn-primary" style="width:100%;">
                🌱 Save to Field Journal
              </button>
            </div>
            <div id="saveStatusMsg" class="feedback-status"></div>
          </section>
        </div>

        <!-- Plant Identification Specimen Result -->
        <section id="specimenResultPanel" class="specimen-result-panel">
          <div class="specimen-empty">
            <div class="specimen-empty-icon">🌳</div>
            <h3>No Specimen Scanned Yet</h3>
            <p>Take a photo of any leaf, bark, or blossom on your walk to see botanical intelligence and sourced lore.</p>
          </div>
        </section>
      </div>

      <!-- Tab 2: Nature Quests -->
      <div id="tabContentQuests" class="${activeTab === 'quests' ? '' : 'hidden'}">
        <div class="quests-container">
          <div class="quests-header-card">
            <div>
              <span class="brand-badge">Outdoor Missions</span>
              <h2 style="font-family:var(--font-serif); font-size:1.6rem; color:var(--forest-900);">Touch Grass Challenges</h2>
              <p style="color:var(--ink-500); font-size:0.9rem; margin-top:4px;">Put down the screen, step into the greenery, and complete physical field missions.</p>
            </div>
            <div class="quest-rank-badge">
              🏆 <span id="explorerRankTitle">Sprout Scout (0/6)</span>
            </div>
          </div>

          <div class="quest-cards-grid" id="questCardsGrid">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Tab 3: Nature Journal -->
      <div id="tabContentJournal" class="${activeTab === 'journal' ? '' : 'hidden'}">
        <div class="journal-controls">
          <div class="journal-filter-pills">
            <button class="filter-pill ${journalFilter === 'all' ? 'active' : ''}" data-filter="all">All Memories</button>
            <button class="filter-pill ${journalFilter === 'photo' ? 'active' : ''}" data-filter="photo">With Photos 📷</button>
            <button class="filter-pill ${journalFilter === 'quest' ? 'active' : ''}" data-filter="quest">Quest Linked 🎯</button>
          </div>

          <input type="text" id="journalSearchInput" class="search-input" placeholder="🔍 Search plant or notes…" value="${journalSearchQuery}">
        </div>

        <div id="journalEntriesGrid" class="journal-list">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Hackathon Open AI Callout -->
      <div class="open-ai-callout">
        <div class="open-ai-text">
          <h4>💡 Open-Weight AI Architecture • Touch Grass Ethos</h4>
          <p>
            Jadi-Booti Solo runs open-weight Vision models on Groq's ultra-fast LPU inference engine. Open weights ensure transparency, local adaptability, and zero dependency on closed proprietary APIs, ensuring outdoor tools remain accessible to all nature lovers.
          </p>
        </div>
        <button id="viewAiSettingsBtn" class="btn-secondary" style="white-space:nowrap;">
          Inspect Model Config
        </button>
      </div>
    </main>

    <footer class="app-footer">
      🌱 <strong>Jadi-Booti Solo</strong> — The screen is the shortest part of the experience. Built for Touch Grass Hackathon.
    </footer>

    <!-- Settings Modal -->
    <div id="settingsModalOverlay" class="modal-overlay">
      <div class="modal-content">
        <button id="closeSettingsBtn" class="modal-close">✕</button>
        <span class="brand-badge">CONFIGURATION</span>
        <h3 class="modal-title">Engine & Privacy</h3>
        <p class="modal-subtitle">Configure your Groq vision credentials and local memory privacy.</p>

        <div class="settings-field">
          <label for="groqKeyInput">Groq API Key (Open-Weight Vision)</label>
          <input type="password" id="groqKeyInput" class="settings-input" placeholder="gsk_...">
          <p class="settings-help">Get a free key at <a href="https://console.groq.com/keys" target="_blank" style="color:var(--forest-700); text-decoration:underline;">console.groq.com/keys</a>. Persisted to local server .env.</p>
        </div>

        <div class="settings-field">
          <label>Active Vision Model</label>
          <input type="text" id="activeVisionModelDisplay" class="settings-input" value="Open Qwen 3.8 27B Vision (qwen/qwen3.8-27b)" disabled>
        </div>

        <div class="settings-field">
          <label>Active Chat & Narration Model</label>
          <input type="text" id="activeChatModelDisplay" class="settings-input" value="Open Qwen 3.8 27B (qwen/qwen3.8-27b)" disabled>
        </div>

        <div class="settings-field" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>Attach GPS to Field Memories</strong>
            <p class="settings-help">When enabled, notes save latitude & longitude coordinates.</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="modalGpsToggle" ${gpsEnabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div style="margin-top:20px; display:flex; gap:10px;">
          <button id="saveSettingsBtn" class="btn-primary" style="flex:1;">Save Configuration</button>
          <button id="testConnectionBtn" class="btn-secondary">Test Connection</button>
        </div>
        <div id="settingsFeedback" class="feedback-status"></div>
      </div>
    </div>
  `;

  attachEventHandlers();
  updateHealthDisplay();
  renderQuests();
  loadJournalMemories();
}

function attachEventHandlers() {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // Tab switching
  $$(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      $("#tabContentScout").classList.toggle("hidden", activeTab !== "scout");
      $("#tabContentQuests").classList.toggle("hidden", activeTab !== "quests");
      $("#tabContentJournal").classList.toggle("hidden", activeTab !== "journal");

      if (activeTab === "journal") loadJournalMemories();
      if (activeTab === "quests") renderQuests();
    };
  });

  // GPS Toggle
  const handleGpsToggle = (checked) => {
    gpsEnabled = checked;
    $("#gpsToggleInput").checked = gpsEnabled;
    $("#modalGpsToggle").checked = gpsEnabled;
    $("#gpsTitleText").textContent = gpsEnabled
      ? "Location Memory is Active"
      : "Location Memory is Paused";
    $("#gpsSubText").textContent = gpsEnabled
      ? "Your field notes and plant photos will be anchored to where you stand."
      : "New notes and photos will be stored without geographic coordinates.";

    if (gpsEnabled && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => (coords = { latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {}
      );
    }
  };

  $("#gpsToggleInput").onchange = (e) => handleGpsToggle(e.target.checked);
  $("#modalGpsToggle").onchange = (e) => handleGpsToggle(e.target.checked);

  // File Inputs
  $("#cameraInput").onchange = (e) => handleImageSelect(e.target.files[0]);
  $("#uploadInput").onchange = (e) => handleImageSelect(e.target.files[0]);
  $("#clearPhotoBtn").onclick = clearPhotoPreview;

  // Drag & drop on drop area
  const dropBox = $("#photoDropArea");
  dropBox.onclick = () => $("#uploadInput").click();
  dropBox.ondragover = (e) => {
    e.preventDefault();
    dropBox.style.borderColor = "var(--forest-600)";
  };
  dropBox.ondragleave = () => {
    dropBox.style.borderColor = "var(--line-subtle)";
  };
  dropBox.ondrop = (e) => {
    e.preventDefault();
    dropBox.style.borderColor = "var(--line-subtle)";
    if (e.dataTransfer.files?.[0]) handleImageSelect(e.dataTransfer.files[0]);
  };

  // Voice Recording
  $("#recordToggleBtn").onclick = toggleVoiceRecording;

  // Save to journal
  $("#saveMemoryDirectBtn").onclick = saveCurrentMemory;

  // Settings Modal
  $("#settingsBtn").onclick = () => openSettingsModal();
  $("#viewAiSettingsBtn").onclick = () => openSettingsModal();
  $("#closeSettingsBtn").onclick = () => closeSettingsModal();
  $("#settingsModalOverlay").onclick = (e) => {
    if (e.target.id === "settingsModalOverlay") closeSettingsModal();
  };
  $("#saveSettingsBtn").onclick = saveSettingsConfig;
  $("#testConnectionBtn").onclick = testEngineConnection;

  // Journal Filters
  $$(".filter-pill").forEach((pill) => {
    pill.onclick = () => {
      journalFilter = pill.dataset.filter;
      $$(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      loadJournalMemories();
    };
  });

  $("#journalSearchInput").oninput = (e) => {
    journalSearchQuery = e.target.value.toLowerCase().trim();
    loadJournalMemories();
  };
}

// Image Selection and AI Identification
async function handleImageSelect(file) {
  if (!file) return;

  const preview = document.querySelector("#specimenPreviewArea");
  const img = document.querySelector("#specimenImg");
  const status = document.querySelector("#identifyStatusMsg");

  // Read data URL for preview and journal persistence
  const reader = new FileReader();
  reader.onload = (e) => {
    currentPhotoDataUrl = e.target.result;
    img.src = currentPhotoDataUrl;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);

  status.innerHTML = `🌿 <em>Analyzing botanical specimen with Open Vision on Groq…</em>`;

  const formData = new FormData();
  formData.append("image", file);

  try {
    const res = await fetch(`${API}/identify`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Identification failed");

    currentIdentification = data.identification;
    selectedPlant = data.knowledge;

    status.innerHTML = `✓ Identified via <strong>${data.provider || "Groq Vision"}</strong>`;
    renderSpecimenCard(data);
  } catch (err) {
    status.innerHTML = `⚠️ Identification error: ${escapeHTML(err.message)}`;
  }
}

function clearPhotoPreview() {
  currentPhotoDataUrl = null;
  currentIdentification = null;
  selectedPlant = null;
  document.querySelector("#specimenPreviewArea").classList.add("hidden");
  document.querySelector("#specimenImg").src = "";
  document.querySelector("#identifyStatusMsg").textContent = "";
  document.querySelector("#cameraInput").value = "";
  document.querySelector("#uploadInput").value = "";
  document.querySelector("#specimenResultPanel").innerHTML = `
    <div class="specimen-empty">
      <div class="specimen-empty-icon">🌳</div>
      <h3>No Specimen Scanned Yet</h3>
      <p>Take a photo of any leaf, bark, or blossom on your walk to see botanical intelligence and sourced lore.</p>
    </div>
  `;
}

function renderSpecimenCard(data) {
  const panel = document.querySelector("#specimenResultPanel");
  const id = data.identification || {};
  const plant = data.knowledge;

  const common = id.commonName || (plant ? plant.commonName : "Unknown Species");
  const scientific = id.scientificName || (plant ? plant.scientificName : "Botanical specimen");
  const confidence = Math.round((id.confidence || 0.85) * 100);
  const hindiName = plant?.hindiNames?.[0] ? ` • ${plant.hindiNames[0]}` : "";
  const characteristics = id.characteristics || plant?.summary || "Observed during outdoor field walk.";
  const potentialUses = id.potentialUses || plant?.traditionalNote || "Educational botanical observation.";
  const warning = id.warning || "Identification may be uncertain. Do not ingest or use without botanical expertise.";
  const alternatives = id.alternatives?.length ? id.alternatives.join(", ") : "None noted";

  panel.innerHTML = `
    <div class="specimen-card-inner">
      <div class="specimen-top">
        <div class="botanical-identity">
          <span class="step-tag" style="background:var(--moss-100); color:var(--forest-800);">Identified Specimen</span>
          <h3>${escapeHTML(common)}${escapeHTML(hindiName)}</h3>
          <span class="scientific-name">${escapeHTML(scientific)}</span>
        </div>

        <div class="specimen-meta-pills">
          <span class="meta-pill confidence">${confidence}% Confidence</span>
          <span class="meta-pill">🌿 Open Weights</span>
          ${plant ? '<span class="meta-pill" style="background:#dcfce7; color:#166534;">📚 Verified In Flora Catalog</span>' : ''}
        </div>
      </div>

      <div class="specimen-details-grid">
        <div class="detail-block">
          <h4>🍃 Botanical Characteristics</h4>
          <p>${escapeHTML(characteristics)}</p>
        </div>

        <div class="detail-block">
          <h4>🏺 Traditional & Ecological Context</h4>
          <p>${escapeHTML(potentialUses)}</p>
        </div>
      </div>

      <div class="uncertainty-banner">
        <span class="warning-icon">⚠️</span>
        <p><strong>Field Uncertainty Notice:</strong> ${escapeHTML(warning)} (Alternatives considered: <em>${escapeHTML(alternatives)}</em>)</p>
      </div>

      <!-- Sourced lore and narration button -->
      <div class="audio-story-box">
        <div class="story-header">
          <h4>🎧 Field Narration</h4>
          <button id="triggerNarrateBtn" class="btn-primary" style="background:#2d6a4f; padding:8px 14px; font-size:0.82rem;">
            🔊 Tell Me The Story
          </button>
        </div>
        <div id="narrationTextContent" class="story-text">
          Click above to generate an outdoor oral narration of this plant's lore and place context.
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button id="saveSpecimenToJournalBtn" class="btn-primary">
          📖 Add This Discovery To My Nature Journal
        </button>
      </div>
    </div>
  `;

  document.querySelector("#triggerNarrateBtn").onclick = () => generateNarration(common, scientific, characteristics, potentialUses);
  document.querySelector("#saveSpecimenToJournalBtn").onclick = saveCurrentMemory;
}

// Audio Narration with Speech Synthesis
async function generateNarration(common, scientific, characteristics, potentialUses) {
  const storyBox = document.querySelector("#narrationTextContent");
  storyBox.textContent = "Listening to the land… Drafting botanical narration…";

  try {
    const res = await fetch(`${API}/narrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plant: selectedPlant || {
          commonName: common,
          scientificName: scientific,
          summary: characteristics,
          traditionalNote: potentialUses
        }
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    storyBox.textContent = `"${data.narration}"`;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(data.narration);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = /[\u0900-\u097F]/.test(data.narration) ? "hi-IN" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    storyBox.textContent = `Narration note: You are observing ${common} (${scientific}). Take a breath, feel the sun on its leaves, and note the beauty of nature.`;
  }
}

// Voice Note Recording
let timerInterval = null;
let recordingStartTime = 0;

async function toggleVoiceRecording() {
  const btn = document.querySelector("#recordToggleBtn");
  const timer = document.querySelector("#recorderTimerText");
  const status = document.querySelector("#saveStatusMsg");

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btn.classList.remove("recording");
    btn.innerHTML = "🎙 Start Voice Note";
    clearInterval(timerInterval);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      status.innerHTML = `🎧 <em>Transcribing with Whisper…</em>`;

      const formData = new FormData();
      formData.append("audio", audioBlob, "field-note.webm");

      try {
        const res = await fetch(`${API}/transcribe`, {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const currentVal = document.querySelector("#noteInputBox").value;
        document.querySelector("#noteInputBox").value = currentVal
          ? `${currentVal} ${data.text}`
          : data.text;
        status.innerHTML = `✓ Transcribed voice note. Edit or save below.`;
      } catch (err) {
        status.innerHTML = `Transcription fallback: Audio captured. Type notes if offline.`;
      }
    };

    mediaRecorder.start();
    btn.classList.add("recording");
    btn.innerHTML = "⏹ Stop Recording";
    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      timer.textContent = `${m}:${s}`;
    }, 250);
  } catch (err) {
    status.innerHTML = `⚠️ Microphone permission needed for voice notes.`;
  }
}

// GPS Retrieval
async function getGPSCoordinates() {
  if (!gpsEnabled || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  });
}

// Save Current Memory / Discovery
async function saveCurrentMemory() {
  const noteBox = document.querySelector("#noteInputBox");
  const status = document.querySelector("#saveStatusMsg");
  const noteText = noteBox.value.trim();

  const plantName = currentIdentification?.commonName || selectedPlant?.commonName || (noteText ? "Field Observation" : null);
  const scientificName = currentIdentification?.scientificName || selectedPlant?.scientificName || null;
  const characteristics = currentIdentification?.characteristics || selectedPlant?.summary || null;
  const potentialUses = currentIdentification?.potentialUses || selectedPlant?.traditionalNote || null;

  if (!noteText && !plantName && !currentPhotoDataUrl) {
    status.innerHTML = `⚠️ Please take a photo, record a voice note, or write an observation first.`;
    return;
  }

  status.innerHTML = `Saving nature memory…`;
  const location = await getGPSCoordinates();

  const payload = {
    plantId: selectedPlant?.id || null,
    plantName: plantName || "Nature Walk Memory",
    scientificName,
    characteristics,
    potentialUses,
    photo: currentPhotoDataUrl,
    questId: activeQuestForScout?.id || null,
    questTitle: activeQuestForScout?.title || null,
    text: noteText,
    language: /[\u0900-\u097F]/.test(noteText) ? "Hindi" : "English",
    gpsEnabled,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    createdAt: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    status.innerHTML = `✓ Memory preserved in your Field Journal! 🌱`;
    noteBox.value = "";
    document.querySelector("#recorderTimerText").textContent = "00:00";

    // Mark attached quest task if applicable
    if (activeQuestForScout) {
      markQuestCompleted(activeQuestForScout.id);
      activeQuestForScout = null;
      document.querySelector("#activeQuestTag").classList.add("hidden");
    }

    loadJournalMemories();
    updateStats();
  } catch (err) {
    status.innerHTML = `Save error: ${escapeHTML(err.message)}`;
  }
}

// Nature Quests Logic
function renderQuests() {
  const container = document.querySelector("#questCardsGrid");
  if (!container) return;

  const totalQuests = DEFAULT_QUESTS.length;
  let completedCount = 0;

  container.innerHTML = DEFAULT_QUESTS.map((q) => {
    const qState = questProgress[q.id] || { tasks: {}, completed: false };
    const isCompleted = qState.completed;
    if (isCompleted) completedCount++;

    return `
      <div class="quest-card ${isCompleted ? 'completed' : ''}" data-quest-id="${q.id}">
        <div>
          <div class="quest-top">
            <div class="quest-icon">${q.icon}</div>
            <span class="quest-difficulty">${q.difficulty}</span>
          </div>
          <h4 class="quest-title">${escapeHTML(q.title)}</h4>
          <p class="quest-desc">${escapeHTML(q.desc)}</p>

          <div class="quest-tasks">
            ${q.tasks.map((t) => {
              const checked = qState.tasks?.[t.id] ? "checked" : "";
              return `
                <label class="quest-task-item">
                  <input type="checkbox" class="quest-check-input" data-quest="${q.id}" data-task="${t.id}" ${checked}>
                  <span>${escapeHTML(t.label)}</span>
                </label>
              `;
            }).join("")}
          </div>
        </div>

        <div class="quest-action-row">
          <button class="btn-primary attach-quest-btn" data-quest-id="${q.id}" style="padding:8px 12px; font-size:0.8rem;">
            📸 Scout for this Quest
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Update Rank
  const rankEl = document.querySelector("#explorerRankTitle");
  if (rankEl) {
    let rank = "Sprout Scout";
    if (completedCount >= 5) rank = "Master Naturalist 🌲";
    else if (completedCount >= 3) rank = "Wild Wanderer 🍃";
    else if (completedCount >= 1) rank = "Branch Scout 🌱";
    rankEl.textContent = `${rank} (${completedCount}/${totalQuests})`;
  }

  // Update banner stats
  const statQuestEl = document.querySelector("#statCompletedQuests");
  if (statQuestEl) statQuestEl.textContent = `${completedCount} / ${totalQuests}`;

  const tabBadgeEl = document.querySelector("#tabQuestBadge");
  if (tabBadgeEl) tabBadgeEl.textContent = `${completedCount}/${totalQuests}`;

  // Attach Checkbox Handlers
  container.querySelectorAll(".quest-check-input").forEach((box) => {
    box.onchange = (e) => {
      const qId = e.target.dataset.quest;
      const tId = e.target.dataset.task;

      if (!questProgress[qId]) questProgress[qId] = { tasks: {}, completed: false };
      questProgress[qId].tasks[tId] = e.target.checked;

      // Check if all tasks for this quest are completed
      const questDef = DEFAULT_QUESTS.find((x) => x.id === qId);
      const allDone = questDef.tasks.every((t) => questProgress[qId].tasks[t.id]);
      questProgress[qId].completed = allDone;

      saveQuestProgress(questProgress);
      renderQuests();
    };
  });

  // Attach "Scout for this Quest" Buttons
  container.querySelectorAll(".attach-quest-btn").forEach((btn) => {
    btn.onclick = () => {
      const qId = btn.dataset.questId;
      const quest = DEFAULT_QUESTS.find((x) => x.id === qId);
      activeQuestForScout = quest;

      // Switch to scout tab
      document.querySelector('.tab-btn[data-tab="scout"]').click();

      // Show tag
      const tag = document.querySelector("#activeQuestTag");
      tag.textContent = `🎯 Mission: ${quest.title}`;
      tag.classList.remove("hidden");

      // Scroll to top
      window.scrollTo({ top: 300, behavior: "smooth" });
    };
  });
}

function markQuestCompleted(questId) {
  if (!questProgress[questId]) questProgress[questId] = { tasks: {}, completed: false };
  const questDef = DEFAULT_QUESTS.find((x) => x.id === questId);
  if (questDef) {
    questDef.tasks.forEach((t) => {
      questProgress[questId].tasks[t.id] = true;
    });
    questProgress[questId].completed = true;
    saveQuestProgress(questProgress);
  }
}

// Journal Memories Loading & Rendering
async function loadJournalMemories() {
  const listEl = document.querySelector("#journalEntriesGrid");
  if (!listEl) return;

  try {
    const res = await fetch(`${API}/notes`);
    const notes = await res.json();

    const statCountEl = document.querySelector("#statJournalCount");
    if (statCountEl) statCountEl.textContent = notes.length;

    const tabCountEl = document.querySelector("#tabJournalBadge");
    if (tabCountEl) tabCountEl.textContent = notes.length;

    // Apply Filter
    let filtered = notes;
    if (journalFilter === "photo") {
      filtered = filtered.filter((n) => Boolean(n.photo));
    } else if (journalFilter === "quest") {
      filtered = filtered.filter((n) => Boolean(n.questId));
    }

    // Apply Search
    if (journalSearchQuery) {
      filtered = filtered.filter((n) =>
        (n.plantName || "").toLowerCase().includes(journalSearchQuery) ||
        (n.scientificName || "").toLowerCase().includes(journalSearchQuery) ||
        (n.text || "").toLowerCase().includes(journalSearchQuery)
      );
    }

    if (!filtered.length) {
      listEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:50px 20px; color:var(--ink-500);">
          <div style="font-size:42px; margin-bottom:10px;">🍃</div>
          <h3>No nature entries found</h3>
          <p>Go outdoors, take a plant photo, or record a voice note to start your personal nature journal.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map((n) => {
      const dateStr = new Date(n.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const gpsBadge = n.gpsEnabled && n.latitude
        ? `📍 ${n.latitude.toFixed(4)}, ${n.longitude.toFixed(4)}`
        : "📍 Nature Walk";

      return `
        <article class="journal-entry-card">
          ${
            n.photo
              ? `<div class="journal-thumb-wrap"><img src="${n.photo}" alt="${escapeHTML(n.plantName)}"></div>`
              : `<div class="journal-no-thumb">🌱</div>`
          }

          <div class="journal-entry-body">
            <div class="entry-header">
              <h4 class="entry-title">${escapeHTML(n.plantName || "Observation")}</h4>
              <button class="delete-memory-btn btn-danger" data-id="${n.id}" title="Delete memory">✕</button>
            </div>

            ${n.scientificName ? `<span class="entry-scientific">${escapeHTML(n.scientificName)}</span>` : ""}

            ${n.questTitle ? `<div style="margin-bottom:8px;"><span class="meta-pill" style="background:var(--earth-100); color:var(--earth-600); font-size:0.75rem;">🎯 ${escapeHTML(n.questTitle)}</span></div>` : ""}

            <p class="entry-note-text">${escapeHTML(n.text || n.characteristics || "Nature discovery captured.")}</p>

            <div class="entry-meta">
              <span>${gpsBadge} · ${dateStr}</span>
              <div class="entry-actions">
                <button class="speak-entry-btn icon-btn" style="width:30px; height:30px; font-size:14px;" data-text="${escapeHTML(n.text || n.plantName)}" title="Read aloud">🔊</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Attach Delete Handlers
    listEl.querySelectorAll(".delete-memory-btn").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Remove this discovery from your nature journal?")) return;
        await fetch(`${API}/notes/${btn.dataset.id}`, { method: "DELETE" });
        loadJournalMemories();
      };
    });

    // Attach Speak Handlers
    listEl.querySelectorAll(".speak-entry-btn").forEach((btn) => {
      btn.onclick = () => {
        const text = btn.dataset.text;
        if (text && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(u);
        }
      };
    });
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--ink-500);">Could not load memories.</p>`;
  }
}

// Health Check & Model Info
async function updateHealthDisplay() {
  const pill = document.querySelector("#aiStatusPill");
  const label = document.querySelector("#aiStatusLabel");

  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    serverHealth = data;

    if (data.groqConfigured) {
      pill.className = "status-pill-elegant";
      label.textContent = `Open Vision · ${data.models.vision || "Qwen 3.8 27B"}`;
    } else if (data.hfConfigured) {
      pill.className = "status-pill-elegant";
      label.textContent = `Hugging Face Active`;
    } else {
      pill.className = "status-pill-elegant warning";
      label.textContent = `Add Groq Key in ⚙`;
    }
  } catch {
    pill.className = "status-pill-elegant warning";
    label.textContent = `Local Offline Mode`;
  }
}

// Settings Modal Management
function openSettingsModal() {
  document.querySelector("#settingsModalOverlay").classList.add("active");
  document.querySelector("#settingsFeedback").textContent = "";
}

function closeSettingsModal() {
  document.querySelector("#settingsModalOverlay").classList.remove("active");
}

async function saveSettingsConfig() {
  const keyInput = document.querySelector("#groqKeyInput");
  const feedback = document.querySelector("#settingsFeedback");
  const keyVal = keyInput.value.trim();

  if (!keyVal) {
    feedback.innerHTML = `Please enter a valid Groq API key starting with <code>gsk_</code>`;
    return;
  }

  feedback.textContent = "Updating server configuration…";

  try {
    const res = await fetch(`${API}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groqApiKey: keyVal })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    feedback.innerHTML = `✓ Groq API Key saved successfully! Live open vision is ready.`;
    keyInput.value = "";
    updateHealthDisplay();
  } catch (err) {
    feedback.innerHTML = `Error saving key: ${escapeHTML(err.message)}`;
  }
}

async function testEngineConnection() {
  const feedback = document.querySelector("#settingsFeedback");
  feedback.textContent = "Testing server health and model access…";

  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    feedback.innerHTML = `✓ Connected! Provider: <strong>${data.activeProvider}</strong> (Catalog: ${data.plantCatalogCount} flora species)`;
    updateHealthDisplay();
  } catch (err) {
    feedback.innerHTML = `Server offline or not responding.`;
  }
}

function updateStats() {
  loadJournalMemories();
  renderQuests();
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

// Initial Boot
renderApp();
