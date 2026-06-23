const ITERATIONS = 250_000

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromB64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

export function randomSaltB64(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

export async function deriveKey(password: string, saltB64: string, iterations: number = ITERATIONS): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function computeVerifier(key: CryptoKey, verifySaltB64: string): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', rawKey, 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(verifySaltB64), iterations: 1, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return toB64(bits)
}

export interface EncryptedBlob {
  iv: string
  ciphertext: string
}

export interface SecretPlaintext {
  value: string
  username?: string
  url?: string
  notes?: string
}

export async function encryptBlob(key: CryptoKey, data: SecretPlaintext): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  )
  return { iv: toB64(iv.buffer), ciphertext: toB64(ct) }
}

export async function decryptBlob(key: CryptoKey, iv: string, ciphertext: string): Promise<SecretPlaintext> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(ciphertext)
  )
  return JSON.parse(new TextDecoder().decode(pt))
}

export { ITERATIONS }
