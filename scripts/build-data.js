import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchShillerData, fetchYahooFinanceData, combineData } from '../server/dataProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log('Starting data build process...');
    console.log('1/3: Fetching Shiller historical data...');
    const shillerData = await fetchShillerData();
    console.log(`   -> Shiller data loaded: ${shillerData.length} records`);

    const lastShillerDate = shillerData[shillerData.length - 1].date;
    console.log(`2/3: Fetching Yahoo Finance data from ${lastShillerDate}...`);
    const yahooData = await fetchYahooFinanceData(lastShillerDate);
    console.log(`   -> Yahoo Finance data loaded: ${yahooData.length} records`);

    console.log('3/3: Combining datasets...');
    const combined = combineData(shillerData, yahooData);

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const outputPath = path.join(publicDir, 'data.json');
    fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
    console.log(`Successfully wrote combined data to ${outputPath}`);
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

main();
