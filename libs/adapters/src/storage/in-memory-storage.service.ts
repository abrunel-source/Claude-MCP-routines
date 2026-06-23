import type { PutObjectInput, StorageService } from '@cadence/core';

/**
 * InMemoryStorageService — a working StorageService double for when no
 * S3-compatible endpoint is configured, so file flows (signed PDFs) run
 * end-to-end. Selected automatically when S3 credentials are absent. Not for
 * production (process-local, non-durable).
 */
export class InMemoryStorageService implements StorageService {
  private readonly store = new Map<string, Buffer>();

  async put(input: PutObjectInput): Promise<{ key: string }> {
    this.store.set(input.key, input.body);
    return { key: input.key };
  }

  async get(key: string): Promise<Buffer> {
    const v = this.store.get(key);
    if (!v) throw new Error(`Object not found: ${key}`);
    return v;
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return `memory://${key}`;
  }
}
