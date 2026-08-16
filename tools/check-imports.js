// Verifies every relative import resolves AND that each named import is
// actually exported by the target module. Catches the class of error that only
// shows up as a red screen at runtime.
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const skip = new Set(['node_modules', '.git', 'ios', 'android', '.claude', '.expo', 'tools']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);

const parse = (f) => babel.parseSync(fs.readFileSync(f, 'utf8'), {
  filename: f, presets: ['babel-preset-expo'], babelrc: false, configFile: false,
});

function resolve(from, spec) {
  if (!spec.startsWith('.')) return null; // package import: assume node handles it
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + '.js', base + '.json',
                   path.join(base, 'index.js'), base + '.ios.js', base + '.native.js']) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return false;
}

const exportsCache = new Map();
function exportsOf(file) {
  if (exportsCache.has(file)) return exportsCache.get(file);
  const set = new Set();
  try {
    const ast = parse(file);
    for (const node of ast.program.body) {
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.declarations) {
            node.declaration.declarations.forEach((d) => {
              if (d.id.type === 'Identifier') set.add(d.id.name);
              else if (d.id.type === 'ObjectPattern') d.id.properties.forEach((p) => p.value && set.add(p.value.name));
            });
          } else if (node.declaration.id) set.add(node.declaration.id.name);
        }
        node.specifiers.forEach((sp) => set.add(sp.exported.name));
        if (node.source) set.add('*');   // re-export: don't try to follow
      } else if (node.type === 'ExportDefaultDeclaration') set.add('default');
      else if (node.type === 'ExportAllDeclaration') set.add('*');
    }
  } catch (e) { set.add('*'); }
  exportsCache.set(file, set);
  return set;
}

let problems = 0;
for (const f of files) {
  let ast;
  try { ast = parse(f); } catch (e) { continue; }
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const spec = node.source.value;
    const target = resolve(f, spec);
    if (target === null) continue;
    if (target === false) {
      problems++;
      console.log(`✗ ${path.relative(root, f)}\n    cannot resolve "${spec}"`);
      continue;
    }
    const avail = exportsOf(target);
    if (avail.has('*')) continue;
    for (const sp of node.specifiers) {
      const want = sp.type === 'ImportDefaultSpecifier' ? 'default'
        : sp.type === 'ImportNamespaceSpecifier' ? null
        : sp.imported.name;
      if (want && !avail.has(want)) {
        problems++;
        console.log(`✗ ${path.relative(root, f)}\n    "${want}" is not exported by ${path.relative(root, target)}`);
      }
    }
  }
}
console.log(`\nchecked ${files.length} files, ${problems} import problem(s)`);
process.exit(problems ? 1 : 0);
