// Parse-check changed files with the project's own babel config.
const ROOT = require('path').resolve(__dirname, '..');
const babel = require(ROOT + '/node_modules/@babel/core');
const fs = require('fs');
const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const p = f.startsWith('/') ? f : ROOT + '/' + f;
  try {
    babel.transformSync(fs.readFileSync(p, 'utf8'), {
      filename: p,
      presets: [ROOT + '/node_modules/babel-preset-expo'],
      babelrc: false, configFile: false,
    });
    console.log('OK   ' + f);
  } catch (e) {
    bad++;
    console.log('FAIL ' + f + '\n     ' + e.message.split('\n')[0]);
  }
}
process.exit(bad ? 1 : 0);
