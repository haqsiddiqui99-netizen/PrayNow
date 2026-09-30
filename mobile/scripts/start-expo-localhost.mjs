import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchMetroWsLimits } from './patch-metro-ws.mjs';
import { patchMetroCors } from './patch-metro-cors.mjs';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.EXPO_METRO_PORT || '8081';
const isWindows = process.platform === 'win32';
const metroWorkers = process.env.REACT_NATIVE_MAX_WORKERS || (isWindows ? '1' : '2');

patchMetroWsLimits(mobileRoot);
patchMetroCors(mobileRoot);

console.log('\n>>> USB mode: phone must be plugged in with USB debugging on\n');
console.log(`>>> Open in Expo Go: exp://127.0.0.1:${port}\n`);

const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
  REACT_NATIVE_MAX_WORKERS: metroWorkers,
  METRO_MAX_WORKERS: process.env.METRO_MAX_WORKERS || metroWorkers,
};

const expoCli = join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli');
const child = spawn(process.execPath, [expoCli, 'start', '--localhost', '--clear', '--port', port], {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
