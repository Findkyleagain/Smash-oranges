// Simple BigInt formatter and helpers
const SUFFIXES = ['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc'];
function fmtBig(n){
  if (n === 0n) return '0';
  const s = n.toString();
  const len = s.length;
  const group = Math.floor((len-1)/3);
  if (group < SUFFIXES.length) {
    const div = 10n ** BigInt(group*3);
    const major = n / div;
    const rem = n % div;
    if (rem === 0n) return major.toString() + SUFFIXES[group];
    const frac = Number((rem * 100n) / div) / 100;
    return major.toString() + (frac?('.'+(frac.toFixed(2)).replace(/^0\./,'')):'') + SUFFIXES[group];
  }
  // fallback scientific
  return s[0]+'.'+s.slice(1,4)+'e'+(len-1);
}

function powBig(base, exp){
  let res = 1n;
  let b = BigInt(base);
  let e = BigInt(exp);
  while(e>0){ if (e&1n) res*=b; b*=b; e>>=1n; }
  return res;
}

// Game state
const state = {
  juice: 0n,
  baseClick: 1n,
  upgrades: {},
  evolutions: 0,
  evoCap: 10,
  rebirths: 0,
  achievements: {},
  factoryName: 'My Orange Factory'
};

const UPGRADE_DEFS = [
  {id:'hammer',name:'Better Hammer',desc:'Increase base smash power',baseCost:10n,basePower:2n},
  {id:'pliers',name:'Orange Pliers',desc:'Multiply later clicks',baseCost:500n,basePower:3n},
  {id:'squeezer',name:'Auto Squeezer',desc:'Gives passive juice/sec',baseCost:2000n,basePower:1n}
];

// Evolution cost: 20 * 10^(12 + 6*i)
function evoCost(i){
  const exp = 12 + 6*i;
  return 20n * (10n ** BigInt(exp));
}

// Save / load
function save(){ localStorage.setItem('smash_oranges_v1', JSON.stringify({
  juice: state.juice.toString(), baseClick: state.baseClick.toString(), upgrades: state.upgrades, evolutions: state.evolutions, evoCap: state.evoCap, rebirths: state.rebirths, achievements: state.achievements, factoryName: state.factoryName
})); }

function load(){
  try{
    const raw = localStorage.getItem('smash_oranges_v1');
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.juice = BigInt(obj.juice||'0');
    state.baseClick = BigInt(obj.baseClick||'1');
    state.upgrades = obj.upgrades||{};
    state.evolutions = obj.evolutions||0;
    state.evoCap = obj.evoCap||10;
    state.rebirths = obj.rebirths||0;
    state.achievements = obj.achievements||{};
    state.factoryName = obj.factoryName||state.factoryName;
  }catch(e){console.error('load',e)}
}

// UI elements
const juiceEl = document.getElementById('juice');
const perClickEl = document.getElementById('perClick');
const smashBtn = document.getElementById('smashBtn');
const orangeEl = document.getElementById('orange');
const hammerEl = document.getElementById('hammer');
const upgradesEl = document.getElementById('upgrades');
const achEl = document.getElementById('achievements');
const evoBtn = document.getElementById('evolveBtn');
const evoCostEl = document.getElementById('evoCost');
const evoCountEl = document.getElementById('evolutions');
const evoCapEl = document.getElementById('evoCap');
const rebirthBtn = document.getElementById('rebirthBtn');
const rebirthsEl = document.getElementById('rebirths');
const factoryInput = document.getElementById('factoryNameInput');
const changeNameBtn = document.getElementById('changeName');
const endBtn = document.getElementById('endBtn');
const overlay = document.getElementById('overlay');

function updateUI(){
  juiceEl.textContent = fmtBig(state.juice);
  perClickEl.textContent = fmtBig(clickValue());
  evoCountEl.textContent = state.evolutions;
  evoCapEl.textContent = state.evoCap;
  rebirthsEl.textContent = state.rebirths;
  evoCostEl.textContent = fmtBig(evoCost(state.evolutions));
  document.title = `${fmtBig(state.juice)} - Smash Oranges`;

  // upgrades
  upgradesEl.innerHTML='';
  UPGRADE_DEFS.forEach(def=>{
    const lvl = state.upgrades[def.id]||0;
    const cost = BigInt(Math.max(1, Math.floor(Number(def.baseCost) * Math.pow(10, lvl))));
    const wrapper = document.createElement('div'); wrapper.className='upgrade';
    wrapper.innerHTML = `<div><strong>${def.name}</strong><div style='font-size:12px;color:#666'>${def.desc} (lvl ${lvl})</div></div>`;
    const btn = document.createElement('button'); btn.textContent = `Buy (${fmtBig(cost)})`;
    btn.disabled = state.juice < cost;
    btn.onclick = ()=>{ buyUpgrade(def.id,cost,def); };
    wrapper.appendChild(btn);
    upgradesEl.appendChild(wrapper);
  });

  // achievements
  achEl.innerHTML='';
  for(const k in state.achievements){
    const div = document.createElement('div'); div.className='achievement'; div.textContent = state.achievements[k];
    achEl.appendChild(div);
  }
}

