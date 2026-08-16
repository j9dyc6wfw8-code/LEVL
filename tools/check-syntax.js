const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const skip = new Set(['node_modules', '.git', 'ios', 'android', '.claude', '.expo']);
let files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);
let bad = 0;
for (const f of files) {
  try {
    babel.parseSync(fs.readFileSync(f, 'utf8'), {
      filename: f, presets: ['babel-preset-expo'], babelrc: false, configFile: false,
    });
  } catch (err) {
    bad++;
    console.log('✗ ' + path.relative(root, f));
    console.log('   ' + String(err.message).split('\n')[0]);
  }
}
console.log(`\nparsed ${files.length} files, ${bad} failed`);
process.exit(bad ? 1 : 0);
