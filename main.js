/**
 * Cash Counter (Geldzähler) - Mobile-First Multi-Pile Currency Calculator
 * Denominations: Euro bills (200€ to 5€), coin rolls (2€, 1€, 50ct), and loose coins (2€ down to 10ct).
 */

// Denominations configuration
const DENOMINATIONS = [
  // Scheine & Münzen (5€ bis 200€ Scheine, dann 2€ bis 10ct Münzen)
  { id: 'b5',   type: 'bill', category: 'cash',  value: 5.0,   label: '5 €',   sublabel: 'Schein', color: 'var(--denom-5)' },
  { id: 'b10',  type: 'bill', category: 'cash',  value: 10.0,  label: '10 €',  sublabel: 'Schein', color: 'var(--denom-10)' },
  { id: 'b20',  type: 'bill', category: 'cash',  value: 20.0,  label: '20 €',  sublabel: 'Schein', color: 'var(--denom-20)' },
  { id: 'b50',  type: 'bill', category: 'cash',  value: 50.0,  label: '50 €',  sublabel: 'Schein', color: 'var(--denom-50)' },
  { id: 'b100', type: 'bill', category: 'cash',  value: 100.0, label: '100 €', sublabel: 'Schein', color: 'var(--denom-100)' },
  { id: 'b200', type: 'bill', category: 'cash',  value: 200.0, label: '200 €', sublabel: 'Schein', color: 'var(--denom-200)' },
  { id: 'c200', type: 'coin', category: 'cash',  value: 2.0,   label: '2 €',   sublabel: 'Münze',  color: 'var(--coin-bicolor)' },
  { id: 'c100', type: 'coin', category: 'cash',  value: 1.0,   label: '1 €',   sublabel: 'Münze',  color: 'var(--coin-bicolor)' },
  { id: 'c50',  type: 'coin', category: 'cash',  value: 0.50,  label: '50 ct', sublabel: 'Münze',  color: 'var(--coin-gold)' },
  { id: 'c20',  type: 'coin', category: 'cash',  value: 0.20,  label: '20 ct', sublabel: 'Münze',  color: 'var(--coin-gold)' },
  { id: 'c10',  type: 'coin', category: 'cash',  value: 0.10,  label: '10 ct', sublabel: 'Münze',  color: 'var(--coin-gold)' },
  
  // Wechselgeld (5€ Schein, 2€ Rolle, 1€ Rolle, 50ct Rolle)
  { id: 'w5',   type: 'bill', category: 'rolls', value: 5.0,   label: '5 €',        sublabel: 'Schein',               color: 'var(--denom-5)' },
  { id: 'r200', type: 'roll', category: 'rolls', value: 50.0,  label: '2 € Rolle',  sublabel: 'Wert: 50 € (25 Stk)',  color: 'var(--coin-bicolor)' },
  { id: 'r100', type: 'roll', category: 'rolls', value: 25.0,  label: '1 € Rolle',  sublabel: 'Wert: 25 € (25 Stk)',  color: 'var(--coin-bicolor)' },
  { id: 'r50',  type: 'roll', category: 'rolls', value: 20.0,  label: '50 ct Rolle', sublabel: 'Wert: 20 € (40 Stk)', color: 'var(--coin-gold)' }
];

const STORAGE_KEY = 'cash_counter_piles_data_v2';

// Application State
let appState = {
  activePileId: 'pile-1',
  piles: [
    {
      id: 'pile-1',
      name: 'Stapel 1',
      counts: {}, // { 'b50': 4, 'c200': 12, ... }
      collapsedCategories: {} // { 'bills': false, 'rolls': false, 'coins': false }
    }
  ]
};

// Currently editing denomination in modal
let activeModalDenomIndex = 0;
let modalCurrentInput = "0";

// Dialog modal callback storage
let pendingPromptResolver = null;
let pendingConfirmResolver = null;

// Custom Dynamic Currency Formatter:
// Strips ',00' for exact whole-euro amounts, but preserves decimal precision for cents (e.g. 50 ct, 20 ct, 10 ct)
const baseCurrencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatCurrency(amount) {
  const roundedCents = Math.round(amount * 100);
  if (roundedCents % 100 === 0) {
    // Exact whole euro: e.g. 50 € instead of 50,00 €
    const wholeEuros = Math.round(amount);
    return `${numberFormatter.format(wholeEuros)} €`;
  }
  // Fractional amounts (has cents): e.g. 1,50 €, 0,20 €
  return baseCurrencyFormatter.format(amount);
}

