import { compare, hash } from "bcryptjs";

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;
const PASSWORD_ROUNDS = 12;

export function isPasswordHash(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return BCRYPT_PREFIX.test(value);
}

export async function hashPassword(value: string) {
  return hash(value, PASSWORD_ROUNDS);
}

export async function verifyPassword(candidate: string, storedValue: string | null | undefined) {
  if (!storedValue) {
    return false;
  }

  if (!isPasswordHash(storedValue)) {
    return candidate === storedValue;
  }

  return compare(candidate, storedValue);
}
