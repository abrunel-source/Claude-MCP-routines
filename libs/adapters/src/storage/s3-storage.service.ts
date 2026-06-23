import type { PutObjectInput, StorageService } from '@cadence/core';

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * S3StorageService — works against any S3-compatible endpoint (Supabase Storage,
 * Cloudflare R2, GCS XML API). Uses @aws-sdk/client-s3, imported dynamically so
 * the workspace builds without it; install the SDK to activate.
 */
export class S3StorageService implements StorageService {
  constructor(private readonly config: S3Config) {}

  private async client(): Promise<any> {
    const { S3Client } = await import('@aws-sdk/client-s3' as any);
    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<{ key: string }> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3' as any);
    const c = await this.client();
    await c.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key };
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3' as any);
    const c = await this.client();
    const res = await c.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3' as any);
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner' as any);
    const c = await this.client();
    return getSignedUrl(c, new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}
