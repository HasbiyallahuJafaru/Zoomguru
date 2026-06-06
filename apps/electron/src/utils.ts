export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function decodeJwtUserId(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string };
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

export async function makeDeviceHeaders(): Promise<Record<string, string>> {
  const token = await window.zoomguru.getToken();
  const userId = decodeJwtUserId(token);
  const { keyId, timestamp, signature } = await window.zoomguru.signRequest(userId);
  return {
    'X-Key-ID': keyId,
    'X-Timestamp': String(timestamp),
    'X-Signature': signature,
  };
}
