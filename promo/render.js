/* LEVL reel renderer — deterministic frame capture piped straight into ffmpeg. */
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const W = 1080, H = 1920;
const FPS = Number(process.env.FPS || 60);
const SRC = process.env.SRC || 'reel.html';
const OUT = process.env.OUT || path.join(__dirname, 'out', path.basename(SRC, '.html') + '.mp4');
const PREVIEW = process.env.PREVIEW ? process.env.PREVIEW.split(',').map(Number) : null;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, SRC), { waitUntil: 'load' });
  await page.waitForFunction('window.READY === true');
  const duration = await page.evaluate(() => window.DURATION);

  // ---- preview mode: dump a handful of stills for inspection
  if (PREVIEW) {
    const dir = path.join(__dirname, 'preview', path.basename(SRC, '.html'));
    fs.mkdirSync(dir, { recursive: true });
    for (const t of PREVIEW) {
      await page.evaluate((tt) => window.renderAt(tt), t);
      const f = path.join(dir, 'f_' + String(t).replace('.', '_') + 's.png');
      await page.screenshot({ path: f });
      console.log('preview', f);
    }
    await browser.close();
    return;
  }

  const total = Math.round(duration * FPS);
  console.log(`rendering ${total} frames @ ${FPS}fps (${duration.toFixed(2)}s) -> ${OUT}`);

  const args = [
    '-y',
    '-f', 'image2pipe', '-vcodec', 'png', '-r', String(FPS), '-i', 'pipe:0',
    // silent stereo track: some uploaders choke on a video-only file
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-x264-params', 'keyint=' + FPS * 2 + ':min-keyint=' + FPS,
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-r', String(FPS),
    OUT,
  ];
  const ff = spawn(ffmpegPath, args, { stdio: ['pipe', 'inherit', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr += d.toString(); });
  const done = new Promise((res, rej) => {
    ff.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg exit ' + code + '\n' + ffErr.slice(-3000))));
  });

  const write = (buf) => new Promise((res) => {
    if (ff.stdin.write(buf)) return res();
    ff.stdin.once('drain', res);
  });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.renderAt(tt), t);
    const buf = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    await write(buf);
    if (i % 60 === 0 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      const pct = ((i + 1) / total * 100).toFixed(1);
      const eta = el / (i + 1) * (total - i - 1);
      process.stdout.write(`\r  ${pct}%  frame ${i + 1}/${total}  elapsed ${el.toFixed(0)}s  eta ${eta.toFixed(0)}s   `);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
  const sz = fs.statSync(OUT).size;
  console.log(`\ndone: ${OUT}  (${(sz / 1048576).toFixed(1)} MB)`);
})().catch(e => { console.error('\nFAILED:', e); process.exit(1); });
