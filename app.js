const STORAGE_KEY = "freezer-stock-items-v1";
const URL_KEY = "freezer-stock-app-url-v1";
const FREEZERS = ["freezer1", "freezer2"];

const form = document.getElementById("product-form");
const freezerSelect = document.getElementById("freezer-select");
const nameInput = document.getElementById("product-name");
const qtyInput = document.getElementById("product-qty");
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

function loadItems() {
  const empty = { freezer1: [], freezer2: [] };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);

    // Migration from old format: one array => freezer1
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
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const freezerId = freezerSelect.value;
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

  nameInput.value = "";
  qtyInput.value = "1";
  nameInput.focus();
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
})();
