// Scheduler + JobRunner ports — implemented by PostgresJobRunner + HttpCronScheduler.
// Portable from Vercel Cron to Cloud Scheduler with no logic change.

export interface JobDefinition {
  type: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
}

export interface JobRecord {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface JobRunner {
  /** Enqueue a job into the Postgres-backed job table. */
  enqueue(job: JobDefinition): Promise<{ id: string }>;
  /** Drain due jobs — invoked by the protected worker endpoint on each cron tick. */
  drain(limit: number): Promise<{ processed: number; failed: number }>;
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export interface Scheduler {
  /** Register a handler for a job type. */
  register(type: string, handler: JobHandler): void;
  getHandler(type: string): JobHandler | undefined;
}
