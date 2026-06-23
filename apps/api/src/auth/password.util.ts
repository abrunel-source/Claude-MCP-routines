import * as argon2 from 'argon2';
import { env } from '../config/env';

const opts: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: env.argon2.memoryCost,
  timeCost: env.argon2.timeCost,
  parallelism: env.argon2.parallelism,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, opts);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
