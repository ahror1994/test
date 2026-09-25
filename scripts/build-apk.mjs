// Builds installable release APKs (signed with the debug key) for the customer and supplier apps.
// The apps talk to the server at --url (default: this computer's LAN address, port 3000);
// the address can also be changed later inside the app on the login screen.
//
// Usage: node scripts/build-apk.mjs [customer|supplier] [--url http://192.168.0.4:3000] [--all-abis]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const APPS = {
  customer: { dir: 'apps/customer', out: 'Taptym.apk' },
  supplier: { dir: 'apps/supplier', out: 'Taptym-Business.apk' },
};
const selected = argv.filter((a) => a in APPS);
const targets = selected.length ? selected : Object.keys(APPS);

function lanIp() {
  const addrs = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const rank = (a) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3);
  return addrs.sort((a, b) => rank(a) - rank(b))[0] ?? 'localhost';
}

const apiUrl = (opt('--url') ?? process.env.EXPO_PUBLIC_API_URL ?? `http://${lanIp()}:${process.env.PORT ?? 3000}`).replace(/\/$/, '');
const abis = argv.includes('--all-abis') ? 'armeabi-v7a,arm64-v8a,x86,x86_64' : 'arm64-v8a';

const env = { ...process.env, EXPO_PUBLIC_API_URL: apiUrl, NODE_ENV: 'production', CI: '1', EXPO_NO_GIT_STATUS: '1' };
const firstExisting = (paths) => paths.filter(Boolean).find((p) => existsSync(p));
env.JAVA_HOME ||= firstExisting([
  isWin && 'C:\\Program Files\\Android\\Android Studio\\jbr',
  '/usr/lib/jvm/java-17-openjdk-amd64',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
]);
env.ANDROID_HOME ||= firstExisting([
  process.env.ANDROID_SDK_ROOT,
  isWin && join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
  join(homedir(), 'Android', 'Sdk'),
  join(homedir(), 'Library', 'Android', 'sdk'),
  '/opt/android-sdk',
]);
if (!env.JAVA_HOME || !env.ANDROID_HOME) {
  console.error('Нужны Android Studio (JDK) и Android SDK. JAVA_HOME:', env.JAVA_HOME, 'ANDROID_HOME:', env.ANDROID_HOME);
  process.exit(1);
}

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n  (${cwd})`);
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) throw new Error(`${cmd} завершился с ошибкой (${r.status ?? r.signal})`);
}

console.log(`Сервер для приложений: ${apiUrl}\nАрхитектуры: ${abis}`);
mkdirSync(join(root, 'apk'), { recursive: true });

for (const name of targets) {
  const app = APPS[name];
  const dir = join(root, app.dir);
  const pkgPath = join(dir, 'package.json');
  const pkgBefore = readFileSync(pkgPath, 'utf8');
  try {
    run('npx', ['expo', 'prebuild', '-p', 'android', '--clean', '--no-install'], dir);
  } finally {
    // prebuild rewrites npm scripts; keep the working tree clean for `git pull`.
    writeFileSync(pkgPath, pkgBefore);
  }
  try {
    run(isWin ? 'gradlew.bat' : './gradlew', ['assembleRelease', `-PreactNativeArchitectures=${abis}`, '--no-daemon'], join(dir, 'android'));
  } catch (e) {
    if (isWin) {
      console.error('\nЕсли ошибка про длинные пути (Filename longer than 260 characters), перенесите папку проекта в короткий путь, например C:\\taptym, и повторите.');
    }
    throw e;
  }
  const apk = join(dir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  copyFileSync(apk, join(root, 'apk', app.out));
  console.log(`\nГотово: apk/${app.out}`);
}
