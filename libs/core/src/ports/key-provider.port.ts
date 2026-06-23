// KeyProvider port — implemented by EnvAesKeyProvider now, CloudKmsKeyProvider later.
// AES-256-GCM envelope encryption for tenant secrets (Stitch/Xero credentials).

export interface KeyProvider {
  /** Encrypt plaintext, returning a self-describing string (iv:tag:ciphertext, base64). */
  encrypt(plaintext: string): string;
  /** Decrypt a string previously produced by encrypt(). */
  decrypt(ciphertext: string): string;
}
