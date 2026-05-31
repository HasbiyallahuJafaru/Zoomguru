import os from 'os';
import crypto from 'crypto';
import { networkInterfaces } from 'os';
import { execFileSync } from 'child_process';

function getFirstMAC(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (net) {
      for (const iface of net) {
        if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  }
  return 'unknown';
}

function getWindowsMachineGuid(): string {
  if (os.platform() !== 'win32') return '';
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', timeout: 3000 },
    );
    const match = output.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i);
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

export function getDeviceFingerprint(): string {
  const data = {
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCount: os.cpus().length,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    mac: getFirstMAC(),
    machineGuid: getWindowsMachineGuid(),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
