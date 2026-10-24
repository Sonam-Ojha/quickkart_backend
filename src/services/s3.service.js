const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp  = require('sharp');
const crypto = require('crypto');
const fs     = require('fs/promises');
const path   = require('path');

const BUCKET      = process.env.AWS_S3_BUCKET_NAME;
const REGION      = process.env.AWS_REGION || 'ap-south-1';
const MAX_SIDE    = 900;   // resize larger images down
const WEBP_QUALITY = 82;   // good quality, reasonable size

// ── Storage backend ───────────────────────────────────────────────────────────
// Use S3 only when credentials + bucket are all present. Otherwise fall back to
// local disk (public/uploads, served at /uploads) so uploads work out of the box.
const S3_ENABLED = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  BUCKET
);

const LOCAL_DIR  = path.join(__dirname, '../../public/uploads');
const LOCAL_BASE = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

const s3 = S3_ENABLED
  ? new S3Client({
      region: REGION,
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

if (!S3_ENABLED) {
  console.warn('[s3] AWS S3 not configured — image uploads will be saved to local disk (public/uploads).');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function s3Url(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// Extract S3 key from a stored URL.
// "https://bucket.s3.region.amazonaws.com/products/123/uuid.webp" → "products/123/uuid.webp"
function keyFromUrl(url) {
  if (!url) return null;
  const s3Match = url.match(/amazonaws\.com\/(.+)$/);
  if (s3Match) return s3Match[1];
  const localMatch = url.match(/\/uploads\/(.+)$/);   // local-disk URLs
  return localMatch ? localMatch[1] : null;
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

  if (!S3_ENABLED) {
    const dest = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, optimised);
    return { key, url: `${LOCAL_BASE}/uploads/${key}` };
  }

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
  if (!S3_ENABLED) {
    await fs.rm(path.join(LOCAL_DIR, key), { force: true });
    return;
  }
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

// ── Raw file upload (for non-image files like PDFs) ──────────────────────────

const FILE_MIME = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt':  'application/vnd.oasis.opendocument.text',
  '.ods':  'application/vnd.oasis.opendocument.spreadsheet',
  '.odp':  'application/vnd.oasis.opendocument.presentation',
  '.rtf':  'application/rtf',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

async function uploadFile(buffer, originalName, scope = 'prints') {
  const ext         = path.extname(originalName).toLowerCase() || '.bin';
  const key         = `${scope}/${crypto.randomUUID()}${ext}`;
  const contentType = FILE_MIME[ext] || 'application/octet-stream';

  if (!S3_ENABLED) {
    const dest = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    return { key, url: `${LOCAL_BASE}/uploads/${key}` };
  }

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }));

  return { key, url: s3Url(key) };
}

// Short-lived link to a private object (KYC docs aren't public). Local-disk and
// non-S3 URLs are already openable, so they come back unchanged.
async function signedUrl(url, expiresIn = 600) {
  if (!S3_ENABLED || !url || !/amazonaws\.com\//.test(url)) return url;
  const key = keyFromUrl(url);
  if (!key) return url;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

module.exports = {
  FILE_MIME, uploadImage, uploadFile, deleteImage, deleteImageByUrl, replaceImage, keyFromUrl, s3Url, signedUrl };
