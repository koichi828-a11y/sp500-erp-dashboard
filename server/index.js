import express from 'express';
import cors from 'cors';
import { fetchShillerData, fetchYahooFinanceData, combineData } from './dataProcessor.js';

const app = express();
app.use(cors());

// -------------------------------------------
// Cache layer
// -------------------------------------------
let cache = {
  combined: null,
  timestamp: 0,
};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes to avoid Yahoo Finance rate limits

// -------------------------------------------
// Routes
// -------------------------------------------

/**
 * GET /api/combined
 * Returns the merged Shiller + Yahoo Finance dataset with ERP calculations.
 * Supports ?force=true to bypass cache.
 */
app.get('/api/combined', async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.force === 'true';

    // Return cached data if fresh and force is not requested
    if (!force && cache.combined && now - cache.timestamp < CACHE_TTL) {
      console.log('[cache] Serving cached data');
      return res.json(cache.combined);
    }

    console.log(force ? '[fetch] Force reloading data...' : '[fetch] Downloading Shiller dataset...');
    const shillerData = await fetchShillerData();
    console.log(`[fetch] Shiller: ${shillerData.length} data points`);

    let yahooData = [];
    try {
      const lastShillerDate = shillerData[shillerData.length - 1].date;
      console.log(`[fetch] Yahoo Finance from ${lastShillerDate}...`);
      yahooData = await fetchYahooFinanceData(lastShillerDate);
      console.log(`[fetch] Yahoo Finance: ${yahooData.length} data points`);
    } catch (yfErr) {
      console.warn('[warn] Yahoo Finance fetch failed, using Shiller data only:', yfErr.message);
    }

    const result = combineData(shillerData, yahooData);

    // Update cache
    cache.combined = result;
    cache.timestamp = now;

    res.json(result);
  } catch (err) {
    console.error('[error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    cached: !!cache.combined,
    cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 1000) : null,
  });
});

// -------------------------------------------
// Start
// -------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  🚀 API server running at http://localhost:${PORT}`);
  console.log(`     GET /api/combined   — full dataset`);
  console.log(`     GET /api/health     — health check\n`);
});
