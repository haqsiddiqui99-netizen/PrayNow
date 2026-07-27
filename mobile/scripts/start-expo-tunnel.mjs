import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('\n>>> Tunnel mode — works when Wi-Fi LAN times out (needs internet)\n');
console.log('>>> Scan the QR code when Metro starts (URL will be exp://....tunnel...\n');

const env = {
  ...process.env,
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
};

const child = spawn('npx', ['expo', 'start', '--tunnel', '--clear', '--port', '8081'], {
  cwd: mobileRoot,
  env,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
