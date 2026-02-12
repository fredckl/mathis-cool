import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = pkg.version ?? '0.0.0';

const targetPath = join(__dirname, '..', 'public', 'version.js');
const fileContent = `self.__MATHIS_COOL_VERSION__ = 'v${version}';\n`;

writeFileSync(targetPath, fileContent, 'utf-8');
console.log(`Generated version.js with version v${version}`);
