/* Rules-of-Hooks audit via AST.
 * Flags a hook call that can be skipped on some renders: one sitting after an
 * early `return` at the top level of a component, or nested inside a condition
 * / loop / callback within the component body. React throws
 * "Rendered more hooks than during the previous render" when that flips. */
const ROOT = require('path').resolve(__dirname, '..');
const fs = require('fs'), path = require('path');
const parser = require(ROOT + '/node_modules/@babel/parser');
const traverse = require(ROOT + '/node_modules/@babel/traverse').default;

const HOOK = /^use[A-Z]/;
const files = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules') walk(p); }
    else if (f.endsWith('.js')) files.push(p);
  });
})(ROOT + '/src');
files.push(ROOT + '/App.js');

const findings = [];
files.forEach((file) => {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), {
    sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread'],
  });
  traverse(ast, {
    Function(fnPath) {
      const id = fnPath.node.id || (fnPath.parent && fnPath.parent.id);
      const name = id && id.name;
      // Components and custom hooks only.
      if (!name || !(/^[A-Z]/.test(name) || HOOK.test(name))) return;
      const body = fnPath.node.body;
      if (!body || body.type !== 'BlockStatement') return;

      // Index of the first top-level return in the component body.
      let firstReturn = -1;
      body.body.forEach((st, i) => {
        if (st.type === 'ReturnStatement' && firstReturn === -1) firstReturn = i;
        if (st.type === 'IfStatement' && firstReturn === -1) {
          const c = st.consequent;
          const hasReturn = c.type === 'ReturnStatement'
            || (c.type === 'BlockStatement' && c.body.some((x) => x.type === 'ReturnStatement'));
          if (hasReturn && !st.alternate) firstReturn = i;
        }
      });

      fnPath.traverse({
        CallExpression(cp) {
          const callee = cp.node.callee;
          const hookName = callee.type === 'Identifier' ? callee.name
            : (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') ? callee.property.name
            : null;
          if (!hookName || !HOOK.test(hookName)) return;
          // Belongs to a nested function? Then it is that function's problem.
          const owner = cp.getFunctionParent();
          if (owner.node !== fnPath.node) return;

          // Which top-level statement contains this hook?
          let stmt = cp;
          while (stmt.parentPath && stmt.parentPath.node !== body) stmt = stmt.parentPath;
          const idx = body.body.indexOf(stmt.node);

          if (firstReturn !== -1 && idx > firstReturn) {
            findings.push({
              file: path.relative(ROOT, file), line: cp.node.loc.start.line,
              name, hook: hookName,
              why: 'called AFTER an early return on line ' + body.body[firstReturn].loc.start.line,
            });
            return;
          }
          // Conditional / looped hook inside the component body.
          let p = cp.parentPath, bad = null;
          while (p && p.node !== body) {
            const t = p.node.type;
            if (t === 'IfStatement' || t === 'ConditionalExpression' || t === 'LogicalExpression'
              || t === 'ForStatement' || t === 'ForOfStatement' || t === 'WhileStatement'
              || t === 'SwitchStatement') { bad = t; break; }
            p = p.parentPath;
          }
          if (bad) {
            findings.push({
              file: path.relative(ROOT, file), line: cp.node.loc.start.line,
              name, hook: hookName, why: 'nested inside a ' + bad,
            });
          }
        },
      });
    },
  });
});

if (!findings.length) console.log('No rules-of-hooks violations found.');
findings.forEach((f) => console.log(`${f.file}:${f.line}  ${f.name}() — ${f.hook} ${f.why}`));
console.log('\n' + findings.length + ' finding(s) across ' + files.length + ' files.');
