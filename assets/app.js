import { init, t, locale, apply, currentLang } from './i18n.js';
import { init as initTheme } from './theme.js';
import { mountToolbar, refreshToolbar } from './controls.js';
import { sourcesHtml } from './sources.js';
import {
  lookupWallet, formatUsd, formatAmount, sortRows, detectAddressType, normalizeAddress,
} from './lookup.js';

init();
initTheme();
mountToolbar(document.getElementById('toolbar'), { t });

const form = document.getElementById('search-form');
const input = document.getElementById('address');
const msg = document.getElementById('message');
const summary = document.getElementById('summary');
const results = document.getElementById('results');
const tbody = document.getElementById('tbody');
const submitBtn = document.getElementById('submit-btn');
const searchSlow = document.getElementById('search-slow');
const hideSmall = document.getElementById('hide-small');
const hideThreshold = document.getElementById('hide-threshold');
const footerSources = document.getElementById('footer-sources');
const footerNote = document.getElementById('footer-note');

let abort;
let allRows = [];
let currentAddress = '';
let sortCol = 'usd';
let sortDir = 'desc';

function showMessage(text, kind = 'error') {
  msg.textContent = text;
  msg.className = `msg ${kind}`;
  msg.classList.remove('hidden');
}

function hideMessage() {
  msg.classList.add('hidden');
}

let searchSlowTimer;

function hideSearchSlow() {
  clearTimeout(searchSlowTimer);
  searchSlowTimer = null;
  searchSlow?.classList.add('hidden');
}

function armSearchSlowHint() {
  hideSearchSlow();
  searchSlowTimer = setTimeout(() => {
    if (!submitBtn.disabled) return;
    searchSlow.textContent = t('searchSlow');
    searchSlow.classList.remove('hidden');
  }, 5000);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function tokenIcon(row) {
  const letter = (row.symbol || '?').charAt(0).toUpperCase();
  if (!row.icon) return `<span class="badge" aria-hidden="true">${letter}</span>`;
  return `<img src="${esc(row.icon)}" alt="" width="28" height="28" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge',textContent:'${letter}'}))" />`;
}

function validatorCell(row) {
  if (row.kind !== 'staking' || !row.validator) {
    return `<span class="muted-cell">${esc(t('validatorUnknown'))}</span>`;
  }
  if (row.validatorUrl) {
    return `<a href="${esc(row.validatorUrl)}" target="_blank" rel="noopener noreferrer">${esc(row.validator)}</a>`;
  }
  return esc(row.validator);
}

function filteredRows() {
  let rows = allRows;
  if (hideSmall.checked) {
    const min = Number(hideThreshold.value) || 0;
    rows = rows.filter((r) => r.usd != null && r.usd >= min);
  }
  return sortRows(rows, sortCol, sortDir);
}

function updateSortIndicators() {
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === sortCol);
    th.dataset.dir = th.dataset.sort === sortCol ? sortDir : '';
  });
}

function renderTable() {
  const rows = filteredRows();
  tbody.innerHTML = rows
    .map(
      (r) => `<tr>
        <td><div class="token-cell">${tokenIcon(r)}<div><div class="token-name">${esc(r.symbol)}</div><div class="token-sub">${esc(r.name)} · ${esc(r.chain)}</div></div></div></td>
        <td data-value="${r.amountNum}">${esc(formatAmount(r.amount, locale()))}</td>
        <td data-value="${r.usd ?? ''}">${esc(formatUsd(r.usd, locale(), r.usdEstimated))}</td>
        <td>${validatorCell(r)}</td>
      </tr>`,
    )
    .join('');

  const total = rows.reduce((s, r) => s + (r.usd ?? 0), 0);
  document.getElementById('total-usd').textContent = formatUsd(total, locale());
  updateSortIndicators();
}

let lastSourcesUsed = [];

function hideSources() {
  if (footerSources) {
    footerSources.innerHTML = '';
    footerSources.classList.add('hidden');
  }
  footerNote?.classList.add('hidden');
}

function showSources(ids) {
  if (!footerSources) return;
  lastSourcesUsed = ids;
  const html = sourcesHtml(ids, currentLang());
  if (!html) {
    hideSources();
    return;
  }
  footerSources.innerHTML = html;
  footerSources.classList.remove('hidden');
  footerNote?.classList.remove('hidden');
}

async function runSearch(address) {
  hideMessage();
  hideSearchSlow();
  hideSources();
  abort?.abort();
  abort = new AbortController();

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> ${t('searching')}`;
  armSearchSlowHint();

  try {
    const data = await lookupWallet(address, { signal: abort.signal });
    allRows = data.rows;
    currentAddress = data.address;

    if (!allRows.length) {
      summary.classList.add('hidden');
      results.classList.add('hidden');
      showMessage(t('noResults'), 'warn');
      showSources(data.sourcesUsed || []);
      return;
    }

    document.getElementById('networks').textContent = data.chainsHit.join(', ') || '—';
    renderTable();
    summary.classList.remove('hidden');
    results.classList.remove('hidden');
    showSources(data.sourcesUsed || []);

    history.replaceState(null, '', `?address=${encodeURIComponent(data.address)}`);
  } catch (e) {
    if (e.name === 'AbortError') return;
    summary.classList.add('hidden');
    results.classList.add('hidden');
    hideSources();
    showMessage(e.message === 'invalid_address' ? t('invalidAddress') : t('error'));
  } finally {
    hideSearchSlow();
    submitBtn.disabled = false;
    submitBtn.textContent = t('search');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = normalizeAddress(input.value);
  if (detectAddressType(raw) === 'unknown') {
    showMessage(t('invalidAddress'));
    return;
  }
  runSearch(raw);
});

document.querySelectorAll('th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortCol = col;
      sortDir = col === 'token' || col === 'validator' ? 'asc' : 'desc';
    }
    renderTable();
  });
});

hideSmall.addEventListener('change', renderTable);
hideThreshold.addEventListener('input', () => {
  if (hideSmall.checked) renderTable();
});

document.addEventListener('fmc:langchange', () => {
  apply();
  refreshToolbar({ t });
  if (!submitBtn.disabled) submitBtn.textContent = t('search');
  if (searchSlow && !searchSlow.classList.contains('hidden')) {
    searchSlow.textContent = t('searchSlow');
  }
  if (allRows.length) renderTable();
  if (lastSourcesUsed.length) showSources(lastSourcesUsed);
});

hideSources();

const params = new URLSearchParams(location.search);
const q = params.get('address');
if (q && detectAddressType(q) !== 'unknown') {
  input.value = q;
  runSearch(normalizeAddress(q));
}
