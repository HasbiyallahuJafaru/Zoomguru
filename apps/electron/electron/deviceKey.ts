import crypto from 'crypto';
import Store from 'electron-store';

interface KeyStore {
  keyId?: string;
  privateKey?: string;
}

const keyStore = new Store<KeyStore>({ name: 'device-key' });

let cachedKeyId: string | null = null;
let cachedPrivateKey: string | null = null;

function derivePublicKey(privateKeyPem: string): string {
  const privKey = crypto.createPrivateKey(privateKeyPem);
  return crypto.createPublicKey(privKey).export({ type: 'spki', format: 'pem' }) as string;
}

export function initDeviceKey(): { keyId: string; publicKey: string } {
  let keyId = keyStore.get('keyId');
  let privateKey = keyStore.get('privateKey');

  if (!keyId || !privateKey) {
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    keyId = crypto.randomUUID();
    privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    keyStore.set('keyId', keyId);
    keyStore.set('privateKey', privateKey);
  }

  cachedKeyId = keyId;
  cachedPrivateKey = privateKey;
  return { keyId, publicKey: derivePublicKey(privateKey) };
}

export function getPublicKeyInfo(): { keyId: string; publicKey: string } {
  if (!cachedKeyId || !cachedPrivateKey) return initDeviceKey();
  return { keyId: cachedKeyId, publicKey: derivePublicKey(cachedPrivateKey) };
}

export function signRequest(userId: string): { keyId: string; timestamp: number; signature: string } {
  if (!cachedKeyId || !cachedPrivateKey) initDeviceKey();
  const keyId = cachedKeyId!;
  const timestamp = Math.floor(Date.now() / 1000);
  const signer = crypto.createSign('SHA256');
  signer.update(`${userId}:${keyId}:${timestamp}`);
  const signature = signer.sign(cachedPrivateKey!, 'base64');
  return { keyId, timestamp, signature };
}
