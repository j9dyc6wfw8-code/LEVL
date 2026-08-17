/* ============================================================================
   LEVL REEL KIT — shared engine for every promo concept.

   Everything here is read from the app source:
     src/theme.js           -> C.*, RARITY, STAT colours
     src/engine/engine.js   -> TIERS, STATS, DUEL_TIERS rewards, PACK_XP_STEP
     src/components/TabIcon -> ICONS path data, verbatim
     src/navigation/routes  -> TABS
     assets/icon.png        -> L_PATH

   Concepts call LEVLKit.boot(), build their scene into K.world, then drive it
   from window.renderAt(t). Nothing reads the clock: renders are reproducible.
   ========================================================================== */
var LEVLKit = (function () {

/* ---------------------------------------------------------------- tokens -- */
const C = {
  sunken:'#090a0f', bg:'#0b0d13', bgElev:'#141720', panel:'#181c27',
  panel2:'#1f2431', panel3:'#272d3d', line:'#2c3344', lineSoft:'#212736',
  text:'#ffffff', mut:'#a7b0c0', dim:'#6b7488', faint:'#464e60', ink:'#0e1016',
  gold:'#ffc933', goldDeep:'#d99a1c',
  green:'#2fe39b', red:'#ff5c6e', purp:'#a66bff', blue:'#3d9bff',
  cyan:'#2fe0e0', orange:'#ff8a3d', pink:'#ff5fa2',
};
const TIERS = [
  { name:'Bronze', min:0, color:'#cd7f4a' }, { name:'Silver', min:600, color:'#c3ccdb' },
  { name:'Gold', min:1200, color:'#ffc933' }, { name:'Platinum', min:1800, color:'#2fe0e0' },
  { name:'Diamond', min:2400, color:'#3d9bff' }, { name:'Champion', min:3000, color:'#a66bff' },
  { name:'Grandmaster', min:3600, color:'#ff4d6d' },
];
const RARITY = [
  { k:'common', c:'#8e97a8', label:'Common' }, { k:'rare', c:'#3d9bff', label:'Rare' },
  { k:'epic', c:'#a66bff', label:'Epic' }, { k:'legendary', c:'#ff8a3d', label:'Legendary' },
  { k:'mythic', c:'#ff4d6d', label:'Mythic' },
];
const ICONS = {
  train:`<line x1="8" y1="12" x2="16" y2="12"/><rect x="3.5" y="9" width="3" height="6" rx="1"/><rect x="17.5" y="9" width="3" height="6" rx="1"/><line x1="2.5" y1="10.5" x2="2.5" y2="13.5"/><line x1="21.5" y1="10.5" x2="21.5" y2="13.5"/>`,
  duel:`<path d="M5 4 L14 13 L13 15 L11 16 L4 9 Z"/><path d="M19 4 L10 13 L11 15 L13 16 L20 9 Z"/><line x1="12" y1="14" x2="12" y2="20"/>`,
  social:`<rect x="3" y="6.5" width="18" height="13.5" rx="3"/><path d="M8.4 6.5 L9.7 4 H14.3 L15.6 6.5"/><circle cx="12" cy="13.2" r="3.8"/>`,
  profile:`<path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z"/><path d="M12 8 L13 11 L16 11 L13.5 13 L14.5 16 L12 14 L9.5 16 L10.5 13 L8 11 L11 11 Z"/>`,
  shop:`<path d="M6 8 H18 L19 20 H5 Z"/><path d="M9 8 V6.5 A3 3 0 0 1 15 6.5 V8"/>`,
  packs:`<path d="M12 3 L20 7 V16 L12 21 L4 16 V7 Z"/><polyline points="4,7 12,11 20,7"/><line x1="12" y1="11" x2="12" y2="21"/><line x1="8" y1="5" x2="16" y2="9"/>`,
};
const TABS = [
  { key:'train', label:'Train', icon:'train' }, { key:'compete', label:'Compete', icon:'duel' },
  { key:'social', label:'Social', icon:'social' }, { key:'hunter', label:'Hunter', icon:'profile' },
  { key:'forge', label:'Forge', icon:'shop' },
];
const L_PATH = 'M39.1,30.6 H49.8 V59.8 L70.3,51.3 V61.7 L49.8,69.3 H39.1 Z';
// engine.js constants worth quoting on screen
const PACK_XP_STEP = 1200;
const DUEL_REWARD_CONTENDER = { coins:250, xp:500 };

/* ----------------------------------------------------------------- utils -- */
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a,b,t) => a + (b-a)*t;
const seg = (t,a,b) => clamp01((t-a)/(b-a));
const px = v => v+'px';
const fmt = n => Math.round(n).toLocaleString('en-US');
const E = {
  linear:t=>t,
  outCubic:t=>1-Math.pow(1-t,3), outQuart:t=>1-Math.pow(1-t,4), outQuint:t=>1-Math.pow(1-t,5),
  outExpo:t=>t>=1?1:1-Math.pow(2,-11*t),
  inCubic:t=>t*t*t, inQuart:t=>t*t*t*t, inExpo:t=>t<=0?0:Math.pow(2,10*t-10),
  inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  outBack:t=>{const c1=2.2,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
  outSpring:t=>t>=1?1:1-Math.exp(-6.6*t)*Math.cos(8.2*t),
  slam:t=>t>=1?1:1-Math.exp(-9*t)*Math.cos(11*t),
};
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function rgba(hex,a){ const h=hex.replace('#',''); return `rgba(${parseInt(h.substring(0,2),16)},${parseInt(h.substring(2,4),16)},${parseInt(h.substring(4,6),16)},${a})`; }
function icon(name,size,color,sw){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}"
    stroke-width="${sw||1.9}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}
function chroma(node, amt){
  node.style.textShadow = amt > 0.15
    ? `${amt}px 0 ${rgba('#ff2d55',0.9)}, ${-amt}px 0 ${rgba('#2fe0e0',0.9)}` : 'none';
}

let stage=null, world=null;
function el(tag, parent, css, html) {
  const n = document.createElement(tag);
  if (css) Object.assign(n.style, css);
  if (html != null) n.innerHTML = html;
  (parent||world).appendChild(n);
  return n;
}

/* ------------------------------------------------------- impact / strobe -- */
let IMPACTS = [], HEAVY = new Set();
function setImpacts(list, heavy){ IMPACTS = list||[]; HEAVY = new Set(heavy||[]); }
function impactAt(t, decay){
  decay = decay || 0.16;
  let v=0, heavy=0;
  for (const i of IMPACTS){
    const d = t - i;
    if (d >= 0 && d < decay*5){
      const e = Math.exp(-d/decay);
      if (e > v) v = e;
      if (HEAVY.has(i) && e > heavy) heavy = e;
    }
  }
  return { v, heavy };
}
/* The white frame is a STROBE (~6 frames), never a lingering glow — decaying it
   on the shake curve turns a dark palette milky. Learned the hard way. */
function flashAt(t){
  let v = 0;
  for (const i of IMPACTS){
    const d = t - i;
    if (d >= 0 && d < 0.10){
      const amt = (HEAVY.has(i) ? 0.78 : 0.14) * Math.pow(1 - d/0.10, 2.0);
      if (amt > v) v = amt;
    }
  }
  return v;
}

/* -------------------------------------------------------------- backdrop -- */
let rig=[], gridFloor=null, gridSky=null, beams=[];
let chromaR=null, chromaC=null, speedLines=null, scanlines=null, glitchBars=[], flash=null, grain=null;

function boot(opts){
  opts = opts || {};
  stage = document.getElementById('stage');
  world = document.getElementById('world');

  rig = [
    { c:C.gold, s:0.95, a:0.20, sp:[0.61,0.43], ph:0.0 },
    { c:opts.accent||C.cyan, s:0.75, a:0.14, sp:[0.44,0.72], ph:2.1 },
    { c:C.purp, s:0.80, a:0.12, sp:[0.83,0.31], ph:4.2 },
  ].map(L => ({ L, n: el('div', world, {
    position:'absolute', left:'50%', top:'50%', width:'1500px', height:'1500px',
    marginLeft:'-750px', marginTop:'-750px', pointerEvents:'none', mixBlendMode:'screen',
    background:`radial-gradient(circle, ${rgba(L.c,0.5)} 0%, ${rgba(L.c,0.14)} 34%, rgba(0,0,0,0) 66%)`,
  })}));

  if (opts.grid !== false){
    gridFloor = el('div', world, {
      position:'absolute', left:'-60%', right:'-60%', bottom:'-6%', height:'62%',
      transform:'perspective(560px) rotateX(74deg)', transformOrigin:'50% 100%',
      pointerEvents:'none',
      backgroundImage:
        `repeating-linear-gradient(90deg, ${rgba(C.gold,0.5)} 0 2px, rgba(0,0,0,0) 2px 92px),`+
        `repeating-linear-gradient(0deg, ${rgba(C.gold,0.38)} 0 2px, rgba(0,0,0,0) 2px 92px)`,
      WebkitMaskImage:'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
    });
    gridSky = el('div', world, {
      position:'absolute', left:'-60%', right:'-60%', top:'-6%', height:'46%',
      transform:'perspective(560px) rotateX(-74deg)', transformOrigin:'50% 0%',
      pointerEvents:'none',
      backgroundImage:
        `repeating-linear-gradient(90deg, ${rgba(C.cyan,0.45)} 0 2px, rgba(0,0,0,0) 2px 92px),`+
        `repeating-linear-gradient(0deg, ${rgba(C.cyan,0.32)} 0 2px, rgba(0,0,0,0) 2px 92px)`,
      WebkitMaskImage:'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)',
    });
  }
  beams = [0,1,2].map(i => el('div', world, {
    position:'absolute', left:'50%', top:'-30%', width:'150px', height:'170%',
    marginLeft:'-75px', pointerEvents:'none', mixBlendMode:'screen', transformOrigin:'50% 0%',
    background:`linear-gradient(180deg, ${rgba(i===1?(opts.accent||C.cyan):C.gold,0.30)} 0%, rgba(0,0,0,0) 78%)`,
    filter:'blur(22px)',
  }));

  // overlays live on #stage so the shake doesn't move them
  chromaR = el('div', stage, { position:'absolute', inset:'0', zIndex:'80', pointerEvents:'none',
    mixBlendMode:'screen', opacity:'0',
    background:'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 46%, rgba(255,45,85,0.55) 100%)' });
  chromaC = el('div', stage, { position:'absolute', inset:'0', zIndex:'80', pointerEvents:'none',
    mixBlendMode:'screen', opacity:'0',
    background:'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 46%, rgba(47,224,224,0.55) 100%)' });
  speedLines = el('div', stage, {
    position:'absolute', left:'-30%', top:'-18%', width:'160%', height:'136%', zIndex:'82',
    pointerEvents:'none', opacity:'0', mixBlendMode:'screen',
    background:'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.55) 0deg 0.35deg, rgba(0,0,0,0) 0.35deg 5deg)',
    WebkitMaskImage:'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 26%, #000 74%)',
  });
  scanlines = el('div', stage, { position:'absolute', inset:'0', zIndex:'84', pointerEvents:'none',
    opacity:'0.12', background:'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0 1px, rgba(0,0,0,0) 1px 4px)' });
  glitchBars = [0,1,2,3,4,5].map(() => el('div', stage, {
    position:'absolute', left:'0', width:'100%', height:'40px', zIndex:'86',
    pointerEvents:'none', opacity:'0', mixBlendMode:'screen' }));
  flash = el('div', stage, { position:'absolute', inset:'0', background:'#fff', opacity:'0', zIndex:'88', pointerEvents:'none' });

  const tile = (function(){
    const cv=document.createElement('canvas'); cv.width=220; cv.height=220;
    const ctx=cv.getContext('2d'), im=ctx.createImageData(220,220), r=mulberry32(20260816);
    for(let i=0;i<im.data.length;i+=4){ const v=128+(r()-0.5)*130; im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=255; }
    ctx.putImageData(im,0,0); return cv.toDataURL();
  })();
  grain = el('div', stage, { position:'absolute', inset:'-220px', zIndex:'90', pointerEvents:'none',
    backgroundImage:'url('+tile+')', opacity:'0.07', mixBlendMode:'overlay' });
  el('div', stage, { position:'absolute', inset:'0', zIndex:'92', pointerEvents:'none',
    background:'radial-gradient(82% 66% at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.5) 100%)' });

  return { stage, world };
}

/* Drives every backdrop + overlay layer for frame t. Call once per frame. */
function frame(t){
  const rnd = mulberry32(Math.round(t*60)*2654435761 % 2147483647);
  const imp = impactAt(t);

  rig.forEach(r => {
    const L = r.L;
    r.n.style.transform =
      `translate(${Math.sin(t*L.sp[0]+L.ph)*430}px, ${Math.cos(t*L.sp[1]+L.ph)*560}px) scale(${L.s*(1+imp.v*0.28)})`;
    r.n.style.opacity = String(L.a*(0.72+0.28*Math.sin(t*2.1+L.ph)) + imp.v*0.14);
  });
  const scroll = (t*260 + imp.v*90) % 92;
  if (gridFloor){
    gridFloor.style.backgroundPosition = `0px ${scroll}px, 0px ${scroll}px`;
    gridFloor.style.opacity = String(0.62 + imp.v*0.34);
    gridSky.style.backgroundPosition = `0px ${-scroll}px, 0px ${-scroll}px`;
    gridSky.style.opacity = String(0.34 + imp.v*0.26);
  }
  beams.forEach((b,i) => {
    b.style.transform = `rotate(${Math.sin(t*(0.7+i*0.23)+i*2.0)*26}deg) scaleY(${1+imp.v*0.1})`;
    b.style.opacity = String((0.30 + imp.v*0.55) * (i===1?0.8:1));
  });

  const sh = imp.v;
  world.style.transform =
    `translate(${(rnd()-0.5)*26*sh}px, ${(rnd()-0.5)*26*sh}px) rotate(${(rnd()-0.5)*0.9*sh}deg) scale(${1+sh*0.012})`;

  const ab = sh*sh*sh;
  chromaR.style.opacity = String(ab*0.34); chromaR.style.transform = `translateX(${ab*18}px)`;
  chromaC.style.opacity = String(ab*0.34); chromaC.style.transform = `translateX(${-ab*18}px)`;

  speedLines.style.opacity = String(Math.pow(imp.heavy,1.5)*0.5);
  speedLines.style.transform = `rotate(${t*14}deg) scale(${1+imp.heavy*0.28})`;

  const tear = imp.heavy;
  glitchBars.forEach(b => {
    if (tear < 0.30){ b.style.opacity='0'; return; }
    b.style.top = px(rnd()*1920); b.style.height = px(14 + rnd()*80);
    b.style.opacity = String(tear*(0.35+rnd()*0.5));
    b.style.background = rnd()>0.5 ? rgba(C.cyan,0.55) : rgba('#ff2d55',0.5);
    b.style.transform = `translateX(${(rnd()-0.5)*260*tear}px)`;
  });

  flash.style.opacity = String(flashAt(t));
  scanlines.style.opacity = String(0.10 + imp.v*0.10);
  grain.style.backgroundPosition = `${Math.floor(rnd()*220)}px ${Math.floor(rnd()*220)}px`;
  grain.style.opacity = String(0.06 + imp.v*0.05);
  return imp;
}

/* --------------------------------------------------------- FX primitives -- */
function makeShockwave(parent, colour){
  return el('div', parent, {
    position:'absolute', left:'50%', top:'50%', width:'300px', height:'300px',
    marginLeft:'-150px', marginTop:'-150px', borderRadius:'999px',
    border:'6px solid '+colour, opacity:'0', pointerEvents:'none' });
}
function driveShockwave(node, p, maxScale, cx, cy){
  if (p <= 0 || p >= 1){ node.style.opacity='0'; return; }
  node.style.opacity = String(Math.pow(1-p,2.1));
  node.style.transform = `translate(${cx||0}px, ${cy||0}px) scale(${lerp(0.25, maxScale||5.2, E.outQuart(p))})`;
  node.style.borderWidth = px(Math.max(1, lerp(9,1,p)));
}
function makeSparks(parent, n, colour, seed){
  const rnd = mulberry32(seed);
  return Array.from({length:n}, () => {
    const ang = rnd()*Math.PI*2, dist = 220 + rnd()*520, sz = 4 + rnd()*9;
    return { node: el('div', parent, {
      position:'absolute', left:'50%', top:'50%', width:px(sz), height:px(sz),
      borderRadius:'999px', background:colour, opacity:'0', pointerEvents:'none',
      boxShadow:`0 0 ${12+rnd()*22}px ${colour}` }), ang, dist, delay: rnd()*0.10 };
  });
}
function driveSparks(list, p, cx, cy){
  list.forEach(s => {
    const q = clamp01((p - s.delay)/(1 - s.delay));
    if (p <= 0 || q <= 0 || q >= 1){ s.node.style.opacity='0'; return; }
    const e = E.outQuart(q);
    s.node.style.opacity = String(Math.pow(1-q,1.7));
    s.node.style.transform =
      `translate(${(cx||0)+Math.cos(s.ang)*s.dist*e}px, ${(cy||0)+Math.sin(s.ang)*s.dist*e + q*q*130}px)`;
  });
}

/* ------------------------------------------------------------ UI pieces --- */
const PHONE_SCALE = 0.80;
function makePhone(parent, opts){
  opts = opts||{};
  const W = 620, H = 1344;
  const root = el('div', parent, {
    position:'absolute', left:'50%', top:px(opts.top||860), width:px(W), height:px(H),
    marginLeft:px(-W/2), marginTop:px(-H/2), transformOrigin:'50% 50%' });
  el('div', root, { position:'absolute', inset:'0', borderRadius:'78px',
    background:'linear-gradient(150deg,#4a5265 0%,#242a37 30%,#3b4354 60%,#1d222c 100%)',
    boxShadow:'0 60px 150px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07), 0 0 90px '+rgba(C.gold,0.20) });
  const screen = el('div', root, { position:'absolute', left:'13px', top:'13px', right:'13px', bottom:'13px',
    borderRadius:'66px', overflow:'hidden', background:C.bg });
  el('div', root, { position:'absolute', left:'50%', top:'40px', width:'132px', height:'38px',
    marginLeft:'-66px', borderRadius:'999px', background:'#000', zIndex:'40' });
  el('div', screen, { position:'absolute', left:'44px', top:'42px', fontSize:'23px', fontWeight:'600', zIndex:'30' }, '9:41');
  el('div', screen, { position:'absolute', right:'44px', top:'44px', display:'flex', gap:'7px', alignItems:'center', zIndex:'30' },
    `<svg width="26" height="18" viewBox="0 0 26 18" fill="#fff"><rect x="0" y="12" width="4" height="6" rx="1"/><rect x="6" y="8" width="4" height="10" rx="1"/><rect x="12" y="4" width="4" height="14" rx="1"/><rect x="18" y="0" width="4" height="18" rx="1"/></svg>
     <svg width="30" height="16" viewBox="0 0 30 16" fill="none"><rect x="0.7" y="0.7" width="24" height="14.6" rx="4.4" stroke="#fff" stroke-opacity="0.5" stroke-width="1.4"/><rect x="2.6" y="2.6" width="19" height="10.8" rx="2.8" fill="#fff"/><path d="M27 5.4v5.2c1.5-.5 2-1.6 2-2.6s-.5-2.1-2-2.6z" fill="#fff" fill-opacity="0.5"/></svg>`);
  return { root, screen, W, H };
}
function makeTabBar(screen, activeKey){
  const bar = el('div', screen, { position:'absolute', left:'0', right:'0', bottom:'0', height:'150px',
    background:'rgba(11,13,19,0.88)', borderTop:'1px solid '+C.lineSoft,
    display:'flex', alignItems:'flex-start', paddingTop:'18px', zIndex:'20' });
  TABS.forEach(tb => {
    const on = tb.key===activeKey, col = on ? C.gold : C.dim;
    el('div', bar, { flex:'1', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' },
      icon(tb.icon,38,col,on?2.2:1.9) +
      `<div style="font-size:17px;font-weight:${on?700:500};color:${col}">${tb.label}</div>`);
  });
  return bar;
}
/* A simple animated lifter avatar — gives the frame a human presence, which the
   short-form evidence consistently favours over pure UI motion. */
function makeLifter(parent, colour, size){
  const s = size || 1;
  const root = el('div', parent, { position:'absolute', left:'50%', top:'50%', width:'0', height:'0' });
  const g = el('div', root, { position:'absolute', left:px(-110*s), top:px(-150*s),
    width:px(220*s), height:px(300*s), transformOrigin:'50% 90%' });
  el('div', g, { position:'absolute', left:'50%', top:'0', width:px(74*s), height:px(74*s),
    marginLeft:px(-37*s), borderRadius:'999px', background:colour, boxShadow:`0 0 ${40*s}px ${rgba(colour,0.6)}` });
  el('div', g, { position:'absolute', left:'50%', top:px(86*s), width:px(120*s), height:px(150*s),
    marginLeft:px(-60*s), borderRadius:px(46*s), background:colour, opacity:'0.92' });
  const barbell = el('div', g, { position:'absolute', left:'50%', top:px(40*s), width:px(300*s), height:px(14*s),
    marginLeft:px(-150*s), borderRadius:px(8*s), background:'#e7edf7' });
  el('div', barbell, { position:'absolute', left:px(-18*s), top:px(-26*s), width:px(26*s), height:px(66*s),
    borderRadius:px(6*s), background:'#cbd4e3' });
  el('div', barbell, { position:'absolute', right:px(-18*s), top:px(-26*s), width:px(26*s), height:px(66*s),
    borderRadius:px(6*s), background:'#cbd4e3' });
  return { root, g, barbell };
}
/* Reps: barbell rises and falls. phase in [0,1] = one rep. */
function driveLifter(L, reps, s){
  s = s || 1;
  const ph = (reps % 1);
  const press = Math.sin(ph*Math.PI);           // 0 -> 1 -> 0
  L.barbell.style.transform = `translateY(${-58*press*s}px)`;
  L.g.style.transform = `scaleY(${1 - 0.05*press}) translateY(${8*press*s}px)`;
}

/* End card used by every concept, so the CTA is consistent across the set. */
function makeEndCard(parent, opts){
  opts = opts || {};
  const root = el('div', parent, { position:'absolute', inset:'0', opacity:'0' });
  const iconBox = el('div', root, { position:'absolute', left:'50%', top:'700px', width:'220px', height:'220px',
    marginLeft:'-110px', marginTop:'-110px', borderRadius:'52px',
    background:'linear-gradient(150deg,#ffe08a 0%,#ffc933 45%,#e5a51f 100%)',
    boxShadow:'0 34px 100px '+rgba(C.gold,0.45), display:'flex', alignItems:'center', justifyContent:'center' },
    `<svg width="220" height="220" viewBox="0 0 100 100"><path d="${L_PATH}" fill="#0e1016"/></svg>`);
  const word = el('div', root, { position:'absolute', left:'0', right:'0', top:'860px', textAlign:'center',
    fontSize:'170px', fontWeight:'800' }, 'LEVL');
  const tag = el('div', root, { position:'absolute', left:'0', right:'0', top:'1075px', textAlign:'center',
    fontSize:'42px', fontWeight:'800', letterSpacing:'9px', color:C.gold, textTransform:'uppercase' },
    opts.tag || 'Train. Rank up.');
  const btn = el('div', root, { position:'absolute', left:'50%', top:'1200px', marginLeft:'-260px',
    width:'520px', height:'110px', borderRadius:'999px',
    background:'linear-gradient(180deg,#ffd45c,'+C.gold+')', display:'flex', alignItems:'center', justifyContent:'center' },
    `<span style="font-size:30px;font-weight:800;letter-spacing:3px;color:${C.ink};text-transform:uppercase">${opts.cta||'Link in bio'}</span>`);
  const store = el('div', root, { position:'absolute', left:'0', right:'0', top:'1350px', textAlign:'center',
    fontSize:'23px', fontWeight:'700', letterSpacing:'5px', color:C.dim, textTransform:'uppercase' }, 'iOS · TestFlight');
  return {
    root,
    drive(local){
      root.style.opacity = String(seg(local,0,0.10));
      const ip = E.slam(seg(local,0.0,0.55));
      iconBox.style.transform = `scale(${lerp(0.4,1,ip)}) rotate(${lerp(-14,0,E.outQuint(seg(local,0,0.7)))}deg)`;
      const w = seg(local,0.22,0.75);
      word.style.opacity = String(seg(local,0.22,0.32));
      word.style.letterSpacing = px(lerp(90,10,E.outExpo(w)));
      word.style.transform = `scale(${lerp(1.25,1,E.slam(w))})`;
      chroma(word, lerp(24,0,E.outCubic(seg(local,0.22,0.72))));
      tag.style.opacity = String(seg(local,0.48,0.80));
      const bp = seg(local,0.70,1.05);
      btn.style.opacity = String(bp);
      const pulse = 1 + Math.sin(Math.max(0,local-1.05)*7.2)*0.028;
      btn.style.transform = `scale(${lerp(0.6,1,E.slam(bp))*pulse})`;
      const gl = 0.45 + 0.35*(0.5+0.5*Math.sin(Math.max(0,local-1.05)*7.2));
      btn.style.boxShadow = `0 20px 60px ${rgba(C.gold,gl)}, 0 0 ${60+gl*70}px ${rgba(C.gold,gl*0.8)}`;
      store.style.opacity = String(seg(local,0.95,1.25));
    }
  };
}

return {
  C, TIERS, RARITY, ICONS, TABS, L_PATH, PACK_XP_STEP, DUEL_REWARD_CONTENDER,
  clamp01, lerp, seg, px, fmt, E, mulberry32, rgba, icon, chroma, el,
  boot, frame, setImpacts, impactAt, flashAt,
  makeShockwave, driveShockwave, makeSparks, driveSparks,
  makePhone, makeTabBar, makeLifter, driveLifter, makeEndCard, PHONE_SCALE,
  get world(){ return world; }, get stage(){ return stage; },
};
})();
