import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.EXPO_METRO_PORT || '8081';

console.log('\n>>> USB mode: phone must be plugged in with USB debugging on\n');
console.log(`>>> Open in Expo Go: exp://127.0.0.1:${port}\n`);

const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
};

const child = spawn('npx', ['expo', 'start', '--localhost', '--clear', '--port', port], {
  cwd: mobileRoot,
  env,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
