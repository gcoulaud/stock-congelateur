const STORAGE_KEY = "freezer-stock-items-v1";
const URL_KEY = "freezer-stock-app-url-v1";
const ACTIVE_FREEZER_KEY = "freezer-stock-active-tab-v1";
const ACTIVE_CATEGORY_KEY = "freezer-stock-active-category-v1";
const FREEZER_LABELS_KEY = "freezer-stock-labels-v1";
const DEFAULT_FREEZERS = [
  { id: "freezer1", label: "Cuisine" },
  { id: "freezer2", label: "Celier" },
];
const VERSION_ENDPOINT = "version.json";
const VERSION_CHECK_INTERVAL_MS = 60000;

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
  poisson: ["poisson", "saumon", "truite", "maquereau", "crevette", "sole", "poulpe", "lieu","bar"],
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
const freezerTabsEl = document.getElementById("freezer-tabs");
const freezerPanelsEl = document.getElementById("freezer-panels");
const appUrlInput = document.getElementById("app-url");
const generateQrBtn = document.getElementById("generate-qr");
const qrImage = document.getElementById("qr-image");
const syncStatusEl = document.getElementById("sync-status");
let freezerItems = loadItemsLocal();
let freezerLabels = loadFreezerLabelsLocal();
ensureFreezerData();
let activeFreezer = loadActiveFreezer();
let activeCategoryByFreezer = loadActiveCategories();
let stockDocRef = null;
let storageMode = "local";
let currentAppVersion = "";

function setSyncStatus(text) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = text;
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
  return str
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

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.name === "string" && Number(item.qty) >= 0)
    .map((item) => ({
      name: item.name,
      qty: Number(item.qty),
      category: isValidItemCategory(item.category) ? item.category : "auto",
      active: item.active === false ? false : Number(item.qty) > 0,
    }));
}

function sanitizeStockPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { freezer1: [], freezer2: [] };
  }

  return {
    freezer1: sanitizeItems(payload.freezer1),
    freezer2: sanitizeItems(payload.freezer2),
  };
}

function safeParseJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractCloudPayload(rawData) {
  if (!rawData) {
    return { freezer1: [], freezer2: [] };
  }

  if (typeof rawData === "string") {
    const parsed = safeParseJson(rawData);
    return parsed ? extractCloudPayload(parsed) : { freezer1: [], freezer2: [] };
  }

  if (typeof rawData !== "object") {
    return { freezer1: [], freezer2: [] };
  }

  if (rawData.freezerItems) {
    if (typeof rawData.freezerItems === "string") {
      const parsed = safeParseJson(rawData.freezerItems);
      if (parsed) return sanitizeStockPayload(parsed);
    }

    if (typeof rawData.freezerItems === "object") {
      return sanitizeStockPayload(rawData.freezerItems);
    }
  }

  if (rawData.freezer1 || rawData.freezer2) {
    return sanitizeStockPayload(rawData);
  }

  return {
    freezer1: sanitizeItems(rawData.cuisine || rawData.Cuisine || rawData.freezer_1),
    freezer2: sanitizeItems(rawData.celier || rawData.Celier || rawData.freezer_2),
  };
}

function hasAnyItems(payload) {
  return (payload.freezer1?.length || 0) + (payload.freezer2?.length || 0) > 0;
}

function loadItemsLocal() {
  const empty = { freezer1: [], freezer2: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { freezer1: sanitizeItems(parsed), freezer2: [] };
    }

    return sanitizeStockPayload(parsed);
  } catch {
    return empty;
  }
}

function saveItemsLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(freezerItems));
}

