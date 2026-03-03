const STORAGE_KEY = "freezer-stock-items-v1";
const URL_KEY = "freezer-stock-app-url-v1";
const ACTIVE_FREEZER_KEY = "freezer-stock-active-tab-v1";
const FREEZERS = ["freezer1", "freezer2"];
const VERSION_ENDPOINT = "version.json";
const VERSION_CHECK_INTERVAL_MS = 60000;
const BASE_SUGGESTIONS = [
  "Courgette farcies",
  "Gateau de courgettes",
  "Galettes des rois",
  "Fumet de legumes",
  "Fumet langoustine",
  "Fumet poisson",
  "Sauce poisson",
  "Poulpe",
  "Petits filets de sole",
  "Poulet entier",
  "Coustilles",
  "Boeuf bourguignon",
  "Steak hache",
  "Cote de porc",
  "Talon de jambon",
  "Saucisse de Montbeliard",
  "Viande bovine",
  "Jambon",
  "Maquereau",
  "Truite",
  "Saumon",
  "Pave de saumon",
  "Crevettes",
  "Lieu noir",
  "Saumon fume",
  "Blanc de poulet",
  "Saucisses de Toulouse",
  "Saucisses de Morteaux",
  "Saucisses grillades",
  "Courgettes",
  "Butternut",
  "Gratin de pates",
  "Quiches",
  "Beurre",
  "Haricots verts",
  "Petits pois",
  "Frites",
  "Pizza",
  "Soupe",
  "Pain",
  "Glace",
  "Saint Nectaire",
  "Epoisses",
  "Emmental",
  "Framboises",
  "Mures",
  "Fraises",
  "Lardons",
];

const form = document.getElementById("product-form");
const nameInput = document.getElementById("product-name");
const suggestionsEl = document.getElementById("product-suggestions");
const qtyInput = document.getElementById("product-qty");
const tabButtons = document.querySelectorAll(".tab-btn");
const freezerPanels = document.querySelectorAll(".freezer-panel");
const clearButtons = document.querySelectorAll(".clear-freezer");
const appUrlInput = document.getElementById("app-url");
const generateQrBtn = document.getElementById("generate-qr");
const qrImage = document.getElementById("qr-image");

const listByFreezer = {
  freezer1: document.getElementById("product-list-freezer1"),
  freezer2: document.getElementById("product-list-freezer2"),
};

const emptyStateByFreezer = {
  freezer1: document.getElementById("empty-state-freezer1"),
  freezer2: document.getElementById("empty-state-freezer2"),
};

let freezerItems = loadItems();
let activeFreezer = loadActiveFreezer();

function loadItems() {
  const empty = { freezer1: [], freezer2: [] };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return { freezer1: sanitizeItems(parsed), freezer2: [] };
    }

    if (!parsed || typeof parsed !== "object") return empty;

    return {
      freezer1: sanitizeItems(parsed.freezer1),
      freezer2: sanitizeItems(parsed.freezer2),
    };
  } catch {
    return empty;
  }
}

