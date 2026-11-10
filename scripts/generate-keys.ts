import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import nacl from 'tweetnacl'

const dir = 'keys'
const secretPath = `${dir}/store-secret.txt`

if (existsSync(secretPath)) {
  console.error('keys/store-secret.txt already exists; refusing to overwrite.')
  process.exit(1)
}

mkdirSync(dir, { recursive: true })
const keyPair = nacl.sign.keyPair()
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

writeFileSync(`${dir}/store-public.txt`, `${encode(keyPair.publicKey)}\n`)
writeFileSync(secretPath, `${encode(keyPair.secretKey)}\n`)

console.log('Wrote keys/store-public.txt and keys/store-secret.txt')
console.log(`public key: ${encode(keyPair.publicKey)}`)
console.log('Keep keys/store-secret.txt offline. It is gitignored.')
