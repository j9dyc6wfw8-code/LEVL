/* A no-undef pass. Catches identifiers that resolve to nothing at runtime —
 * a deleted helper still referenced from a rarely-taken branch, a typo'd
 * variable, an import removed during a refactor. These never show up in a
 * render test unless that exact branch is rendered. */
const ROOT = require('path').resolve(__dirname, '..');
const fs = require('fs'), path = require('path');
const parser = require(ROOT + '/node_modules/@babel/parser');
const traverse = require(ROOT + '/node_modules/@babel/traverse').default;

const GLOBALS = new Set([
  'console','setTimeout','clearTimeout','setInterval','clearInterval','require','module','exports',
  'process','global','globalThis','__DEV__','fetch','Promise','JSON','Math','Date','Object','Array',
  'String','Number','Boolean','Error','TypeError','RangeError','Map','Set','WeakMap','WeakSet','Symbol',
  'RegExp','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','escape',
  'unescape','btoa','atob','URL','URLSearchParams','TextEncoder','TextDecoder','AbortController',
  'Intl','BigInt','Proxy','Reflect','queueMicrotask','structuredClone','undefined','NaN','Infinity',
  'FormData','Blob','File','FileReader','XMLHttpRequest','WebSocket','navigator','window','document',
  'performance','crypto','alert','requestAnimationFrame','cancelAnimationFrame','Uint8Array','ArrayBuffer',
  'Int32Array','Float32Array','DataView','arguments','this','Function','Headers','Request','Response',
]);

const files = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules') walk(p); }
    else if (f.endsWith('.js')) files.push(p);
  });
})(ROOT + '/src');
['App.js', 'index.js'].forEach((f) => files.push(ROOT + '/' + f));
['modules'].forEach((d) => { try { walk2(ROOT + '/' + d); } catch (e) {} });
function walk2(dir) {
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules' && f !== 'ios') walk2(p); }
    else if (f.endsWith('.js')) files.push(p);
  });
}

const findings = [];
files.forEach((file) => {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread'],
    });
  } catch (e) { findings.push({ file, line: 0, name: 'PARSE ERROR: ' + e.message }); return; }

  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (GLOBALS.has(name)) return;
      // JSX member expressions / property keys are not references to bindings.
      if (p.parentPath.isJSXMemberExpression && p.parentPath.isJSXMemberExpression()) return;
      if (p.scope.hasBinding(name, true)) return;
      // JSX intrinsic lowercase tags (<div/>) are not bindings either.
      if (p.parentPath.isJSXOpeningElement() && /^[a-z]/.test(name)) return;
      findings.push({ file: path.relative(ROOT, file), line: p.node.loc.start.line, name });
    },
  });
});

const seen = new Set();
const uniq = findings.filter((f) => {
  const k = f.file + ':' + f.line + ':' + f.name;
  if (seen.has(k)) return false; seen.add(k); return true;
});
uniq.forEach((f) => console.log(`${f.file}:${f.line}  undefined identifier: ${f.name}`));
console.log('\n' + uniq.length + ' finding(s) across ' + files.length + ' files.');
