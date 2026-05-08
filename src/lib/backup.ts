import { db } from '@/db/schema'
import { markBackupNow } from '@/lib/diary-state'

const PBKDF2_ITERATIONS = 100_000
const SALT_LEN = 16
const IV_LEN = 12

interface EncryptedPayload {
  version: 1
  salt: string // base64
  iv: string // base64
  ciphertext: string // base64
}

interface BackupData {
  version: 1
  exportedAt: number
  people: unknown[]
  facts: unknown[]
  episodes: unknown[]
  messages: unknown[]
}

/**
 * 비밀번호 + PBKDF2(SHA-256, 100K iter)로 키 유도.
 * 비밀번호 잊으면 영영 복호화 불가능 (의도된 설계).
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  )

  const payload: EncryptedPayload = {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(payload)
}

async function decrypt(encryptedJson: string, password: string): Promise<string> {
  const payload = JSON.parse(encryptedJson) as EncryptedPayload
  if (payload.version !== 1) {
    throw new Error(`지원하지 않는 백업 버전: ${payload.version}`)
  }

  const salt = base64ToBytes(payload.salt)
  const iv = base64ToBytes(payload.iv)
  const key = await deriveKey(password, salt)

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      base64ToBytes(payload.ciphertext) as BufferSource,
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error('비밀번호가 틀렸거나 파일이 손상됨')
  }
}

export async function exportBackup(password: string): Promise<string> {
  const data: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    people: await db.people.toArray(),
    facts: await db.facts.toArray(),
    episodes: await db.episodes.toArray(),
    messages: await db.messages.toArray(),
  }
  const encrypted = await encrypt(JSON.stringify(data), password)
  markBackupNow()
  return encrypted
}

export interface RestoreResult {
  people: number
  facts: number
  episodes: number
  messages: number
  exportedAt: Date
}

/**
 * 백업 파일에서 복원. 기본은 'replace' — 기존 데이터 전부 덮어씀.
 * (merge는 ID 충돌 처리가 복잡해서 MVP에서는 미지원)
 */
export async function restoreBackup(
  encryptedJson: string,
  password: string,
): Promise<RestoreResult> {
  const json = await decrypt(encryptedJson, password)
  const data = JSON.parse(json) as BackupData

  if (data.version !== 1) {
    throw new Error(`지원하지 않는 백업 데이터 버전: ${data.version}`)
  }

  await db.transaction('rw', [db.people, db.facts, db.episodes, db.messages], async () => {
    await db.people.clear()
    await db.facts.clear()
    await db.episodes.clear()
    await db.messages.clear()
    await db.people.bulkAdd(data.people as never)
    await db.facts.bulkAdd(data.facts as never)
    await db.episodes.bulkAdd(data.episodes as never)
    await db.messages.bulkAdd(data.messages as never)
  })

  return {
    people: data.people.length,
    facts: data.facts.length,
    episodes: data.episodes.length,
    messages: data.messages.length,
    exportedAt: new Date(data.exportedAt),
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
