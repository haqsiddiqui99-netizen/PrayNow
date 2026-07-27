import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.EXPO_METRO_PORT || '8081';

console.log(`\nSetting up adb reverse tcp:${port} -> tcp:${port} ...\n`);

const adb = spawnSync('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], {
  cwd: mobileRoot,
  encoding: 'utf8',
  shell: true,
});

if (adb.status !== 0) {
  console.error(adb.stderr || adb.stdout || 'adb reverse failed');
  console.error('\nMake sure:');
  console.error('  1. Phone is connected by USB');
  console.error('  2. USB debugging is enabled');
  console.error('  3. You accepted the debugging prompt on the phone');
  console.error('  4. adb is installed (Android platform-tools)\n');
  process.exit(adb.status ?? 1);
}

console.log('adb reverse OK. Starting Metro...\n');

const start = spawnSync('node', ['scripts/start-expo-localhost.mjs'], {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: true,
});

process.exit(start.status ?? 0);