function loadActiveFreezer() {
  const saved = localStorage.getItem(ACTIVE_FREEZER_KEY);
  return FREEZERS.includes(saved) ? saved : "freezer1";
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.name === "string" && Number(item.qty) >= 1)
    .map((item) => ({ name: item.name, qty: Number(item.qty) }));
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(freezerItems));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function collectSuggestions() {
  const known = new Map();

  BASE_SUGGESTIONS.forEach((name) => {
    const key = normalizeText(name);
    if (key) known.set(key, name);
  });

  FREEZERS.forEach((freezerId) => {
    freezerItems[freezerId].forEach((item) => {
      const label = item.name.trim();
      const key = normalizeText(label);
      if (key && !known.has(key)) {
        known.set(key, label);
      }
    });
  });

  return [...known.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

function hideSuggestions() {
  suggestionsEl.hidden = true;
  suggestionsEl.innerHTML = "";
}

function renderSuggestions(filterText = "") {
  if (!suggestionsEl) return;

  const filter = normalizeText(filterText);
  const options = collectSuggestions()
    .filter((name) => normalizeText(name).includes(filter))
    .slice(0, 10);

  if (options.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsEl.innerHTML = options
    .map((name) => `<li><button class="suggestion-btn" type="button" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button></li>`)
    .join("");
  suggestionsEl.hidden = false;
}

function renderFreezer(freezerId) {
  const listEl = listByFreezer[freezerId];
  const emptyStateEl = emptyStateByFreezer[freezerId];
  const items = freezerItems[freezerId];

  if (!listEl || !emptyStateEl) return;

  if (items.length === 0) {
    listEl.innerHTML = "";
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";
  listEl.innerHTML = items
    .map(
      (item, index) => `
      <li class="product-item">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <div class="item-controls">
          <button class="ctrl-btn" data-action="decrease" data-freezer="${freezerId}" data-index="${index}" type="button">-</button>
          <span class="qty">${item.qty}</span>
          <button class="ctrl-btn" data-action="increase" data-freezer="${freezerId}" data-index="${index}" type="button">+</button>
          <button class="ctrl-btn remove-btn" data-action="remove" data-freezer="${freezerId}" data-index="${index}" type="button">X</button>
        </div>
      </li>
    `
    )
    .join("");
}

function renderAll() {
  FREEZERS.forEach(renderFreezer);
}

function setActiveFreezer(freezerId) {
  if (!FREEZERS.includes(freezerId)) return;

  activeFreezer = freezerId;
  localStorage.setItem(ACTIVE_FREEZER_KEY, freezerId);

  tabButtons.forEach((button) => {
    const isActive = button.dataset.freezer === freezerId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  freezerPanels.forEach((panel) => {
    panel.hidden = panel.dataset.freezer !== freezerId;
  });
}

function updateItem(freezerId, action, index) {
  const items = freezerItems[freezerId];
  if (!items) return;

  const item = items[index];
  if (!item) return;

  if (action === "increase") {
    item.qty += 1;
  }

  if (action === "decrease") {
    item.qty = Math.max(1, item.qty - 1);
  }

  if (action === "remove") {
    items.splice(index, 1);
  }

  saveItems();
  renderFreezer(freezerId);
  renderSuggestions(nameInput.value);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const freezerId = activeFreezer;
  const name = nameInput.value.trim();
  const qty = Number(qtyInput.value);

  if (!FREEZERS.includes(freezerId)) return;
  if (!name || Number.isNaN(qty) || qty < 1) return;

  const targetItems = freezerItems[freezerId];
  const existing = targetItems.find((item) => item.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    existing.qty += qty;
  } else {
    targetItems.push({ name, qty });
  }

  saveItems();
  renderFreezer(freezerId);
  hideSuggestions();

  nameInput.value = "";
  qtyInput.value = "1";
  nameInput.focus();
});

nameInput.addEventListener("input", () => {
  renderSuggestions(nameInput.value);
});

nameInput.addEventListener("focus", () => {
  renderSuggestions(nameInput.value);
});

nameInput.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 120);
});

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideSuggestions();
  }
});

suggestionsEl.addEventListener("mousedown", (event) => {
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const btn = target.closest(".suggestion-btn");
  if (!(btn instanceof HTMLElement)) return;

  const value = btn.dataset.value;
  if (!value) return;

  nameInput.value = value;
  hideSuggestions();
  nameInput.focus();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const freezerId = button.dataset.freezer;
    setActiveFreezer(freezerId);
  });
});

FREEZERS.forEach((freezerId) => {
  const listEl = listByFreezer[freezerId];
  if (!listEl) return;

  listEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    const index = Number(target.dataset.index);
    const targetFreezer = target.dataset.freezer;

    if (!action || Number.isNaN(index) || !FREEZERS.includes(targetFreezer)) return;
    updateItem(targetFreezer, action, index);
  });
});

clearButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const freezerId = button.dataset.freezer;
    if (!FREEZERS.includes(freezerId)) return;

    freezerItems[freezerId] = [];
    saveItems();
    renderFreezer(freezerId);
    renderSuggestions(nameInput.value);
  });
});

function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return "";

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return `https://${text}`;
}

function setQrCode(url) {
  if (!url) {
    qrImage.style.display = "none";
    qrImage.removeAttribute("src");
    return;
  }

  const encoded = encodeURIComponent(url);
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
  qrImage.style.display = "block";
}

let currentAppVersion = "";

async function fetchRemoteVersion() {
  try {
    const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return "";

    const payload = await response.json();
    if (!payload || typeof payload.version !== "string") return "";

    return payload.version.trim();
  } catch {
    return "";
  }
}

async function checkForUpdates() {
  const remoteVersion = await fetchRemoteVersion();
  if (!remoteVersion) return;

  if (!currentAppVersion) {
    currentAppVersion = remoteVersion;
    return;
  }

  if (remoteVersion !== currentAppVersion) {
    window.location.reload();
  }
}

function startAutoRefreshWatcher() {
  checkForUpdates();
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL_MS);
}

generateQrBtn.addEventListener("click", () => {
  const normalized = normalizeUrl(appUrlInput.value || window.location.href);
  if (!normalized) return;

  localStorage.setItem(URL_KEY, normalized);
  appUrlInput.value = normalized;
  setQrCode(normalized);
});

(function init() {
  const savedUrl = localStorage.getItem(URL_KEY);
  const initialUrl = savedUrl || window.location.href;
  appUrlInput.value = initialUrl;
  setQrCode(initialUrl);
  renderAll();
  renderSuggestions("");
  setActiveFreezer(activeFreezer);
  startAutoRefreshWatcher();
})();
