const STORAGE_KEY = "freezer-stock-items-v1";
const URL_KEY = "freezer-stock-app-url-v1";
const ACTIVE_FREEZER_KEY = "freezer-stock-active-tab-v1";
const ACTIVE_CATEGORY_KEY = "freezer-stock-active-category-v1";
const FREEZER_LABELS_KEY = "freezer-stock-labels-v1";
const VERSION_ENDPOINT = "version.json";
const VERSION_CHECK_INTERVAL_MS = 60000;
const FREEZER_LONG_PRESS_MS = 550;

const DEFAULT_FREEZERS = [
  { id: "freezer1", label: "Cuisine" },
  { id: "freezer2", label: "Celier" },
];

// Remplace ces valeurs par la config Firebase de ton projet.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyALmqd64Wk8ezUYVeZBJ8ztOB6kn2cuClU",
  authDomain: "stock-congelateur-e7de1.firebaseapp.com",
  projectId: "stock-congelateur-e7de1",
  storageBucket: "stock-congelateur-e7de1.firebasestorage.app",
  messagingSenderId: "983458233014",
  appId: "1:983458233014:web:0aa38741444a5ac0aac417",
};
const FIRESTORE_COLLECTION = "sharedStocks";
const FIRESTORE_DOC_ID = "foyer-principal";

const CATEGORIES = [
  { id: "all", label: "Tout" },
  { id: "viande", label: "Viandes" },
  { id: "poisson", label: "Poissons" },
  { id: "legume", label: "Legumes" },
  { id: "plat", label: "Plats cuisines" },
  { id: "produit_laitier", label: "Laitiers" },
  { id: "fruit", label: "Fruits" },
  { id: "glace", label: "Glaces" },
  { id: "autre", label: "Autres" },
];
const EDITABLE_CATEGORIES = CATEGORIES.filter((category) => category.id !== "all");

const CATEGORY_RULES = {
  viande: ["boeuf", "steak", "porc", "jambon", "saucisse", "poulet", "viande", "lardon", "cote"],
  poisson: ["poisson", "saumon", "truite", "maquereau", "crevette", "sole", "poulpe", "lieu", "bar"],
  legume: ["courgette", "haricot", "pois", "butternut", "legume"],
  plat: ["gratin", "quiche", "pizza", "soupe", "galette", "sauce"],
  produit_laitier: ["beurre", "emmental", "epoisse", "saint nectaire", "fromage"],
  fruit: ["fraise", "framboise", "mure", "kiwi"],
  glace: ["glace"],
};

const BASE_SUGGESTIONS = [
  "Poulet entier",
  "Boeuf bourguignon",
  "Steak hache",
  "Cote de porc",
  "Jambon",
  "Saumon",
  "Truite",
  "Crevettes",
  "Haricots verts",
  "Petits pois",
  "Butternut",
  "Quiches",
  "Pizza",
  "Soupe",
  "Beurre",
  "Emmental",
  "Fraises",
  "Framboises",
  "Lardons",
];

const form = document.getElementById("product-form");
const nameInput = document.getElementById("product-name");
const suggestionsEl = document.getElementById("product-suggestions");
const qtyInput = document.getElementById("product-qty");
const categoryInput = document.getElementById("product-category");
const freezerTabsEl = document.getElementById("freezer-tabs");
const freezerPanelsEl = document.getElementById("freezer-panels");
const appUrlInput = document.getElementById("app-url");
const generateQrBtn = document.getElementById("generate-qr");
const qrImage = document.getElementById("qr-image");
const syncStatusEl = document.getElementById("sync-status");
const versionBadgeEl = document.getElementById("app-version-badge");

let freezerItems = loadItemsLocal();
let freezerLabels = loadFreezerLabelsLocal();
ensureFreezerData();
let activeFreezer = loadActiveFreezer();
let activeCategoryByFreezer = loadActiveCategories();
let stockDocRef = null;
let storageMode = "local";
let currentAppVersion = "";
let freezerActionTarget = "";
let freezerLongPressTimer = null;
let freezerLongPressTriggered = false;

function setSyncStatus(text) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = text;
}

function setVersionBadge(text, state = "") {
  if (!(versionBadgeEl instanceof HTMLElement)) return;
  versionBadgeEl.textContent = text;
  versionBadgeEl.classList.remove("is-ok", "is-checking", "is-unknown");
  if (state) {
    versionBadgeEl.classList.add(state);
  }
}

