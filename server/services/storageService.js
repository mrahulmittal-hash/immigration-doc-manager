/**
 * storageService.js — S3 file upload and pre-signed URL helpers
 *
 * When AWS credentials and S3_BUCKET_NAME are configured, all uploads go to S3.
 * When running locally without credentials, falls back to returning the local file path so
 * the app continues to work in development without an AWS account.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const BUCKET = process.env.S3_BUCKET_NAME;
const REGION = process.env.AWS_REGION || 'ca-central-1';

// Build S3 client lazily — only when credentials are actually present
let _s3 = null;
function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: REGION,
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }),
    });
  }
  return _s3;
}

/** Returns true when S3 is configured (bucket name + AWS region present) */
function isS3Enabled() {
  return !!(BUCKET && process.env.AWS_ACCESS_KEY_ID);
}

/**
 * Upload a file buffer to S3.
 *
 * @param {Buffer} buffer - File content
 * @param {string} originalName - Original filename for content-type detection
 * @param {string} folder - S3 prefix / virtual folder (e.g. 'documents', 'pif-documents')
 * @param {string} clientId - Client ID — used to namespace the S3 key
 * @returns {Promise<{ key: string, location: string }>}
 */
async function uploadToS3(buffer, originalName, folder, clientId) {
  const ext = path.extname(originalName);
  const key = `clients/${clientId}/${folder}/${uuidv4()}${ext}`;

  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeFromExt(ext),
    ServerSideEncryption: 'aws:kms', // SSE-KMS as per SDD
  }));

  return {
    key,
    location: `s3://${BUCKET}/${key}`,
  };
}

/**
 * Generate a pre-signed GET URL (15-minute expiry as per SDD).
 *
 * @param {string} key - S3 object key
 * @param {number} [expiresInSeconds=900] - Default 15 minutes
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresInSeconds = 900) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(getS3(), command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an object from S3.
 * @param {string} key
 */
async function deleteFromS3(key) {
  await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Multer storage configuration that uploads directly to S3 (when enabled)
 * or falls back to local disk.
 *
 * Returns { storage, isS3 } so callers know which mode is active.
 */
function createMulterStorage(folder, localSubDir) {
  if (isS3Enabled()) {
    const multerS3 = require('multer-s3');
    const storage = multerS3({
      s3: getS3(),
      bucket: BUCKET,
      serverSideEncryption: 'aws:kms',
      key: (req, file, cb) => {
        const clientId = req.params.clientId || req.params.token || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `clients/${clientId}/${folder}/${uuidv4()}${ext}`);
      },
    });
    return { storage, isS3: true };
  }

  // Local fallback
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', localSubDir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
  return { storage, isS3: false };
}

/**
 * Get a download URL for a stored file.
 * - If the path starts with 's3://' → generate a pre-signed URL.
 * - Otherwise → return a local /uploads/ URL.
 */
async function getDownloadUrl(filePath, req) {
  if (filePath && filePath.startsWith('s3://')) {
    // Extract S3 key from s3://bucket/key
    const key = filePath.replace(`s3://${BUCKET}/`, '');
    return getPresignedUrl(key);
  }
  // Local file — build a URL relative to the server origin
  const relativePath = filePath.replace(/\\/g, '/').split('uploads/').pop();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${relativePath}`;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function mimeFromExt(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  isS3Enabled,
  uploadToS3,
  getPresignedUrl,
  deleteFromS3,
  createMulterStorage,
  getDownloadUrl,
};