async function saveItemsCloud() {
  if (!stockDocRef) return;
  await stockDocRef.set(
    {
      freezerItems,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
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

        if (!hasAnyItems(cloudItems) && hasAnyItems(freezerItems)) {
          setSyncStatus("Synchro cloud active (cloud vide ignore)");
          return;
        }

        freezerItems = cloudItems;
        activeCategoryByFreezer = { freezer1: "all", freezer2: "all" };
        saveActiveCategories();
        saveItemsLocal();
        renderAll();

        const total = (cloudItems.freezer1?.length || 0) + (cloudItems.freezer2?.length || 0);
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
  const hashValue = window.location.hash.replace("#", "").trim();
  if (FREEZERS.includes(hashValue)) return hashValue;

  const saved = localStorage.getItem(ACTIVE_FREEZER_KEY);
  return FREEZERS.includes(saved) ? saved : "freezer1";
}

function loadActiveCategories() {
  const defaults = { freezer1: "all", freezer2: "all" };
  try {
    const raw = localStorage.getItem(ACTIVE_CATEGORY_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    return {
      freezer1: isValidCategory(parsed.freezer1) ? parsed.freezer1 : "all",
      freezer2: isValidCategory(parsed.freezer2) ? parsed.freezer2 : "all",
    };
  } catch {
    return defaults;
  }
}

function saveActiveCategories() {
  localStorage.setItem(ACTIVE_CATEGORY_KEY, JSON.stringify(activeCategoryByFreezer));
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

  FREEZERS.forEach((freezerId) => {
    freezerItems[freezerId].forEach((item) => {
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
  if (filter.length < 1) {
    hideSuggestions();
    return;
  }

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

function renderCategoryTabs(freezerId) {
  const container = categoryTabsByFreezer[freezerId];
  const items = freezerItems[freezerId];
  if (!container) return;

  const visibleCategories = CATEGORIES;

  if (!visibleCategories.some((category) => category.id === activeCategoryByFreezer[freezerId])) {
    activeCategoryByFreezer[freezerId] = "all";
    saveActiveCategories();
  }

  container.innerHTML = visibleCategories
    .map((category) => {
      const isActive = category.id === activeCategoryByFreezer[freezerId];
      const label = category.id === "plat" ? "Plats<br>cuisines" : escapeHtml(category.label);
      return `<button class="category-tab-btn ${isActive ? "is-active" : ""}" data-freezer="${freezerId}" data-category="${category.id}" type="button">${label}</button>`;
    })
    .join("");
}

function getFilteredItems(freezerId) {
  const activeCategory = activeCategoryByFreezer[freezerId] || "all";
  const items = freezerItems[freezerId];
  const visible = items.filter((item) => item.active !== false && Number(item.qty) > 0);
  const filtered = activeCategory === "all" ? [...visible] : visible.filter((item) => getItemCategory(item) === activeCategory);

  // Keep storage order intact; only sort display order.
  return filtered.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), "fr"));
}

function renderFreezer(freezerId) {
  const listEl = listByFreezer[freezerId];
  const emptyStateEl = emptyStateByFreezer[freezerId];
  const allItems = freezerItems[freezerId];

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
      return `<li class="product-item"><div><span class="item-name">${escapeHtml(item.name)}</span><div class="item-meta">${buildCategoryControlHtml(item, freezerId, realIndex)}</div></div><div class="item-controls"><button class="ctrl-btn" data-action="decrease" data-freezer="${freezerId}" data-index="${realIndex}" type="button">-</button><span class="qty">${item.qty}</span><button class="ctrl-btn" data-action="increase" data-freezer="${freezerId}" data-index="${realIndex}" type="button">+</button><button class="ctrl-btn remove-btn" data-action="remove" data-freezer="${freezerId}" data-index="${realIndex}" type="button">X</button></div></li>`;
    })
    .join("");
}

function renderAll() {
  FREEZERS.forEach(renderFreezer);
}

function setActiveFreezer(freezerId) {
  if (!FREEZERS.includes(freezerId)) return;
  activeFreezer = freezerId;
  localStorage.setItem(ACTIVE_FREEZER_KEY, freezerId);
  if (window.location.hash !== `#${freezerId}`) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${freezerId}`);
  }

  tabButtons.forEach((button) => {
    const isActive = button.dataset.freezer === freezerId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  freezerPanels.forEach((panel) => {
    panel.hidden = panel.dataset.freezer !== freezerId;
  });
}

function setActiveCategory(freezerId, categoryId) {
  if (!FREEZERS.includes(freezerId) || !isValidCategory(categoryId)) return;
  activeCategoryByFreezer[freezerId] = categoryId;
  saveActiveCategories();
  renderFreezer(freezerId);
}

async function setItemCategory(freezerId, index, categoryId) {
  if (!isValidItemCategory(categoryId)) return;
  const item = freezerItems[freezerId][index];
  if (!item) return;

  item.category = categoryId;
  await saveItems();
  renderFreezer(freezerId);
  closeAllCategoryMenus();
}

async function updateItem(freezerId, action, index) {
  const items = freezerItems[freezerId];
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const freezerId = activeFreezer;
  const name = nameInput.value.trim();
  const qty = Number(qtyInput.value);

  if (!FREEZERS.includes(freezerId) || !name || Number.isNaN(qty) || qty < 1) return;

  const targetItems = freezerItems[freezerId];
  const existing = targetItems.find((item) => item.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    existing.qty += qty;
    existing.active = true;
  } else {
    targetItems.push({ name, qty, category: "auto", active: true });
  }

  await saveItems();
  renderFreezer(freezerId);
  hideSuggestions();
  closeAllCategoryMenus();

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
  hideSuggestions();
  nameInput.focus();
});

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveFreezer(button.dataset.freezer);
    });
  });

window.addEventListener("hashchange", () => {
  const hashValue = window.location.hash.replace("#", "").trim();
  if (!FREEZERS.includes(hashValue)) return;
  setActiveFreezer(hashValue);
});

FREEZERS.forEach((freezerId) => {
  const listEl = listByFreezer[freezerId];
  const categoryTabs = categoryTabsByFreezer[freezerId];

  listEl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const actionEl = target.closest("[data-action][data-freezer][data-index]");
    if (!(actionEl instanceof HTMLElement)) return;

    const action = actionEl.dataset.action;
    const index = Number(actionEl.dataset.index);
    const targetFreezer = actionEl.dataset.freezer;

    if (!action || Number.isNaN(index) || !FREEZERS.includes(targetFreezer)) return;

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

  categoryTabs.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest(".category-tab-btn");
    if (!(btn instanceof HTMLElement)) return;

    const tabFreezer = btn.dataset.freezer;
    const categoryId = btn.dataset.category;
    if (!tabFreezer || !categoryId) return;

    setActiveCategory(tabFreezer, categoryId);
  });
});


document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".category-picker")) return;
  closeAllCategoryMenus();
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

(async function init() {
  const savedUrl = localStorage.getItem(URL_KEY);
  const initialUrl = savedUrl || window.location.href;
  appUrlInput.value = initialUrl;
  setQrCode(initialUrl);

  renderAll();
  nameInput.value = "";
  hideSuggestions();
  closeAllCategoryMenus();
  setActiveFreezer(activeFreezer);

  await initCloudSync();
  startAutoRefreshWatcher();
})();
