// LEVL — undefined-reference auditor (an ESLint no-undef equivalent).
// Catches BOTH plain identifiers (e.g. an un-threaded prop like onCreateInvite)
// AND JSX component tags (e.g. <Pressable> used without importing it).
// Both crash only at runtime, so `tsc`/parsers never see them.
//
// Run: node tools/find-undefined-refs.js $(find src -name '*.js') App.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

const GLOBALS = new Set(['console','setTimeout','clearTimeout','setInterval','clearInterval',
  'require','module','exports','process','global','__DEV__','Promise','JSON','Math','Object',
  'Array','String','Number','Boolean','Date','RegExp','Error','Map','Set','Symbol','parseInt',
  'parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','fetch','navigator',
  'window','document','undefined','NaN','Infinity','React','arguments','Intl','URL','AbortController']);

let problems = 0;
for (const file of process.argv.slice(2)) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) { console.log('PARSE-FAIL ' + file + ': ' + e.message); problems++; continue; }

  const seen = new Set();
  const report = (name, line, kind) => {
    const key = name + ':' + line;
    if (seen.has(key)) return;          // a JSX tag reports once, not twice
    seen.add(key);
    console.log(file + ':' + line + "  UNDEFINED " + kind + " '" + name + "'");
    problems++;
  };

  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name)) return;
      if (path.scope.hasBinding(name)) return;
      if (path.parentPath.isJSXOpeningElement() && /^[a-z]/.test(name)) return;
      report(name, path.node.loc.start.line, 'identifier');
    },
    // JSX component tags: <Foo /> and <Foo.Bar />. Lowercase tags are intrinsic.
    JSXOpeningElement(path) {
      let node = path.node.name;
      while (node.type === 'JSXMemberExpression') node = node.object;
      if (node.type !== 'JSXIdentifier') return;
      const name = node.name;
      if (/^[a-z]/.test(name)) return;          // <View> style intrinsics handled by RN import audit
      if (GLOBALS.has(name)) return;
      if (path.scope.hasBinding(name)) return;
      report(name, node.loc.start.line, 'JSX component');
    },
  });
}
console.log('\n' + problems + ' undefined reference(s).');
process.exit(problems ? 1 : 0);
