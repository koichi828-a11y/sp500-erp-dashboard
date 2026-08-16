/**
 * dataProcessor.js
 *
 * Handles all data fetching, parsing and ERP (Equity Risk Premium) calculations.
 *
 * Data sources:
 *   1. Robert Shiller's historical S&P 500 dataset (Yale, .xls)
 *   2. Yahoo Finance real-time data for ^GSPC and ^TNX
 */

import * as XLSX from 'xlsx';

// ============================================
// 1. Shiller Historical Data
// ============================================

const SHILLER_URL = 'http://www.econ.yale.edu/~shiller/data/ie_data.xls';

/**
 * Downloads and parses Shiller's ie_data.xls.
 * Returns an array of { date, price, earnings, gs10, earningsYield, erp }.
 */
export async function fetchShillerData() {
  const response = await fetch(SHILLER_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (SP500-ERP-Dashboard)' },
  });

  if (!response.ok) {
    throw new Error(`Shiller download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets['Data'];

  if (!sheet) {
    throw new Error('Sheet "Data" not found in Shiller workbook');
  }

  // Convert to raw 2D array (all rows, no header inference)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // The first ~7 rows are description; row 8 (index 7) is the header.
  // Data starts from row 9 (index 8).
  const dataRows = rawRows.slice(8);

  const results = [];

  for (const row of dataRows) {
    const rawDate = row[0]; // YYYY.MM as a float (e.g. 2024.01)
    const price = parseFloat(row[1]); // S&P 500 price
    const earnings = parseFloat(row[3]); // Trailing 12m earnings
    const gs10 = parseFloat(row[6]); // 10-year government bond yield

    if (!rawDate || isNaN(price) || isNaN(earnings) || isNaN(gs10)) continue;
    if (price <= 0 || earnings <= 0) continue;

    const date = parseShillerDate(rawDate);
    if (!date) continue;

    const earningsYield = (earnings / price) * 100;
    const erp = earningsYield - gs10;

    results.push({ date, price, earnings, gs10, earningsYield, erp, source: 'shiller' });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parses Shiller's YYYY.MM float format into an ISO date string.
 *
 * Example: 2024.01 → "2024-01-01", 1987.1 → "1987-10-01"
 *
 * The float encodes month as the fractional × 100, e.g.
 *   2024.01 = Jan 2024, 2024.1 = Oct 2024, 2024.12 = Dec 2024
 */
function parseShillerDate(raw) {
  try {
    const val = parseFloat(raw);
    if (isNaN(val)) return null;

    const year = Math.floor(val);
    // Shiller uses YYYY.MM where MM is the actual month number after the decimal
    // e.g., 2024.01 means Jan, 2024.1 means Oct, 2024.12 means Dec
    const month = Math.round((val - year) * 100);

    if (month < 1 || month > 12 || year < 1800 || year > 2100) return null;

    return `${year}-${String(month).padStart(2, '0')}-01`;
  } catch {
    return null;
  }
}

// ============================================
// 2. Yahoo Finance Real-time Data
// ============================================

/**
 * Fetches daily close prices from Yahoo Finance for S&P 500 and 10Y Treasury.
 *
 * @param {string} startDate  ISO date string (YYYY-MM-DD) to start from.
 * @returns Array of { date, price, gs10, earningsYield, erp, source }
 */
export async function fetchYahooFinanceData(startDate) {
  // Calculate start date: day after the last Shiller data point
  const start = new Date(startDate);
  start.setDate(start.getDate() + 1);
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);

  // Direct Yahoo Finance v8 chart API (no library dependency)
  async function fetchYFChart(symbol, retries = 3) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (res.status === 429) {
          console.warn(`  [rate-limit] ${symbol} attempt ${attempt}/${retries}, waiting...`);
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 3000 * attempt));
            continue;
          }
          throw new Error(`Rate limited after ${retries} attempts`);
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error('No chart data returned');

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];

        const quotes = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] != null) {
            quotes.push({
              date: new Date(timestamps[i] * 1000),
              close: closes[i],
            });
          }
        }
        return quotes;
      } catch (err) {
        console.warn(`  [retry] ${symbol} attempt ${attempt}/${retries}: ${err.message}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        } else {
          throw err;
        }
      }
    }
    return [];
  }

  // Fetch sequentially to avoid rate limiting
  console.log('  -> Fetching ^GSPC...');
  const sp500Raw = await fetchYFChart('^GSPC');
  console.log(`  -> ^GSPC: ${sp500Raw.length} quotes`);

  // Small delay between requests
  await new Promise((r) => setTimeout(r, 500));

  console.log('  -> Fetching ^TNX...');
  const tnxRaw = await fetchYFChart('^TNX');
  console.log(`  -> ^TNX: ${tnxRaw.length} quotes`);

  // Build a lookup map for 10Y yields by date string
  const tnxByDate = new Map();
  for (const item of tnxRaw) {
    const key = toDateString(item.date);
    if (key && item.close != null) {
      tnxByDate.set(key, item.close);
    }
  }

  // Estimate current EPS based on year
  // These are approximate consensus values for the S&P 500
  function estimateEPS(dateStr) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    if (year <= 2023) return 200;
    if (year === 2024) return 220;
    if (year === 2025) return 240;
    return 252; // 2026+
  }

  const results = [];

  for (const item of sp500Raw) {
    const dateStr = toDateString(item.date);
    if (!dateStr) continue;

    const gs10 = tnxByDate.get(dateStr);
    if (gs10 == null || item.close == null) continue;

    const eps = estimateEPS(dateStr);
    const earningsYield = (eps / item.close) * 100;
    const erp = earningsYield - gs10;

    results.push({
      date: dateStr,
      price: item.close,
      earnings: eps,
      gs10,
      earningsYield,
      erp,
      source: 'yahoo',
    });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

function toDateString(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  try {
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// ============================================
// 3. Combine & Format for Frontend
// ============================================

/**
 * Merges Shiller and Yahoo Finance data and computes summary stats.
 */
export function combineData(shillerData, yahooData) {
  // Merge: Shiller is the base; Yahoo fills in recent daily data
  const allData = [...shillerData, ...yahooData];
  allData.sort((a, b) => a.date.localeCompare(b.date));

  // De-duplicate: if same date appears in both, prefer Yahoo (more recent)
  const seen = new Map();
  for (const d of allData) {
    seen.set(d.date, d);
  }
  const data = Array.from(seen.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Latest values
  const latest = data[data.length - 1];

  // ERP statistics
  const erpValues = data.map((d) => d.erp).filter((v) => !isNaN(v));
  const erpMean = erpValues.reduce((s, v) => s + v, 0) / erpValues.length;
  const erpMedian = percentile(erpValues, 0.5);
  const erpP25 = percentile(erpValues, 0.25);
  const erpP75 = percentile(erpValues, 0.75);

  return {
    data,
    latest: {
      date: latest.date,
      price: round2(latest.price),
      earnings: round2(latest.earnings),
      gs10: round2(latest.gs10),
      earningsYield: round2(latest.earningsYield),
      erp: round2(latest.erp),
      source: latest.source,
    },
    stats: {
      totalPoints: data.length,
      dateRange: { from: data[0].date, to: latest.date },
      erp: {
        mean: round2(erpMean),
        median: round2(erpMedian),
        p25: round2(erpP25),
        p75: round2(erpP75),
        current: round2(latest.erp),
      },
      shillerLastDate: shillerData[shillerData.length - 1]?.date || null,
    },
    meta: {
      lastUpdated: new Date().toISOString(),
      sources: ['Robert Shiller (Yale)', 'Yahoo Finance'],
    },
  };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
