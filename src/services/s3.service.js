const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp  = require('sharp');
const crypto = require('crypto');

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET      = process.env.AWS_S3_BUCKET_NAME;
const REGION      = process.env.AWS_REGION || 'ap-south-1';
const MAX_SIDE    = 900;   // resize larger images down
const WEBP_QUALITY = 82;   // good quality, reasonable size

// ── Helpers ───────────────────────────────────────────────────────────────────

function s3Url(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// Extract S3 key from a stored URL.
// "https://bucket.s3.region.amazonaws.com/products/123/uuid.webp" → "products/123/uuid.webp"
function keyFromUrl(url) {
  if (!url) return null;
  const match = url.match(/amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

// ── Core upload ───────────────────────────────────────────────────────────────

/**
 * Optimise image buffer with sharp → convert to WebP → upload to S3.
 * Returns { key, url }.
 *
 * @param {Buffer} buffer      Raw file buffer from multer memoryStorage
 * @param {string|number} scope  Used as path prefix, e.g. productId or "general"
 */
async function uploadImage(buffer, scope = 'general') {
  const optimised = await sharp(buffer)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const key = `products/${scope}/${crypto.randomUUID()}.webp`;

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        optimised,
    ContentType: 'image/webp',
  }));

  return { key, url: s3Url(key) };
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete an S3 object by key. Throws on failure — caller decides what to do.
 */
async function deleteImage(key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Convenience: delete by stored URL (extracts the key automatically).
 * Returns silently if the URL is not an S3 URL.
 */
async function deleteImageByUrl(url) {
  const key = keyFromUrl(url);
  if (key) await deleteImage(key);
}

// ── Replace (safe) ────────────────────────────────────────────────────────────

/**
 * Upload new image first, then delete old one.
 * If upload fails, old image is unaffected.
 * If delete fails, logs warning but returns new image info (don't block).
 */
async function replaceImage(newBuffer, oldUrl, scope = 'general') {
  const result = await uploadImage(newBuffer, scope);   // upload first
  if (oldUrl) {
    deleteImageByUrl(oldUrl).catch((err) =>             // delete old async
      console.warn('[s3] old image delete failed (orphan):', oldUrl, err.message),
    );
  }
  return result;
}

module.exports = { uploadImage, deleteImage, deleteImageByUrl, replaceImage, keyFromUrl, s3Url };