function formatVersionBadge(version) {
  const value = typeof version === "string" ? version.trim() : String(version || "").trim();
  return `v ${value || "0"}`;
}

function triggerHapticFeedback() {
  if (!("vibrate" in navigator) || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(18);
}

function hasFirebaseConfig() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

function normalizeText(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidCategory(categoryId) {
  return CATEGORIES.some((category) => category.id === categoryId);
}

function isValidItemCategory(categoryId) {
  return categoryId === "auto" || EDITABLE_CATEGORIES.some((category) => category.id === categoryId);
}

function isFreezerId(freezerId) {
  return /^freezer\d+$/.test(freezerId);
}

function getFreezerNumber(freezerId) {
  const match = freezerId.match(/^freezer(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function sortFreezerIds(ids) {
  return [...ids].filter(isFreezerId).sort((a, b) => getFreezerNumber(a) - getFreezerNumber(b));
}

function getDefaultFreezerLabel(freezerId) {
  const preset = DEFAULT_FREEZERS.find((freezer) => freezer.id === freezerId);
  if (preset) return preset.label;
  const freezerNumber = getFreezerNumber(freezerId) || 1;
  return `Congelateur ${freezerNumber}`;
}

function getFreezerIds() {
  return sortFreezerIds(Object.keys(freezerItems));
}

function isRemovableFreezer(freezerId) {
  return !DEFAULT_FREEZERS.some((freezer) => freezer.id === freezerId);
}

function clearFreezerLongPressTimer() {
  if (freezerLongPressTimer !== null) {
    window.clearTimeout(freezerLongPressTimer);
    freezerLongPressTimer = null;
  }
}

function setFreezerActionTarget(freezerId = "") {
  const nextValue = freezerId && freezerItems[freezerId] ? freezerId : "";
  if (freezerActionTarget === nextValue) return;
  freezerActionTarget = nextValue;
  renderFreezerTabs();
}

function buildDefaultActiveCategories(ids) {
  const targetIds = Array.isArray(ids) ? ids : getFreezerIds();
  return targetIds.reduce((acc, freezerId) => {
    acc[freezerId] = "all";
    return acc;
  }, {});
}

function formatCurrentMonthYear() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function isValidMonthYear(value) {
  return typeof value === "string" && /^(0[1-9]|1[0-2])\/\d{4}$/.test(value);
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.name === "string" && Number(item.qty) >= 0)
    .map((item) => ({
      name: item.name,
      qty: Number(item.qty),
      category: isValidItemCategory(item.category) ? item.category : "auto",
      active: item.active === false ? false : Number(item.qty) > 0,
      addedAt: isValidMonthYear(item.addedAt) ? item.addedAt : "",
    }));
}

function sanitizeStockPayload(payload) {
  const defaults = DEFAULT_FREEZERS.reduce((acc, freezer) => {
    acc[freezer.id] = [];
    return acc;
  }, {});

  if (!payload || typeof payload !== "object") {
    return defaults;
  }

  const sanitized = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (isFreezerId(key)) {
      sanitized[key] = sanitizeItems(value);
    }
  });

  if (Object.keys(sanitized).length === 0) {
    return defaults;
  }

  return { ...defaults, ...sanitized };
}

function safeParseJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractStockObject(candidate) {
  if (typeof candidate === "string") {
    const parsed = safeParseJson(candidate);
    return parsed ? extractStockObject(parsed) : sanitizeStockPayload(null);
  }

  if (Array.isArray(candidate)) {
    return sanitizeStockPayload({ freezer1: sanitizeItems(candidate) });
  }

  if (!candidate || typeof candidate !== "object") {
    return sanitizeStockPayload(null);
  }

  if (Object.keys(candidate).some(isFreezerId)) {
    return sanitizeStockPayload(candidate);
  }

  if (candidate.freezer1 || candidate.freezer2 || candidate.freezer_1 || candidate.freezer_2 || candidate.cuisine || candidate.celier || candidate.Cuisine || candidate.Celier) {
    return sanitizeStockPayload({
      freezer1: candidate.freezer1 || candidate.freezer_1 || candidate.cuisine || candidate.Cuisine || [],
      freezer2: candidate.freezer2 || candidate.freezer_2 || candidate.celier || candidate.Celier || [],
    });
  }

  return sanitizeStockPayload(null);
}

function extractCloudPayload(rawData) {
  if (!rawData) return sanitizeStockPayload(null);

  if (typeof rawData === "string") {
    const parsed = safeParseJson(rawData);
    return parsed ? extractCloudPayload(parsed) : sanitizeStockPayload(null);
  }

  if (typeof rawData !== "object") {
    return sanitizeStockPayload(null);
  }

  if (Object.prototype.hasOwnProperty.call(rawData, "freezerItems")) {
    return extractStockObject(rawData.freezerItems);
  }

  return extractStockObject(rawData);
}

function extractCloudLabels(rawData, freezerIds) {
  const labels = {};
  const targetIds = Array.isArray(freezerIds) ? freezerIds : [];
  const rawLabels =
    typeof rawData?.freezerLabels === "string" ? safeParseJson(rawData.freezerLabels) : rawData?.freezerLabels;

  targetIds.forEach((freezerId) => {
    const rawLabel = rawLabels && typeof rawLabels === "object" ? rawLabels[freezerId] : "";
    labels[freezerId] =
      typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : getDefaultFreezerLabel(freezerId);
  });

  return labels;
}

function hasAnyItems(payload) {
  return Object.values(payload || {}).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0) > 0;
}

function loadItemsLocal() {
  const empty = sanitizeStockPayload(null);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return sanitizeStockPayload({ freezer1: sanitizeItems(parsed) });
    }

    return sanitizeStockPayload(parsed);
  } catch {
    return empty;
  }
}

