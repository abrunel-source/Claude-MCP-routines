import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { KeyProvider } from '@cadence/core';

/**
 * EnvAesKeyProvider — AES-256-GCM envelope encryption with the master key from
 * the environment. Format: base64(iv).base64(tag).base64(ciphertext).
 * Swap for CloudKmsKeyProvider later with no change to call sites.
 */
export class EnvAesKeyProvider implements KeyProvider {
  private readonly key: Buffer;

  constructor(masterKeyBase64: string) {
    const key = Buffer.from(masterKeyBase64, 'base64');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes, base64-encoded.');
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed ciphertext.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
