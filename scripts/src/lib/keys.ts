// Member keys on disk: ~/.near-credentials/settlekeys/<company>/<member>.json
// A file holds a name, the public key, and the private key. Never inside the repo.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { KeyPair, type KeyPairString } from "near-api-js";
import { KEYS_DIR } from "./config.js";

export interface StoredKey {
  name: string;
  public_key: string;
  private_key: KeyPairString;
}

export function keyPath(company: string, member: string): string {
  return join(KEYS_DIR, company, `${member.toLowerCase()}.json`);
}

export function loadKey(company: string, member: string): StoredKey {
  const path = keyPath(company, member);
  if (!existsSync(path)) {
    throw new Error(`no key for ${member} at ${path}. Issue one with: pnpm near:member --name ${member}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as StoredKey;
}

export function saveKey(company: string, member: string, key: StoredKey): string {
  const path = keyPath(company, member);
  mkdirSync(join(KEYS_DIR, company), { recursive: true });
  writeFileSync(path, JSON.stringify(key, null, 2) + "\n", { mode: 0o600 });
  return path;
}

export function listKeys(company: string): string[] {
  const dir = join(KEYS_DIR, company);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

/** A fresh ed25519 key pair for a new member. */
export function newKey(name: string): StoredKey {
  const pair = KeyPair.fromRandom("ed25519");
  return {
    name,
    public_key: pair.getPublicKey().toString(),
    private_key: pair.toString(),
  };
}
