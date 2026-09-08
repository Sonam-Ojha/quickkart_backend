/**
 * One-time migration: upload existing local product images to S3,
 * then update the database records with the new S3 URLs.
 *
 * Run AFTER setting up AWS credentials in .env:
 *   node scripts/migrate-images-to-s3.js
 *
 * It is SAFE to run multiple times — it skips products whose imageUrl
 * already points to S3 (amazonaws.com).
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const s3   = require('../src/services/s3.service');

// Load DB + model
const sequelize = require('../src/config/db');
require('../src/models/category.model');
const Product   = require('../src/models/product.model');

const LOCAL_BASE     = path.join(__dirname, '../public/uploads');
const SERVER_ORIGIN  = process.env.PUBLIC_URL || 'http://localhost:4000';

// Download a file from a URL into a Buffer (follows redirects)
function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Jhatpats/1.0)',
        'Accept': 'image/*,*/*',
      },
    }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        return resolve(fetchBuffer(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/')) {
        return reject(new Error(`Non-image content-type: ${ct}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function run() {
  await sequelize.authenticate();
  console.log('DB connected');

  const products = await Product.findAll({ where: { isActive: true } });
  console.log(`Found ${products.length} active products`);

  let migrated = 0, skipped = 0, failed = 0;

  for (const p of products) {
    const url = p.imageUrl;

    if (!url) { skipped++; continue; }

    // Already on S3 — skip
    if (url.includes('amazonaws.com')) {
      console.log(`  SKIP  #${p.id} (already S3)`);
      skipped++;
      continue;
    }

    try {
      let buffer;

      // Try local file first (faster)
      const filename  = url.split('/').pop();
      const localPath = path.join(LOCAL_BASE, filename);

      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
        console.log(`  LOCAL #${p.id} ${filename}`);
      } else {
        // Fall back to HTTP fetch
        const fetchUrl = url.startsWith('http') ? url : `${SERVER_ORIGIN}${url}`;
        console.log(`  HTTP  #${p.id} ${fetchUrl}`);
        buffer = await fetchBuffer(fetchUrl);
      }

      const { url: s3Url } = await s3.uploadImage(buffer, p.id);
      await p.update({ imageUrl: s3Url });
      console.log(`  ✓     #${p.id} → ${s3Url}`);
      migrated++;
    } catch (err) {
      console.error(`  ✗     #${p.id} FAILED:`, err.message);
      failed++;
      // Do NOT update DB — old URL stays, product still works
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
  if (failed > 0) {
    console.log('Re-run the script to retry failed products.');
  }
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
