const fs = require('fs'), p = require('path');
const root = 'C:/Users/Lenovo/AppData/Local/Temp/gal-sync';
const src = 'C:/Users/Lenovo/.agents/skills/galgame-frontend';
for (const f of fs.readdirSync(root)) {
  if (f === '.git' || f === '_sync.cjs') continue;
  fs.rmSync(p.join(root, f), { recursive: true, force: true });
}
fs.copyFileSync(p.join(src, 'SKILL.md'), p.join(root, 'SKILL.md'));
fs.copyFileSync(p.join(src, 'LICENSE'), p.join(root, 'LICENSE'));
fs.mkdirSync(p.join(root, 'references'));
const refs = fs.readdirSync(p.join(src, 'references'));
for (const f of refs) fs.copyFileSync(p.join(src, 'references', f), p.join(root, 'references', f));
console.log('root:', fs.readdirSync(root).join(' | '));
console.log('refs:', refs.length);
