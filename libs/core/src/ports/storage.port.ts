// StorageService port — implemented by S3StorageService (any S3-compatible endpoint).

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageService {
  put(input: PutObjectInput): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  /** Time-limited signed URL for client download. */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