function clickValue(){
  let val = state.baseClick;
  // upgrade multipliers
  if (state.upgrades['hammer']) val *= powBig(2n, BigInt(state.upgrades['hammer']));
  if (state.upgrades['pliers']) val *= powBig(3n, BigInt(state.upgrades['pliers']));
  // evolutions: 20x per evolution
  if (state.evolutions>0) val *= powBig(20n, BigInt(state.evolutions));
  return val;
}

function smash(){
  const amt = clickValue();
  state.juice += amt;
  animateHammer();
  checkAchievements();
  updateUI(); save();
}

function animateHammer(){
  hammerEl.style.transform='translateY(-10px) rotate(-10deg) scale(1.05)';
  orangeEl.style.transform='translateY(-6px)';
  setTimeout(()=>{hammerEl.style.transform='rotate(-20deg)'; orangeEl.style.transform='';},150);
}

function buyUpgrade(id,cost,def){
  if (state.juice < cost) return;
  state.juice -= cost;
  state.upgrades[id] = (state.upgrades[id]||0) + 1;
  // apply immediate effects for some upgrades
  if (id==='squeezer'){
    // squeezer gives passive per sec equal to level
  }
  updateUI(); save();
}

// Passive tick
setInterval(()=>{
  const lvl = state.upgrades['squeezer']||0;
  if (lvl>0){ state.juice += BigInt(lvl); }
  updateUI(); save();
},1000);

// Evolve
evoBtn.onclick = ()=>{
  if (state.evolutions >= state.evoCap){ alert('Already at evolution cap'); return; }
  const cost = evoCost(state.evolutions);
  if (state.juice < cost){ alert('Not enough orange juice'); return; }
  state.juice -= cost;
  state.evolutions += 1;
  // evolve visual
  orangeEl.className = 'evo-'+state.evolutions;
  updateUI(); save(); checkAchievements();
}

// Rebirth
rebirthBtn.onclick = ()=>{
  if (!confirm('Are you sure? This will reset EVERYTHING.')) return;
  if (state.rebirths >= 100){ alert('You have reached absolute rebirth cap.'); return; }
  state.rebirths += 1;
  // reset everything
  state.juice = 0n; state.baseClick = 1n; state.upgrades = {}; state.evolutions = 0; state.factoryName = 'My Orange Factory';
  // after any rebirth, evolution cap becomes 20
  state.evoCap = 20;
  updateUI(); save(); checkAchievements();
}

// Change name
changeNameBtn.onclick = ()=>{
  const v = factoryInput.value.trim() || 'My Orange Factory';
  state.factoryName = v; save(); updateUI();
  if (v === 'OVEN'){ unlock('oven','Its an oven factory now?-'); }
}

// Achievements
function unlock(id,text){ if (state.achievements[id]) return; state.achievements[id]=text; updateUI(); save(); }

function checkAchievements(){
  if (!state.achievements['firstSmash'] && state.juice>0n) unlock('firstSmash','First smash!');
  if (!state.achievements['evo10'] && state.evolutions>=10) unlock('evo10','Evolved 10 times - How did you get here?');
  if (state.rebirths>=100 && state.evolutions>=state.evoCap) unlock('dedication','Serious dedication');
}

// End game cutscene
endBtn.onclick = ()=>{
  if (!confirm('End the orange factory? This will play a cutscene and end your game.')) return;
  playEnding();
}

function playEnding(){
  overlay.classList.remove('hidden');
  const bigHammer = document.getElementById('bigHammer');
  const bigOrange = document.getElementById('bigOrange');
  // animate hammer falling
  setTimeout(()=>{ bigHammer.style.transform='translateY(0) rotate(0)'; },50);
  setTimeout(()=>{ bigOrange.style.transform='scale(.1) rotate(90deg)'; bigOrange.style.opacity='0'; },900);
  setTimeout(()=>{ bigHammer.style.transform='translateY(-80vh)'; overlay.innerHTML=`<div style='color:white;font-size:28px;text-align:center'>The orange factory has ended.<br>Thank you for playing.</div>` },1600);
  // disable further input
  smashBtn.disabled = true; evoBtn.disabled = true; rebirthBtn.disabled = true; endBtn.disabled = true; changeNameBtn.disabled = true;
  // remove save
  localStorage.removeItem('smash_oranges_v1');
}

// Falling oranges background
function makeFalling(n=40){
  const container = document.getElementById('falling');
  for(let i=0;i<n;i++){
    const s = document.createElement('div'); s.className='fall'; s.textContent='🍊';
    const left = Math.random()*100; s.style.left = left+'%';
    const dur = 6 + Math.random()*10; s.style.animationDuration = dur+'s';
    s.style.fontSize = (8+ Math.random()*28)+'px';
    s.style.top = -(Math.random()*80)+'vh';
    s.style.animationDelay = (Math.random()*-10)+'s';
    container.appendChild(s);
  }
}

// Init
load(); makeFalling(60);
updateUI();

smashBtn.onclick = smash;

// offer quick auto-save
setInterval(save,5000);

// expose for debugging
window._state = state;

// check special final achievement condition in case of manual changes
checkAchievements();
