import { safeStorage } from 'electron'

/** Giải mã chuỗi base64 đã mã hoá bằng Windows (DPAPI); null nếu hỏng hoặc không phải của máy/tài khoản này */
export function decrypt(enc: string): string | null {
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

export function encrypt(plain: string): string | null {
  return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plain).toString('base64') : null
}
