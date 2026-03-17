/**
 * AES-256-GCM encryption/decryption for sensitive credentials (e.g., app passwords).
 * Key source: EMAIL_ENCRYPTION_KEY env var (64-char hex) or SHA-256 of JWT_SECRET.
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
  if (process.env.EMAIL_ENCRYPTION_KEY) {
    return Buffer.from(process.env.EMAIL_ENCRYPTION_KEY, 'hex');
  }
  // Fallback: derive from JWT_SECRET
  const secret = process.env.JWT_SECRET || 'dev-fallback-secret-key';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {{ encrypted: string, iv: string, tag: string }} hex-encoded values
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt an encrypted string.
 * @param {string} encrypted  hex-encoded ciphertext
 * @param {string} iv         hex-encoded IV
 * @param {string} tag        hex-encoded auth tag
 * @returns {string} plaintext
 */
function decrypt(encrypted, iv, tag) {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