function loadFreezerLabelsLocal() {
  const defaults = DEFAULT_FREEZERS.reduce((acc, freezer) => {
    acc[freezer.id] = freezer.label;
    return acc;
  }, {});

  try {
    const raw = localStorage.getItem(FREEZER_LABELS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;

    const labels = { ...defaults };
    Object.entries(parsed).forEach(([freezerId, label]) => {
      if (!isFreezerId(freezerId) || typeof label !== "string" || !label.trim()) return;
      labels[freezerId] = label.trim();
    });
    return labels;
  } catch {
    return defaults;
  }
}

function saveFreezerLabelsLocal() {
  localStorage.setItem(FREEZER_LABELS_KEY, JSON.stringify(freezerLabels));
}

function ensureFreezerData() {
  const sanitized = {};
  Object.entries(freezerItems).forEach(([freezerId, items]) => {
    if (isFreezerId(freezerId)) {
      sanitized[freezerId] = sanitizeItems(items);
    }
  });

  DEFAULT_FREEZERS.forEach((freezer) => {
    if (!Array.isArray(sanitized[freezer.id])) {
      sanitized[freezer.id] = [];
    }
  });
  freezerItems = sanitized;

  const ids = getFreezerIds();
  const nextLabels = {};
  ids.forEach((freezerId) => {
    const label = freezerLabels?.[freezerId];
    nextLabels[freezerId] = typeof label === "string" && label.trim() ? label.trim() : getDefaultFreezerLabel(freezerId);
  });
  freezerLabels = nextLabels;
}

function saveItemsLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(freezerItems));
  saveFreezerLabelsLocal();
}

async function saveItemsCloud() {
  if (!stockDocRef) return;
  await stockDocRef.set({
    freezerItems,
    freezerLabels,
    updatedAt: Date.now(),
  });
}

async function saveItems() {
  saveItemsLocal();
  if (storageMode !== "cloud") return;

  try {
    await saveItemsCloud();
  } catch {
    setSyncStatus("Mode local (erreur cloud)");
  }
}

async function initCloudSync() {
  if (!window.firebase || !hasFirebaseConfig()) {
    setSyncStatus("Mode local (cloud non configure)");
    return;
  }

  try {
    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(FIREBASE_CONFIG);
    const db = app.firestore();
    stockDocRef = db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);

    stockDocRef.onSnapshot(
      async (snapshot) => {
        if (!snapshot.exists) {
          await saveItemsCloud();
          return;
        }

        const data = snapshot.data();
        const cloudItems = extractCloudPayload(data);
        const cloudIds = sortFreezerIds(Object.keys(cloudItems));
        const cloudLabels = extractCloudLabels(data, cloudIds);

        if (!hasAnyItems(cloudItems) && hasAnyItems(freezerItems)) {
          setSyncStatus("Synchro cloud active (cloud vide ignore)");
          return;
        }

        freezerItems = cloudItems;
        freezerLabels = cloudLabels;
        ensureFreezerData();
        activeCategoryByFreezer = buildDefaultActiveCategories();
        saveActiveCategories();
        saveItemsLocal();
        renderAll();

        const total = Object.values(cloudItems).reduce((sum, items) => sum + (items?.length || 0), 0);
        setSyncStatus(`Synchro cloud active (${total} produits)`);
      },
      () => {
        storageMode = "local";
        setSyncStatus("Mode local (erreur sync)");
      }
    );

    storageMode = "cloud";
  } catch {
    storageMode = "local";
    setSyncStatus("Mode local (erreur initialisation cloud)");
  }
}

