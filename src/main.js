/**
 * main.js
 *
 * Entry point for the S&P 500 ERP Dashboard.
 * Fetches data from the backend API, initializes charts, and wires up UI controls.
 */

import { renderAllCharts } from './charts.js';

// ============================================
// State
// ============================================

let appState = {
  data: null,       // Full dataset from API
  stats: null,      // Summary statistics
  startYear: 1980,  // Current chart start year
  showEvents: true, // Show historical event highlights
};

// ============================================
// DOM References
// ============================================

const $loading = document.getElementById('loadingOverlay');
const $dashboard = document.getElementById('dashboard');
const $errorBanner = document.getElementById('errorBanner');
const $errorMessage = document.getElementById('errorMessage');
const $retryBtn = document.getElementById('retryBtn');

const $lastUpdated = document.getElementById('lastUpdated');
const $statPrice = document.getElementById('statPrice');
const $statPriceDetail = document.getElementById('statPriceDetail');
const $statEY = document.getElementById('statEY');
const $statGS10 = document.getElementById('statGS10');
const $statYieldDetail = document.getElementById('statYieldDetail');
const $statERP = document.getElementById('statERP');
const $statERPDetail = document.getElementById('statERPDetail');
const $cardERP = document.getElementById('cardERP');

const $toggleEvents = document.getElementById('toggleEvents');
const $refreshBtn = document.getElementById('refreshBtn');

// ============================================
// Data Fetching
// ============================================

async function fetchData(force = false) {
  const url = force ? '/api/combined?force=true' : '/api/combined';
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error: ${res.status}`);
  }
  return res.json();
}

// ============================================
// UI Updates
// ============================================

function showLoading() {
  $loading.classList.remove('fade-out', 'hidden');
}

function hideLoading() {
  $loading.classList.add('fade-out');
  setTimeout(() => $loading.classList.add('hidden'), 600);
}

function showDashboard() {
  $dashboard.classList.remove('hidden');
}

function showError(msg) {
  $errorMessage.textContent = msg;
  $errorBanner.classList.remove('hidden');
}

function hideError() {
  $errorBanner.classList.add('hidden');
}

/**
 * Animate a number from 0 to the target value inside an element.
 */
function animateValue(element, target, suffix = '', prefix = '', decimals = 2, duration = 800) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;

    if (decimals === 0) {
      element.textContent = `${prefix}${Math.round(current).toLocaleString()}${suffix}`;
    } else {
      element.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Update the summary cards with latest values.
 */
function updateSummaryCards(latest, stats) {
  // S&P 500 Price
  animateValue($statPrice, latest.price, '', '$', 0);
  $statPriceDetail.textContent = `最終更新: ${formatDate(latest.date)}${latest.source === 'yahoo' ? ' (リアルタイム)' : ' (月次)'}`;

  // Earnings Yield vs 10Y Treasury
  animateValue($statEY, latest.earningsYield, '%');
  animateValue($statGS10, latest.gs10, '%');
  const diff = latest.earningsYield - latest.gs10;
  const diffSign = diff >= 0 ? '+' : '';
  $statYieldDetail.textContent = `差分: ${diffSign}${diff.toFixed(2)}%pt`;

  // ERP
  animateValue($statERP, latest.erp, '%', latest.erp >= 0 ? '+' : '');

  // Color code the ERP card
  $cardERP.classList.remove('erp-card-positive', 'erp-card-warning', 'erp-card-negative');
  if (latest.erp > 2) {
    $statERP.className = 'stat-value erp-positive';
    $statERPDetail.textContent = `✅ 株式がリスクに見合うリターンを提供中（歴史的平均: ${stats.erp.mean}%）`;
  } else if (latest.erp > 0) {
    $statERP.className = 'stat-value erp-warning';
    $statERPDetail.textContent = `⚠️ リスクプレミアム縮小中 — 警戒水域（歴史的平均: ${stats.erp.mean}%）`;
  } else {
    $statERP.className = 'stat-value erp-negative';
    $statERPDetail.textContent = `🔴 リスクプレミアム消滅 — 債券優位（歴史的平均: ${stats.erp.mean}%）`;
  }

  // Last updated
  $lastUpdated.textContent = formatDateTime(stats.dateRange.to);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr) {
  return formatDate(dateStr);
}

// ============================================
// Controls
// ============================================

function setupPeriodButtons() {
  const buttons = document.querySelectorAll('.period-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Update active state
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Update chart
      appState.startYear = parseInt(btn.dataset.start, 10);
      redrawCharts();
    });
  });
}

function setupEventToggle() {
  $toggleEvents.addEventListener('change', () => {
    appState.showEvents = $toggleEvents.checked;
    redrawCharts();
  });
}

// ============================================
// Chart rendering
// ============================================

function redrawCharts() {
  if (!appState.data) return;
  renderAllCharts(appState.data, appState.startYear, appState.showEvents, appState.stats);
}

// Handle window resize for Plotly
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    Plotly.Plots.resize('chartPrice');
    Plotly.Plots.resize('chartYields');
    Plotly.Plots.resize('chartERP');
  }, 200);
});

// ============================================
// Initialization
// ============================================

async function init(force = false) {
  showLoading();
  hideError();
  $refreshBtn.disabled = true;

  try {
    const result = await fetchData(force);

    appState.data = result.data;
    appState.stats = result.stats;

    // Show dashboard
    showDashboard();

    // Update summary cards
    updateSummaryCards(result.latest, result.stats);

    // Setup controls
    // Only setup once
    if (!$refreshBtn.dataset.setup) {
      setupPeriodButtons();
      setupEventToggle();
      
      $refreshBtn.addEventListener('click', () => {
        init(true);
      });
      $refreshBtn.dataset.setup = 'true';
    }

    // Render charts
    redrawCharts();

    // Hide loading
    hideLoading();
  } catch (err) {
    console.error('Failed to load data:', err);
    hideLoading();
    showError(`データの取得に失敗しました: ${err.message}`);
  } finally {
    $refreshBtn.disabled = false;
  }
}

// Retry button
$retryBtn.addEventListener('click', () => {
  hideError();
  init();
});

// Start the app
init();
