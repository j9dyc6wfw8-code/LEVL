// Parses every .sql file with the REAL PostgreSQL parser (libpg-query), so a
// syntax error is caught here rather than in the Supabase SQL editor.
//
// TWO PASSES:
//
//   1. Outer statement syntax. Catches the classic ones — a reserved word used
//      as a column name in a RETURNS TABLE list, a missing comma, unbalanced
//      parentheses.
//
//   2. The body of every `LANGUAGE sql` function. Those bodies sit inside
//      dollar quotes, so pass 1 sees them as opaque strings — but Postgres
//      genuinely parses them at CREATE time (check_function_bodies is on by
//      default), so a typo in one fails the migration exactly like a top-level
//      error would.
//
// plpgsql bodies are NOT checked: they aren't SQL, and only the plpgsql
// validator understands them. Those still need a real database.
//
// Run:  node tools/check-sql.js  [--dir sql]
// Needs: npm i -D libpg-query   (or point LIBPG_PATH at an install elsewhere)
const fs = require('fs');
const path = require('path');

let pg;
try {
  pg = require(process.env.LIBPG_PATH || 'libpg-query');
} catch (e) {
  console.error('libpg-query is not installed. Run:  npm i -D libpg-query');
  process.exit(2);
}

const dir = path.resolve(process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1] : 'sql');

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// Every dollar-quoted block, paired with the LANGUAGE declared nearest before
// it. Handles $$ and $tag$ forms.
function sqlFunctionBodies(sql) {
  const out = [];
  const re = /\$([A-Za-z_]\w*)?\$/g;
  let open = null;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const tag = m[1] || '';
    if (!open) { open = { tag, start: m.index, end: m.index + m[0].length }; continue; }
    if (open.tag !== tag) continue;              // a different tag: not our closer
    const body = sql.slice(open.end, m.index);
    // Look at the text BEFORE the opening delimiter — slicing to `end` would
    // include the `$$` itself, and the [^$] guard below would never match.
    const before = sql.slice(0, open.start);
    const lang = /language\s+(\w+)[^$]*$/i.exec(before);
    if (lang && lang[1].toLowerCase() === 'sql') {
      out.push({ body, offset: open.end });
    }
    open = null;
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

(async () => {
  let bad = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const sql = fs.readFileSync(full, 'utf8');
    try {
      await pg.parse(sql);

      // Pass 2 — the SQL-language function bodies.
      const bodies = sqlFunctionBodies(sql);
      let bodyErr = null;
      for (const b of bodies) {
        try {
          await pg.parse(b.body);
        } catch (e) {
          bodyErr = { err: e, line: lineOf(sql, b.offset) };
          break;
        }
      }
      if (bodyErr) {
        bad++;
        console.log(`  ✗ ${f}  (in a LANGUAGE sql body starting line ${bodyErr.line})`);
        console.log(`      ${String(bodyErr.err.message || bodyErr.err).split('\n')[0]}`);
        continue;
      }

      const note = bodies.length ? `  (+${bodies.length} sql bodies)` : '';
      console.log(`  ✓ ${f}${note}`);
    } catch (err) {
      bad++;
      const msg = String((err && err.message) || err);
      // libpg-query reports a byte cursor; turn it into a line number.
      const m = /cursor position[: ]+(\d+)/i.exec(msg) || /at position (\d+)/i.exec(msg);
      let where = '';
      if (err && typeof err.cursorPosition === 'number') {
        const line = sql.slice(0, err.cursorPosition).split('\n').length;
        where = `  (line ${line})`;
      } else if (m) {
        const line = sql.slice(0, parseInt(m[1], 10)).split('\n').length;
        where = `  (line ${line})`;
      }
      console.log(`  ✗ ${f}${where}`);
      console.log(`      ${msg.split('\n')[0]}`);
    }
  }
  console.log(`\nparsed ${files.length} SQL file(s), ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