function loadActiveFreezer() {
  const freezerIds = getFreezerIds();
  const hashValue = window.location.hash.replace("#", "").trim();
  if (freezerIds.includes(hashValue)) return hashValue;

  const saved = localStorage.getItem(ACTIVE_FREEZER_KEY);
  if (freezerIds.includes(saved)) return saved;
  return freezerIds[0] || DEFAULT_FREEZERS[0].id;
}

function loadActiveCategories() {
  const defaults = buildDefaultActiveCategories();
  try {
    const raw = localStorage.getItem(ACTIVE_CATEGORY_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    return getFreezerIds().reduce((acc, freezerId) => {
      const categoryId = parsed?.[freezerId];
      acc[freezerId] = isValidCategory(categoryId) ? categoryId : "all";
      return acc;
    }, {});
  } catch {
    return defaults;
  }
}

function saveActiveCategories() {
  const payload = getFreezerIds().reduce((acc, freezerId) => {
    acc[freezerId] = isValidCategory(activeCategoryByFreezer[freezerId]) ? activeCategoryByFreezer[freezerId] : "all";
    return acc;
  }, {});
  localStorage.setItem(ACTIVE_CATEGORY_KEY, JSON.stringify(payload));
}

function detectCategory(name) {
  const normalizedName = normalizeText(name);
  for (const [categoryId, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some((keyword) => normalizedName.includes(keyword))) {
      return categoryId;
    }
  }
  return "autre";
}

function getItemCategory(item) {
  return isValidItemCategory(item.category) && item.category !== "auto" ? item.category : detectCategory(item.name);
}

function getCategoryLabel(categoryId) {
  if (categoryId === "auto") return "Auto";
  const found = EDITABLE_CATEGORIES.find((category) => category.id === categoryId);
  return found ? found.label : "Auto";
}

function renderProductCategoryOptions() {
  if (!(categoryInput instanceof HTMLSelectElement)) return;

  const detectedCategoryId = detectCategory(nameInput.value || "");
  const detectedLabel = getCategoryLabel(detectedCategoryId);
  const currentValue = isValidItemCategory(categoryInput.value) ? categoryInput.value : "auto";

  categoryInput.innerHTML = [
    `<option value="auto">Auto (${escapeHtml(detectedLabel)})</option>`,
    ...EDITABLE_CATEGORIES.map((category) => `<option value="${category.id}">${escapeHtml(category.label)}</option>`),
  ].join("");

  categoryInput.value = currentValue;
}

function buildCategoryControlHtml(item, freezerId, index) {
  const current = isValidItemCategory(item.category) ? item.category : "auto";
  const options = [{ id: "auto", label: "Auto" }, ...EDITABLE_CATEGORIES];
  const optionsHtml = options
    .map((option) => {
      const isActive = option.id === current;
      return `<button class="category-option-btn ${isActive ? "is-active" : ""}" data-action="set-category" data-freezer="${freezerId}" data-index="${index}" data-category="${option.id}" type="button">${option.label}</button>`;
    })
    .join("");

  const detected = getCategoryLabel(getItemCategory(item));
  const triggerLabel = current === "auto" ? `Auto (${detected})` : getCategoryLabel(current);

  return `<div class="category-picker"><button class="category-select" data-action="toggle-category-menu" data-freezer="${freezerId}" data-index="${index}" type="button">${triggerLabel}</button><div class="category-menu" data-menu="${freezerId}-${index}" hidden>${optionsHtml}</div></div>`;
}

function closeAllCategoryMenus() {
  document.querySelectorAll(".category-menu").forEach((menu) => {
    menu.hidden = true;
  });
}

function toggleCategoryMenu(freezerId, index) {
  const menu = document.querySelector(`.category-menu[data-menu="${freezerId}-${index}"]`);
  if (!(menu instanceof HTMLElement)) return;
  const shouldOpen = menu.hidden;
  closeAllCategoryMenus();
  menu.hidden = !shouldOpen;
}

function collectSuggestions() {
  const known = new Map();
  BASE_SUGGESTIONS.forEach((name) => {
    const key = normalizeText(name);
    if (key) known.set(key, name);
  });

  getFreezerIds().forEach((freezerId) => {
    (freezerItems[freezerId] || []).forEach((item) => {
      const key = normalizeText(item.name);
      if (key && !known.has(key)) {
        known.set(key, item.name);
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
  const filter = normalizeText(filterText);
  const allSuggestions = collectSuggestions();
  const options =
    filter.length < 1
      ? allSuggestions.slice(0, 8)
      : allSuggestions.filter((name) => normalizeText(name).includes(filter)).slice(0, 10);

  if (options.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsEl.innerHTML = options
    .map((name) => `<li><button class="suggestion-btn" type="button" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button></li>`)
    .join("");
  suggestionsEl.hidden = false;
}

function getFreezerLabel(freezerId) {
  return freezerLabels[freezerId] || getDefaultFreezerLabel(freezerId);
}

function ensureFreezerPanel(freezerId) {
  const existing = freezerPanelsEl.querySelector(`.freezer-panel[data-freezer="${freezerId}"]`);
  if (existing) return existing;

  const article = document.createElement("article");
  article.className = "freezer-panel";
  article.dataset.freezer = freezerId;
  article.hidden = true;
  article.innerHTML = `
    <div class="list-header">
      <h3>${escapeHtml(getFreezerLabel(freezerId))}</h3>
    </div>
    <div class="category-tabs" data-category-tabs="${freezerId}" role="tablist" aria-label="Categories ${escapeHtml(getFreezerLabel(freezerId))}"></div>
    <ul class="product-list" data-product-list="${freezerId}"></ul>
    <p class="empty-state" data-empty-state="${freezerId}">Aucun produit dans ce congelateur.</p>
  `;
  freezerPanelsEl.appendChild(article);
  return article;
}

function renderFreezerTabs() {
  const freezerTabs = getFreezerIds()
    .map((freezerId) => {
      const isActive = freezerId === activeFreezer;
      const showActions = freezerId === freezerActionTarget;
      const showRemoveButton = showActions && isRemovableFreezer(freezerId);
      return `<div class="tab-item ${showActions ? "is-removable" : ""}" data-tab-item="${freezerId}"><button class="tab-btn ${isActive ? "is-active" : ""}" data-freezer="${freezerId}" role="tab" aria-selected="${isActive ? "true" : "false"}" type="button">${escapeHtml(getFreezerLabel(freezerId))}</button>${showActions ? `<div class="freezer-tab-actions"><button class="rename-freezer-btn" data-action="rename-freezer" data-freezer="${freezerId}" type="button" aria-label="Renommer ${escapeHtml(getFreezerLabel(freezerId))}">✎</button>${showRemoveButton ? `<button class="remove-freezer-btn" data-action="remove-freezer" data-freezer="${freezerId}" type="button" aria-label="Supprimer ${escapeHtml(getFreezerLabel(freezerId))}">-</button>` : ""}</div>` : ""}</div>`;
    })
    .join("");

  freezerTabsEl.innerHTML = `${freezerTabs}<button class="add-freezer-btn" data-action="add-freezer" type="button" aria-label="Ajouter un congelateur">+</button>`;
}

function renderCategoryTabs(freezerId) {
  const container = freezerPanelsEl.querySelector(`[data-category-tabs="${freezerId}"]`);
  if (!container) return;

  if (!CATEGORIES.some((category) => category.id === activeCategoryByFreezer[freezerId])) {
    activeCategoryByFreezer[freezerId] = "all";
    saveActiveCategories();
  }

  container.innerHTML = CATEGORIES
    .map((category) => {
      const isActive = category.id === activeCategoryByFreezer[freezerId];
      const label = category.id === "plat" ? "Plats<br>cuisines" : escapeHtml(category.label);
      return `<button class="category-tab-btn ${isActive ? "is-active" : ""}" data-freezer="${freezerId}" data-category="${category.id}" type="button">${label}</button>`;
    })
    .join("");
}

function getFilteredItems(freezerId) {
  const activeCategory = activeCategoryByFreezer[freezerId] || "all";
  const items = freezerItems[freezerId] || [];
  const visible = items.filter((item) => item.active !== false && Number(item.qty) > 0);
  const filtered = activeCategory === "all" ? [...visible] : visible.filter((item) => getItemCategory(item) === activeCategory);

  return filtered.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), "fr"));
}

function renderFreezer(freezerId) {
  const panel = ensureFreezerPanel(freezerId);
  const titleEl = panel.querySelector("h3");
  if (titleEl instanceof HTMLElement) {
    titleEl.textContent = getFreezerLabel(freezerId);
  }

  const listEl = panel.querySelector(`[data-product-list="${freezerId}"]`);
  const emptyStateEl = panel.querySelector(`[data-empty-state="${freezerId}"]`);
  const allItems = freezerItems[freezerId] || [];
  if (!(listEl instanceof HTMLElement) || !(emptyStateEl instanceof HTMLElement)) return;

  renderCategoryTabs(freezerId);
  const items = getFilteredItems(freezerId);
  const visibleAllItems = allItems.filter((item) => item.active !== false && Number(item.qty) > 0);

  if (visibleAllItems.length === 0) {
    listEl.innerHTML = "";
    emptyStateEl.textContent = "Aucun produit dans ce congelateur.";
    emptyStateEl.style.display = "block";
    return;
  }

  if (items.length === 0) {
    listEl.innerHTML = "";
    emptyStateEl.textContent = "Aucun produit dans cette categorie.";
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";
  listEl.innerHTML = items
    .map((item) => {
      const realIndex = allItems.indexOf(item);
      const addedAtHtml = item.addedAt ? `<div class="item-date">Ajoute le: ${escapeHtml(item.addedAt)}</div>` : "";
      return `<li class="product-item"><div><span class="item-name">${escapeHtml(item.name)}</span><div class="item-meta">${buildCategoryControlHtml(item, freezerId, realIndex)}${addedAtHtml}</div></div><div class="item-controls"><button class="ctrl-btn" data-action="decrease" data-freezer="${freezerId}" data-index="${realIndex}" type="button">-</button><span class="qty">${item.qty}</span><button class="ctrl-btn" data-action="increase" data-freezer="${freezerId}" data-index="${realIndex}" type="button">+</button><button class="ctrl-btn remove-btn" data-action="remove" data-freezer="${freezerId}" data-index="${realIndex}" type="button">X</button></div></li>`;
    })
    .join("");
}

function renderAll() {
  ensureFreezerData();
  if (freezerActionTarget && !freezerItems[freezerActionTarget]) {
    freezerActionTarget = "";
  }
  renderFreezerTabs();
  freezerPanelsEl.innerHTML = "";
  getFreezerIds().forEach((freezerId) => renderFreezer(freezerId));

  if (!freezerItems[activeFreezer]) {
    activeFreezer = getFreezerIds()[0] || DEFAULT_FREEZERS[0].id;
  }
  setActiveFreezer(activeFreezer);
}

function setActiveFreezer(freezerId) {
  if (!freezerItems[freezerId]) return;
  activeFreezer = freezerId;
  localStorage.setItem(ACTIVE_FREEZER_KEY, freezerId);

  if (window.location.hash !== `#${freezerId}`) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${freezerId}`);
  }

  freezerTabsEl.querySelectorAll(".tab-btn").forEach((button) => {
    const isActive = button.dataset.freezer === freezerId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  freezerPanelsEl.querySelectorAll(".freezer-panel").forEach((panel) => {
    panel.hidden = panel.dataset.freezer !== freezerId;
  });
}

function setActiveCategory(freezerId, categoryId) {
  if (!freezerItems[freezerId] || !isValidCategory(categoryId)) return;
  activeCategoryByFreezer[freezerId] = categoryId;
  saveActiveCategories();
  renderFreezer(freezerId);
}

async function setItemCategory(freezerId, index, categoryId) {
  if (!isValidItemCategory(categoryId)) return;
  const item = freezerItems[freezerId]?.[index];
  if (!item) return;

  item.category = categoryId;
  await saveItems();
  renderFreezer(freezerId);
  closeAllCategoryMenus();
}

async function updateItem(freezerId, action, index) {
  const items = freezerItems[freezerId] || [];
  const item = items[index];
  if (!item) return;

  if (action === "increase") {
    item.qty += 1;
    item.active = true;
  }

  if (action === "decrease") {
    if (item.qty <= 1) {
      item.qty = 0;
      item.active = false;
    } else {
      item.qty -= 1;
    }
  }

  if (action === "remove") {
    item.qty = 0;
    item.active = false;
  }

  await saveItems();
  renderFreezer(freezerId);
  closeAllCategoryMenus();
  renderSuggestions(nameInput.value);
}

async function addFreezer() {
  const existingIds = getFreezerIds();
  const nextNumber = existingIds.reduce((max, freezerId) => Math.max(max, getFreezerNumber(freezerId)), 0) + 1;
  const freezerId = `freezer${nextNumber}`;
  freezerItems[freezerId] = [];
  freezerLabels[freezerId] = `Congelateur ${nextNumber}`;
  activeCategoryByFreezer[freezerId] = "all";

  await saveItems();
  saveActiveCategories();
  renderAll();
  setActiveFreezer(freezerId);
}

async function removeFreezer(freezerId) {
  if (!freezerItems[freezerId] || !isRemovableFreezer(freezerId)) return;
  const freezerIds = getFreezerIds();
  if (freezerIds.length <= 1) return;

  delete freezerItems[freezerId];
  delete freezerLabels[freezerId];
  delete activeCategoryByFreezer[freezerId];
  if (activeFreezer === freezerId) {
    activeFreezer = freezerIds.find((id) => id !== freezerId) || DEFAULT_FREEZERS[0].id;
  }
  freezerActionTarget = "";

  await saveItems();
  saveActiveCategories();
  renderAll();
}

async function renameFreezer(freezerId) {
  if (!freezerItems[freezerId]) return;
  const currentLabel = getFreezerLabel(freezerId);
  const nextLabelRaw = window.prompt("Nouveau nom du congelateur :", currentLabel);
  if (nextLabelRaw === null) return;

  const nextLabel = nextLabelRaw.trim().replace(/\s+/g, " ");
  if (!nextLabel) return;
  freezerLabels[freezerId] = nextLabel;
  freezerActionTarget = "";

  await saveItems();
  saveActiveCategories();
  renderAll();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const freezerId = activeFreezer;
  const name = nameInput.value.trim();
  const qty = Number(qtyInput.value);
  const selectedCategory = categoryInput instanceof HTMLSelectElement ? categoryInput.value : "auto";
  const categoryToApply = isValidItemCategory(selectedCategory) ? selectedCategory : "auto";

  if (!freezerItems[freezerId] || !name || Number.isNaN(qty) || qty < 1) return;

  const targetItems = freezerItems[freezerId];
  const existing = targetItems.find((item) => item.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    existing.qty += qty;
    existing.active = true;
    if (categoryToApply !== "auto") {
      existing.category = categoryToApply;
    }
    if (!existing.addedAt) {
      existing.addedAt = formatCurrentMonthYear();
    }
  } else {
    targetItems.push({ name, qty, category: categoryToApply, active: true, addedAt: formatCurrentMonthYear() });
  }

  await saveItems();
  renderAll();
  hideSuggestions();
  closeAllCategoryMenus();

  nameInput.value = "";
  qtyInput.value = "1";
  if (categoryInput instanceof HTMLSelectElement) {
    categoryInput.value = "auto";
  }
  renderProductCategoryOptions();
  nameInput.focus();
});

nameInput.addEventListener("input", () => {
  renderSuggestions(nameInput.value);
  renderProductCategoryOptions();
});

nameInput.addEventListener("focus", () => {
  renderSuggestions(nameInput.value);
  renderProductCategoryOptions();
});

nameInput.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 120);
});

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideSuggestions();
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
  renderProductCategoryOptions();
  hideSuggestions();
  nameInput.focus();
});

freezerTabsEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const removeBtn = target.closest("[data-action='remove-freezer']");
  if (removeBtn instanceof HTMLElement) {
    const freezerId = removeBtn.dataset.freezer;
    if (!freezerId) return;
    await removeFreezer(freezerId);
    return;
  }

  const renameBtn = target.closest("[data-action='rename-freezer']");
  if (renameBtn instanceof HTMLElement) {
    const freezerId = renameBtn.dataset.freezer;
    if (!freezerId) return;
    await renameFreezer(freezerId);
    return;
  }

  const addBtn = target.closest("[data-action='add-freezer']");
  if (addBtn instanceof HTMLElement) {
    setFreezerActionTarget("");
    await addFreezer();
    return;
  }

  const tabBtn = target.closest(".tab-btn");
  if (!(tabBtn instanceof HTMLElement)) return;
  if (freezerLongPressTriggered) {
    freezerLongPressTriggered = false;
    return;
  }
  const freezerId = tabBtn.dataset.freezer;
  if (!freezerId) return;
  setActiveFreezer(freezerId);
  setFreezerActionTarget("");
});

freezerTabsEl.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const tabBtn = target.closest(".tab-btn");
  if (!(tabBtn instanceof HTMLElement)) return;
  const freezerId = tabBtn.dataset.freezer;
  if (!freezerId) return;

  clearFreezerLongPressTimer();
  freezerLongPressTriggered = false;
  freezerLongPressTimer = window.setTimeout(() => {
    freezerLongPressTriggered = true;
    triggerHapticFeedback();
    setFreezerActionTarget(freezerId);
  }, FREEZER_LONG_PRESS_MS);
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  freezerTabsEl.addEventListener(eventName, () => {
    clearFreezerLongPressTimer();
  });
});

window.addEventListener("hashchange", () => {
  const hashValue = window.location.hash.replace("#", "").trim();
  if (!freezerItems[hashValue]) return;
  setActiveFreezer(hashValue);
});

freezerPanelsEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const categoryTabBtn = target.closest(".category-tab-btn");
  if (categoryTabBtn instanceof HTMLElement) {
    const tabFreezer = categoryTabBtn.dataset.freezer;
    const categoryId = categoryTabBtn.dataset.category;
    if (!tabFreezer || !categoryId) return;
    setActiveCategory(tabFreezer, categoryId);
    return;
  }

  const actionEl = target.closest("[data-action][data-freezer][data-index]");
  if (!(actionEl instanceof HTMLElement)) return;

  const action = actionEl.dataset.action;
  const index = Number(actionEl.dataset.index);
  const targetFreezer = actionEl.dataset.freezer;

  if (!action || Number.isNaN(index) || !freezerItems[targetFreezer]) return;

  if (action === "toggle-category-menu") {
    toggleCategoryMenu(targetFreezer, index);
    return;
  }

  if (action === "set-category") {
    const categoryId = actionEl.dataset.category;
    if (!categoryId) return;
    await setItemCategory(targetFreezer, index, categoryId);
    return;
  }

  await updateItem(targetFreezer, action, index);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".category-picker")) return;
  closeAllCategoryMenus();
  if (!target.closest("#freezer-tabs")) {
    setFreezerActionTarget("");
  }
});

function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return "";
  return text.startsWith("http://") || text.startsWith("https://") ? text : `https://${text}`;
}

function setQrCode(url) {
  if (!url) {
    qrImage.style.display = "none";
    qrImage.removeAttribute("src");
    return;
  }

  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  qrImage.style.display = "block";
}

generateQrBtn.addEventListener("click", () => {
  const normalized = normalizeUrl(appUrlInput.value || window.location.href);
  if (!normalized) return;

  localStorage.setItem(URL_KEY, normalized);
  appUrlInput.value = normalized;
  setQrCode(normalized);
});

async function fetchVersion({ noCache = false } = {}) {
  try {
    const cacheBuster = noCache ? `?t=${Date.now()}` : "";
    const response = await fetch(`${VERSION_ENDPOINT}${cacheBuster}`, { cache: noCache ? "no-store" : "default" });
    if (!response.ok) return "";

    const payload = await response.json();
    if (!payload || typeof payload.version !== "string") return "";

    return payload.version.trim();
  } catch {
    return "";
  }
}

async function fetchRemoteVersion() {
  return fetchVersion({ noCache: true });
}

async function fetchLocalVersion() {
  return fetchVersion({ noCache: false });
}

async function checkForUpdates() {
  const remoteVersion = await fetchRemoteVersion();
  if (!remoteVersion) {
    setVersionBadge(formatVersionBadge(currentAppVersion), currentAppVersion ? "is-ok" : "is-unknown");
    return;
  }

  if (!currentAppVersion) {
    currentAppVersion = remoteVersion;
    setVersionBadge(formatVersionBadge(currentAppVersion), "is-ok");
    return;
  }

  if (remoteVersion !== currentAppVersion) {
    window.location.reload();
    return;
  }

  setVersionBadge(formatVersionBadge(currentAppVersion), "is-ok");
}

function startAutoRefreshWatcher() {
  checkForUpdates();
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL_MS);
}

(async function init() {
  setVersionBadge(formatVersionBadge(currentAppVersion), "is-checking");
  const savedUrl = localStorage.getItem(URL_KEY);
  const initialUrl = savedUrl || window.location.href;
  appUrlInput.value = initialUrl;
  setQrCode(initialUrl);

  nameInput.value = "";
  renderAll();
  renderProductCategoryOptions();
  hideSuggestions();
  closeAllCategoryMenus();
  setActiveFreezer(activeFreezer);

  const localVersion = await fetchLocalVersion();
  if (localVersion) {
    currentAppVersion = localVersion;
    setVersionBadge(formatVersionBadge(localVersion), "is-ok");
  } else {
    setVersionBadge(formatVersionBadge("0"), "is-unknown");
  }

  await initCloudSync();
  startAutoRefreshWatcher();
})();