// Format plain number
const numberFormatter = new Intl.NumberFormat('de-DE');

/* --------------------------------------------------------------------------
   Initialization & Storage
   -------------------------------------------------------------------------- */
function init() {
  loadFromStorage();
  renderDenominationGrids();
  renderPileTabs();
  applyCategoryCollapseState();
  updateCalculations();
  bindEvents();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('cash_counter_piles_data_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.piles && parsed.piles.length > 0) {
        appState = parsed;
        if (!appState.piles.some(p => p.id === appState.activePileId)) {
          appState.activePileId = appState.piles[0].id;
        }
        // Ensure collapsedCategories object exists on all piles
        appState.piles.forEach(pile => {
          if (!pile.collapsedCategories) {
            pile.collapsedCategories = {};
          }
          // Clean up old b500 count if existing
          if (pile.counts && pile.counts['b500']) {
            delete pile.counts['b500'];
          }
        });
      }
    }
  } catch (e) {
    console.error("Storage load error:", e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

function getActivePile() {
  return appState.piles.find(p => p.id === appState.activePileId) || appState.piles[0];
}

/* --------------------------------------------------------------------------
   Modal Scroll Lock Helper
   -------------------------------------------------------------------------- */
function checkModalScrollLock() {
  const anyOpen = document.querySelectorAll('.modal-backdrop.open').length > 0;
  if (anyOpen) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}
function showCustomPrompt(title, defaultValue = '') {
  return new Promise((resolve) => {
    pendingPromptResolver = resolve;
    const modal = document.getElementById('promptModal');
    const titleEl = document.getElementById('promptTitle');
    const inputEl = document.getElementById('promptInput');

    titleEl.textContent = title;
    inputEl.value = defaultValue;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    checkModalScrollLock();
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 100);
  });
}

function closeCustomPrompt(result) {
  const modal = document.getElementById('promptModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  checkModalScrollLock();
  if (pendingPromptResolver) {
    pendingPromptResolver(result);
    pendingPromptResolver = null;
  }
}

function showCustomConfirm(title, message, confirmBtnText = 'Bestätigen') {
  return new Promise((resolve) => {
    pendingConfirmResolver = resolve;
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('okConfirmBtn');

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmBtnText;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    checkModalScrollLock();
  });
}

function closeCustomConfirm(result) {
  const modal = document.getElementById('confirmModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  checkModalScrollLock();
  if (pendingConfirmResolver) {
    pendingConfirmResolver(result);
    pendingConfirmResolver = null;
  }
}

/* --------------------------------------------------------------------------
   Category Collapse / Expand Management
   -------------------------------------------------------------------------- */
function toggleCategory(category) {
  const pile = getActivePile();
  if (!pile.collapsedCategories) pile.collapsedCategories = {};
  
  pile.collapsedCategories[category] = !pile.collapsedCategories[category];
  applyCategoryCollapseState();
  saveToStorage();
}

function applyCategoryCollapseState() {
  const pile = getActivePile();
  const collapsed = pile.collapsedCategories || {};

  ['cash', 'rolls'].forEach(cat => {
    const section = document.getElementById(`section-${cat}`);
    const headerBtn = section ? section.querySelector('.collapsable-header') : null;
    const isCollapsed = !!collapsed[cat];

    if (section) {
      if (isCollapsed) {
        section.classList.add('collapsed');
      } else {
        section.classList.remove('collapsed');
      }
    }
    if (headerBtn) {
      headerBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
  });
}

/* --------------------------------------------------------------------------
   DOM Rendering
   -------------------------------------------------------------------------- */
function renderDenominationGrids() {
  const cashContainer = document.getElementById('cashGrid');
  const rollsContainer = document.getElementById('rollsGrid');

  if (cashContainer) cashContainer.innerHTML = '';
  if (rollsContainer) rollsContainer.innerHTML = '';

  DENOMINATIONS.forEach((denom, index) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'denom-row';
    rowEl.id = `row-${denom.id}`;
    rowEl.style.setProperty('--denom-color', denom.color);

    rowEl.innerHTML = `
      <div class="denom-tag" data-index="${index}">
        <div class="denom-value">${denom.label}</div>
        <div class="denom-type">${denom.sublabel}</div>
      </div>
      <div class="denom-calc" data-index="${index}">
        <div class="denom-row-sum" id="sum-${denom.id}">0,00 €</div>
        <div class="denom-multiplier" id="mult-${denom.id}">0 × ${denom.label}</div>
      </div>
      <div class="stepper-control">
        <button class="step-btn minus-btn" data-denom="${denom.id}" title="1 abziehen">
          <svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
        </button>
        <button class="count-display-btn" data-index="${index}" id="count-${denom.id}">0</button>
        <button class="step-btn plus-btn" data-denom="${denom.id}" title="1 hinzufügen">
          <svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </button>
      </div>
    `;

    if (denom.category === 'cash') {
      if (cashContainer) cashContainer.appendChild(rowEl);
    } else if (denom.category === 'rolls') {
      if (rollsContainer) rollsContainer.appendChild(rowEl);
    }
  });
}

function renderPileTabs() {
  const tabsContainer = document.getElementById('pilesTabs');
  tabsContainer.innerHTML = '';

  appState.piles.forEach((pile) => {
    const tabEl = document.createElement('div');
    tabEl.className = `pile-tab ${pile.id === appState.activePileId ? 'active' : ''}`;
    tabEl.dataset.id = pile.id;

    const total = calculatePileTotal(pile);

    tabEl.innerHTML = `
      <div class="tab-content">
        <span class="tab-title">${escapeHtml(pile.name)}</span>
        <span class="tab-badge">${formatCurrency(total)}</span>
      </div>
      ${appState.piles.length > 1 ? `<span class="tab-close" data-remove="${pile.id}" title="Stapel löschen">&times;</span>` : ''}
    `;

    tabsContainer.appendChild(tabEl);
  });

  const badgeEl = document.getElementById('pileCountBadge');
  if (badgeEl) badgeEl.textContent = appState.piles.length;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/* --------------------------------------------------------------------------
   Calculations & UI Updates
   -------------------------------------------------------------------------- */
function calculatePileTotal(pile) {
  let total = 0;
  DENOMINATIONS.forEach(denom => {
    const count = pile.counts[denom.id] || 0;
    total += count * denom.value;
  });
  return total;
}

function updateCalculations() {
  const currentPile = getActivePile();
  let currentPileSum = 0;
  let cashSubtotal = 0;
  let rollsSubtotal = 0;

  // Update each denomination row
  DENOMINATIONS.forEach(denom => {
    const count = currentPile.counts[denom.id] || 0;
    const lineTotal = count * denom.value;
    currentPileSum += lineTotal;

    if (denom.category === 'cash') cashSubtotal += lineTotal;
    else if (denom.category === 'rolls') rollsSubtotal += lineTotal;

    // Update row DOM
    const countBtn = document.getElementById(`count-${denom.id}`);
    const sumEl = document.getElementById(`sum-${denom.id}`);
    const multEl = document.getElementById(`mult-${denom.id}`);
    const rowEl = document.getElementById(`row-${denom.id}`);

    if (countBtn) countBtn.textContent = numberFormatter.format(count);
    if (sumEl) sumEl.textContent = formatCurrency(lineTotal);
    if (multEl) multEl.textContent = `${count} × ${denom.label}`;

    if (rowEl) {
      if (count > 0) rowEl.classList.add('has-count');
      else rowEl.classList.remove('has-count');
    }
  });

  // Calculate Grand Total across all piles
  let grandTotal = 0;
  appState.piles.forEach(p => {
    grandTotal += calculatePileTotal(p);
  });

  // Update headers and footers
  const cashSubtotalEl = document.getElementById('cashSubtotal');
  const rollsSubtotalEl = document.getElementById('rollsSubtotal');
  if (cashSubtotalEl) cashSubtotalEl.textContent = formatCurrency(cashSubtotal);
  if (rollsSubtotalEl) rollsSubtotalEl.textContent = formatCurrency(rollsSubtotal);

  document.getElementById('currentPileTotal').textContent = formatCurrency(currentPileSum);
  document.getElementById('grandTotal').textContent = formatCurrency(grandTotal);

  document.getElementById('footerPileName').textContent = currentPile.name;
  document.getElementById('footerPileTotal').textContent = formatCurrency(currentPileSum);

  // Update active state in tabs & badges
  updateTabBadges();
  saveToStorage();
}

function updateTabBadges() {
  const tabs = document.querySelectorAll('.pile-tab');
  tabs.forEach(tab => {
    const id = tab.dataset.id;
    const pile = appState.piles.find(p => p.id === id);
    if (pile) {
      if (id === appState.activePileId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
      const badge = tab.querySelector('.tab-badge');
      if (badge) {
        badge.textContent = formatCurrency(calculatePileTotal(pile));
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Pile Management
   -------------------------------------------------------------------------- */
function switchPile(pileId) {
  if (appState.activePileId === pileId) return;
  appState.activePileId = pileId;
  renderPileTabs();
  applyCategoryCollapseState(); // Apply the newly selected pile's collapse state
  updateCalculations();
}

async function addNewPile() {
  const newIndex = appState.piles.length + 1;
  const newName = await showCustomPrompt('Neuen Stapel erstellen', `Stapel ${newIndex}`);
  if (!newName || !newName.trim()) return;

  const newId = `pile-${Date.now()}`;
  appState.piles.push({
    id: newId,
    name: newName.trim(),
    counts: {},
    collapsedCategories: {}
  });

  appState.activePileId = newId;
  renderPileTabs();
  applyCategoryCollapseState();
  updateCalculations();

  // Scroll new tab into view
  const newTab = document.querySelector(`.pile-tab[data-id="${newId}"]`);
  if (newTab) newTab.scrollIntoView({ behavior: 'smooth', inline: 'nearest' });
  showToast(`"${newName.trim()}" erstellt`);
}

async function deletePile(pileId) {
  if (appState.piles.length <= 1) return;
  const pile = appState.piles.find(p => p.id === pileId);
  if (!pile) return;

  const confirmed = await showCustomConfirm(
    'Stapel löschen',
    `Möchtest du "${pile.name}" wirklich löschen? Alle Zählungen darin gehen verloren.`,
    'Löschen'
  );
  if (!confirmed) return;

  appState.piles = appState.piles.filter(p => p.id !== pileId);
  if (appState.activePileId === pileId) {
    appState.activePileId = appState.piles[0].id;
  }
  renderPileTabs();
  applyCategoryCollapseState();
  updateCalculations();
  showToast(`"${pile.name}" gelöscht`);
}

async function resetCurrentPile() {
  const pile = getActivePile();
  const confirmed = await showCustomConfirm(
    'Stapel leeren',
    `Möchtest du alle Zählungen für "${pile.name}" auf 0 zurücksetzen?`,
    'Ja, leeren'
  );
  if (!confirmed) return;

  pile.counts = {};
  updateCalculations();
  showToast(`"${pile.name}" geleert`);
}

/* --------------------------------------------------------------------------
   Touch Numpad Modal Interactions
   -------------------------------------------------------------------------- */
function openNumpadModal(denomIndex) {
  activeModalDenomIndex = denomIndex;
  const denom = DENOMINATIONS[denomIndex];
  const pile = getActivePile();
  const currentCount = pile.counts[denom.id] || 0;

  modalCurrentInput = currentCount.toString();
  updateModalUI();

  const modal = document.getElementById('inputModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  checkModalScrollLock();
}

function closeNumpadModal() {
  applyModalValue();
  const modal = document.getElementById('inputModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  checkModalScrollLock();
}

function updateModalUI() {
  const denom = DENOMINATIONS[activeModalDenomIndex];
  document.getElementById('modalDenomBadge').textContent = denom.label;
  document.getElementById('modalDenomTitle').textContent = `${denom.label} (${denom.sublabel})`;
  
  const countNum = parseInt(modalCurrentInput, 10) || 0;
  const total = countNum * denom.value;
  document.getElementById('modalDenomSubtotal').textContent = `${countNum} × ${denom.label} = ${formatCurrency(total)}`;
  document.getElementById('modalValueInput').value = modalCurrentInput;

  document.getElementById('modalPrevDenomBtn').style.opacity = activeModalDenomIndex > 0 ? '1' : '0.4';
  document.getElementById('modalNextDenomBtn').style.opacity = activeModalDenomIndex < DENOMINATIONS.length - 1 ? '1' : '0.4';
}

function applyModalValue() {
  const denom = DENOMINATIONS[activeModalDenomIndex];
  const pile = getActivePile();
  const count = parseInt(modalCurrentInput, 10) || 0;

  if (count > 0) {
    pile.counts[denom.id] = count;
  } else {
    delete pile.counts[denom.id];
  }
  updateCalculations();
}

function handleKeypadPress(key) {
  if (key === 'clear') {
    modalCurrentInput = "0";
  } else if (key === 'back') {
    if (modalCurrentInput.length > 1) {
      modalCurrentInput = modalCurrentInput.slice(0, -1);
    } else {
      modalCurrentInput = "0";
    }
  } else {
    if (modalCurrentInput === "0") {
      modalCurrentInput = key;
    } else if (modalCurrentInput.length < 5) {
      modalCurrentInput += key;
    }
  }
  updateModalUI();
}

function handleQuickAdd(amount) {
  const current = parseInt(modalCurrentInput, 10) || 0;
  modalCurrentInput = Math.min(99999, current + amount).toString();
  updateModalUI();
}

/* --------------------------------------------------------------------------
   Summary Modal
   -------------------------------------------------------------------------- */
function openSummaryModal() {
  const summaryBody = document.getElementById('summaryBody');
  let grandTotal = 0;
  let html = ``;

  appState.piles.forEach((pile) => {
    const pileTotal = calculatePileTotal(pile);
    grandTotal += pileTotal;

    html += `
      <div style="background: rgba(15,23,42,0.6); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <strong style="font-size:1rem; color: #fff;">${escapeHtml(pile.name)}</strong>
          <span style="font-family: var(--font-mono); font-weight:700; color: var(--accent-success); font-size:1.05rem;">
            ${formatCurrency(pileTotal)}
          </span>
        </div>
        <table class="summary-table">
          <thead>
            <tr><th>Posten</th><th>Anzahl</th><th style="text-align:right">Summe</th></tr>
          </thead>
          <tbody>
    `;

    let hasEntries = false;
    DENOMINATIONS.forEach(denom => {
      const count = pile.counts[denom.id] || 0;
      if (count > 0) {
        hasEntries = true;
        html += `
          <tr>
            <td>${denom.label}</td>
            <td>${count} Stk.</td>
            <td class="align-right">${formatCurrency(count * denom.value)}</td>
          </tr>
        `;
      }
    });

    if (!hasEntries) {
      html += `<tr><td colspan="3" style="color:var(--text-muted); font-style:italic;">Keine Einträge</td></tr>`;
    }

    html += `</tbody></table></div>`;
  });

  html += `
    <div style="display:flex; justify-content:space-between; padding: 14px; background: rgba(59,130,246,0.15); border-radius: 12px; border: 1px solid rgba(59,130,246,0.3); margin-top: 6px;">
      <strong style="font-size: 1.1rem; color: #fff;">Gesamt (alle Stapel)</strong>
      <strong style="font-family: var(--font-mono); font-size: 1.25rem; color: var(--accent-success);">${formatCurrency(grandTotal)}</strong>
    </div>
  `;

  summaryBody.innerHTML = html;
  document.getElementById('summaryModal').classList.add('open');
  checkModalScrollLock();
}

function closeSummaryModal() {
  document.getElementById('summaryModal').classList.remove('open');
  checkModalScrollLock();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}

/* --------------------------------------------------------------------------
   Event Listeners
   -------------------------------------------------------------------------- */
function bindEvents() {
  // Global click delegate for steppers, denomination cards, and pile tabs
  document.addEventListener('click', (e) => {
    // Stepper +
    const plusBtn = e.target.closest('.plus-btn');
    if (plusBtn) {
      const denomId = plusBtn.dataset.denom;
      const pile = getActivePile();
      pile.counts[denomId] = (pile.counts[denomId] || 0) + 1;
      updateCalculations();
      return;
    }

    // Stepper -
    const minusBtn = e.target.closest('.minus-btn');
    if (minusBtn) {
      const denomId = minusBtn.dataset.denom;
      const pile = getActivePile();
      const current = pile.counts[denomId] || 0;
      if (current > 1) {
        pile.counts[denomId] = current - 1;
      } else {
        delete pile.counts[denomId];
      }
      updateCalculations();
      return;
    }

    // Category Collapse Header Click
    const headerBtn = e.target.closest('.collapsable-header');
    if (headerBtn) {
      const cat = headerBtn.dataset.toggle;
      if (cat) toggleCategory(cat);
      return;
    }

    // Direct Tap on denomination count or row tag to open keypad
    const countBtn = e.target.closest('.count-display-btn');
    const denomTag = e.target.closest('.denom-tag');
    const denomCalc = e.target.closest('.denom-calc');
    if (countBtn || denomTag || denomCalc) {
      const target = countBtn || denomTag || denomCalc;
      const index = parseInt(target.dataset.index, 10);
      if (!isNaN(index)) {
        openNumpadModal(index);
      }
      return;
    }

    // Pile tab delete button
    const closeTabBtn = e.target.closest('.tab-close');
    if (closeTabBtn) {
      e.stopPropagation();
      const pileId = closeTabBtn.dataset.remove;
      deletePile(pileId);
      return;
    }

    // Pile tab switch
    const pileTab = e.target.closest('.pile-tab');
    if (pileTab) {
      switchPile(pileTab.dataset.id);
      return;
    }
  });

  // Header and Action buttons
  document.getElementById('addPileBtn').addEventListener('click', addNewPile);
  document.getElementById('resetPileBtn').addEventListener('click', resetCurrentPile);
  document.getElementById('viewBreakdownBtn').addEventListener('click', openSummaryModal);
  document.getElementById('closeSummaryModalBtn').addEventListener('click', closeSummaryModal);
  document.getElementById('closeSummaryBtn').addEventListener('click', closeSummaryModal);

  // Keypad modal interactions
  document.getElementById('closeModalBtn').addEventListener('click', closeNumpadModal);
  document.getElementById('modalConfirmBtn').addEventListener('click', closeNumpadModal);

  // Custom Prompt Modal handlers
  document.getElementById('confirmPromptBtn').addEventListener('click', () => {
    const val = document.getElementById('promptInput').value;
    closeCustomPrompt(val);
  });
  document.getElementById('cancelPromptBtn').addEventListener('click', () => closeCustomPrompt(null));
  document.getElementById('closePromptBtn').addEventListener('click', () => closeCustomPrompt(null));
  document.getElementById('promptInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      closeCustomPrompt(document.getElementById('promptInput').value);
    } else if (e.key === 'Escape') {
      closeCustomPrompt(null);
    }
  });

  // Custom Confirm Modal handlers
  document.getElementById('okConfirmBtn').addEventListener('click', () => closeCustomConfirm(true));
  document.getElementById('cancelConfirmBtn').addEventListener('click', () => closeCustomConfirm(false));
  document.getElementById('closeConfirmBtn').addEventListener('click', () => closeCustomConfirm(false));

  // Close modals on backdrop click
  document.getElementById('inputModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeNumpadModal();
  });
  document.getElementById('summaryModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSummaryModal();
  });
  document.getElementById('promptModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCustomPrompt(null);
  });
  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCustomConfirm(false);
  });

  // Modal Next / Prev Denomination navigation
  document.getElementById('modalNextDenomBtn').addEventListener('click', () => {
    applyModalValue();
    if (activeModalDenomIndex < DENOMINATIONS.length - 1) {
      openNumpadModal(activeModalDenomIndex + 1);
    }
  });
  document.getElementById('modalPrevDenomBtn').addEventListener('click', () => {
    applyModalValue();
    if (activeModalDenomIndex > 0) {
      openNumpadModal(activeModalDenomIndex - 1);
    }
  });

  // Enable mouse wheel horizontal scrolling on the tabs container
  const tabsContainer = document.getElementById('pilesTabs');
  tabsContainer.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      tabsContainer.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const addVal = parseInt(chip.dataset.add, 10);
      handleQuickAdd(addVal);
    });
  });

  // Numpad Keys
  document.querySelectorAll('.num-key').forEach(keyBtn => {
    keyBtn.addEventListener('click', () => {
      handleKeypadPress(keyBtn.dataset.key);
    });
  });

  // Double click pile tab to rename
  document.getElementById('pilesTabs').addEventListener('dblclick', async (e) => {
    const pileTab = e.target.closest('.pile-tab');
    if (pileTab) {
      const pileId = pileTab.dataset.id;
      const pile = appState.piles.find(p => p.id === pileId);
      if (pile) {
        const newName = await showCustomPrompt('Stapel umbenennen', pile.name);
        if (newName && newName.trim()) {
          pile.name = newName.trim();
          renderPileTabs();
          updateCalculations();
          showToast(`Umbenannt in "${pile.name}"`);
        }
      }
    }
  });
}

// Register Service Worker for PWA (Offline & Installable)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('ServiceWorker registered:', reg.scope);
    }).catch((err) => {
      console.log('ServiceWorker registration failed:', err);
    });
  });
}

// Start app on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
