// UI E2E (local, no network). Run: npm run test:ui
import { chromium, devices } from 'playwright';
import { existsSync } from 'node:fs';
const url=new URL('../index.html',import.meta.url).href;
const b=await chromium.launch({args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
// profile.js is built in a parallel branch; until merged its absence is not a failure
const noProfile=!existsSync(new URL('../profile.js',import.meta.url));
const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n);if(!c)process.exitCode=1;};
for (const [name,opts] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{...devices['iPhone 13']}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const errs=[],bad=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('response',r=>{if(r.status()>=400)bad.push(r.url())}); p.on('requestfailed',r=>{if(!(noProfile&&r.url().endsWith('/profile.js')))bad.push(r.url())});
  const ext=[]; p.on('request',r=>{if(!/^(file|data|blob):/.test(r.url()))ext.push(r.url())});
  const dialogs=[]; p.on('dialog',d=>{dialogs.push(d.message());d.message().includes('항복')?d.accept():d.dismiss()}); // accept only the resign confirm
  await p.goto(url); await p.waitForTimeout(300);
  ok(name+' no external requests/failures', bad.length===0&&ext.length===0); if(bad.length||ext.length)console.log(bad,ext);
  ok(name+' mode overlay focused', await p.evaluate(()=>document.activeElement.classList.contains('mode-card')));
  ok(name+' background inert', await p.evaluate(()=>document.querySelector('.game-layout').inert));
  ok(name+' hidden overlays not focusable', await p.evaluate(()=>['select-overlay','rule-overlay','team-overlay','overlay'].every(id=>getComputedStyle(document.getElementById(id)).visibility==='hidden')));
  // theme/profile tools usable on the first screen (mode select), blocked under any other overlay
  ok(name+' header tools on top of mode select', await p.evaluate(()=>{const b=document.getElementById('theme-btn'),r=b.getBoundingClientRect();return !b.closest('[inert]')&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;}));
  const th0=await p.evaluate(()=>document.documentElement.dataset.theme); await p.click('#theme-btn');
  ok(name+' theme toggles from mode select', await p.evaluate(t=>document.documentElement.dataset.theme!==t,th0)); await p.click('#theme-btn');
  await p.focus('#mode-overlay .mode-card');
  await p.keyboard.press('Enter'); await p.waitForTimeout(500); // AI card via keyboard
  ok(name+' rule step open (일반전/속기전, new! tag)', await p.evaluate(()=>document.getElementById('rule-overlay').contains(document.activeElement)&&document.querySelector('#rule-overlay .new-tag').textContent==='new!'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(500); // 일반전
  ok(name+' header tools inert under other overlays', await p.evaluate(()=>document.querySelector('.header-tools').inert&&document.querySelector('header h1').inert));
  ok(name+' select dialog open + focus inside', await p.evaluate(()=>document.getElementById('select-overlay').contains(document.activeElement)));
  await p.click('.level-chip[data-level="hard"]');
  ok(name+' level hard checked', await p.evaluate(()=>document.querySelector('.level-chip[data-level=hard]').getAttribute('aria-checked')==='true'&&aiLevel==='hard'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(name+' Esc back to rule step', await p.evaluate(()=>document.getElementById('rule-overlay').classList.contains('show')&&!document.getElementById('select-overlay').classList.contains('show')));
  await p.click('#rule-overlay .mode-card >> nth=0'); await p.waitForTimeout(400);
  ok(name+' 일반전 time chips: 없음 default', await p.evaluate(()=>[...document.querySelectorAll('#select-overlay [data-tc] .level-chip')].map(b=>b.textContent+(b.getAttribute('aria-checked')==='true'?'*':'')).join()==='없음*,5분,10분'));
  await p.click('.stone-choice >> nth=0'); await p.waitForTimeout(600);
  ok(name+' no clock without time limit', await p.evaluate(()=>!CLK&&document.getElementById('clock-1').textContent===''));
  ok(name+' game visible/not inert', await p.evaluate(()=>!document.querySelector('.game-layout').inert));
  ok(name+' names: 나 vs AI (no ZEST/ZAIST)', (await p.textContent('#name-black')).trim()==='나' && (await p.textContent('#name-white'))==='AI 어려움' && (await p.textContent('#turn-text'))==='내 차례');
  ok(name+' Google name shown as text', await p.evaluate(()=>{const s=[Profile.signedIn,Profile.name];Profile.signedIn=()=>true;Profile.name=()=>'<b>홍</b>';updateBadges();updateTurn();
    const r=document.getElementById('name-black').textContent==='<b>홍</b> 나'&&!document.querySelector('#name-black b')&&document.getElementById('turn-text').textContent==='<b>홍</b> 차례';
    [Profile.signedIn,Profile.name]=s;updateBadges();updateTurn();return r;}));
  ok(name+' draw + resign buttons on my turn', await p.evaluate(()=>!document.getElementById('game-actions').hidden&&!document.getElementById('draw-btn').hidden));
  await p.focus('#board-click'); await p.keyboard.press('Tab').catch(()=>{}); await p.focus('#board-click');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  const st=await p.evaluate(()=>({b:board[6][6],cnt:board.flat().filter(Boolean).length,live:document.getElementById('sr-live').textContent}));
  ok(name+' keyboard placed at (6,6) and AI replied', st.b===1&&st.cnt===2); console.log('  live:',st.live);
  await p.evaluate(()=>{gameOver=true;showWinOverlay(1);}); ok(name+' result title shows AI level', (await p.textContent('#overlay .modal-title'))==='AI 대전 · 어려움'); await p.evaluate(()=>{closeOverlay();gameOver=false;});
  await p.evaluate(()=>newGame()); ok(name+' confirm on leaving AI game', dialogs.some(m=>m.includes('종료')));
  ok(name+' still in game after cancel', await p.evaluate(()=>board.flat().filter(Boolean).length===2));
  // draw / resign (docs/draw-resign.md). Boards set by hand; the human (black) is to move.
  const setB=(fill)=>p.evaluate(f=>{board=Array.from({length:15},(_,r)=>Array.from({length:15},(_,c)=>f==='full'?((Math.floor(c/2)+r)%2)+1:0));if(f==='full'){board[0][0]=board[7][7]=0;}if(f==='ai3'){board[7][7]=board[7][8]=board[7][9]=2;}
    gameOver=false;currentPlayer=humanPlayer;refreshStones();closeOverlay();updateTurn();},fill);
  await setB('full');
  ok(name+' no-move notice, game goes on', await p.evaluate(()=>document.getElementById('turn-text').textContent.startsWith('더 이상 둘 수가 없습니다')&&!gameOver));
  await p.waitForTimeout(300); ok(name+' draw button highlighted + pulsing', await p.evaluate(()=>{const b=document.getElementById('draw-btn'),s=getComputedStyle(b);return b.classList.contains('hot')&&s.animationName==='drawPulse'&&s.backgroundColor!=='rgba(0, 0, 0, 0)';}));
  await p.emulateMedia({reducedMotion:'reduce'});
  ok(name+' no pulse with reduced motion', await p.evaluate(()=>getComputedStyle(document.getElementById('draw-btn')).animationName==='none')); await p.emulateMedia({reducedMotion:'no-preference'});
  await setB('ai3'); ok(name+' no highlight on an open board', await p.evaluate(()=>!document.getElementById('draw-btn').classList.contains('hot')));
  await p.click('#draw-btn'); await p.waitForTimeout(100);
  ok(name+' AI refuses a draw when it has 3 in an open window', await p.evaluate(()=>!gameOver&&document.getElementById('turn-text').textContent.includes('거절')));
  await p.waitForTimeout(1600); ok(name+' refusal message goes away', (await p.textContent('#turn-text'))==='내 차례');
  await setB('empty'); await p.click('#draw-btn'); await p.waitForTimeout(500);
  ok(name+' AI accepts a draw otherwise', await p.evaluate(()=>gameOver&&document.getElementById('modal-winner').textContent==='무승부!'&&document.getElementById('modal-sub').textContent.includes('합의 무승부')&&document.getElementById('game-actions').hidden));
  await setB('empty');
  await p.evaluate(()=>{window.__learn=[];const L=GomokuAI.learn;GomokuAI.learn=(h,a,w)=>{__learn.push([a,w]);L(h,a,w);};aiHist=[{p:1,row:7,col:7,key:GomokuAI.posKey(board,1)}];window.__s2=scores[2];});
  await p.click('#resign-btn'); await p.waitForTimeout(500);
  ok(name+' resign: confirm, loss, learned as an AI win', dialogs.includes('정말 항복할까요?') && await p.evaluate(()=>gameOver&&scores[2]===__s2+1&&JSON.stringify(__learn)==='[[2,2]]'&&document.getElementById('modal-winner').textContent==='항복 패배'));
  await p.evaluate(()=>{scores={1:2,2:0};resetScore()}); ok(name+' confirm on score reset', dialogs.some(m=>m.includes('전적')));
  // 속기전 5초 vs AI: clock on the human only, timeout = loss
  await p.evaluate(()=>{gameOver=true;closeOverlay();newGame();}); await p.waitForTimeout(400);
  await p.click('#mode-overlay .mode-card >> nth=0'); await p.waitForTimeout(400); await p.click('#rule-overlay .mode-card >> nth=1'); await p.waitForTimeout(400);
  await p.click('#select-overlay [data-tc] .level-chip >> nth=0'); await p.click('.stone-choice >> nth=0'); await p.waitForTimeout(400);
  ok(name+' blitz clock shown for human only', /⚡ [45]\.\d초/.test(await p.textContent('#clock-1')) && (await p.textContent('#clock-2'))==='');
  await p.evaluate(()=>{CLK.t0-=6000;}); await p.waitForTimeout(400);
  ok(name+' blitz timeout = loss', await p.evaluate(()=>gameOver&&scores[2]===1&&document.getElementById('modal-winner').textContent==='시간 초과 패배'));
  // 일반전 5분: main time display
  await p.evaluate(()=>{closeOverlay();newGame();}); await p.waitForTimeout(400);
  await p.click('#mode-overlay .mode-card >> nth=0'); await p.waitForTimeout(400); await p.click('#rule-overlay .mode-card >> nth=0'); await p.waitForTimeout(400);
  await p.click('#select-overlay [data-tc] .level-chip >> nth=1'); await p.click('.stone-choice >> nth=0'); await p.waitForTimeout(300);
  ok(name+' 5분 clock', /⏱ [45]:\d\d/.test(await p.textContent('#clock-1')));
  await p.evaluate(()=>{CLK.t0-=300500;}); await p.waitForTimeout(300);
  ok(name+' main time used up -> 초읽기', /초읽기 \d+초 · 3회/.test(await p.textContent('#clock-1')) && await p.evaluate(()=>!gameOver));
  const fonts=await p.evaluate(()=>getComputedStyle(document.body).fontFamily); 
  ok(name+' no page errors '+JSON.stringify(errs), errs.length===0);
  await ctx.close();
}
{ // storage: zestmok-* copy (ADR 0001) + theme persistence
  const ctx=await b.newContext({colorScheme:'dark'}); const p=await ctx.newPage(); await p.goto(url);
  const ls=()=>p.evaluate(()=>({...localStorage}));
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('zestmok-level','hard');localStorage.setItem('zestmok-mem-hard','{"m":1}');});
  await p.reload(); let s=await ls();
  ok('zestmok-* copied to ohohmok-*, old keys kept', s['ohohmok-level']==='hard'&&s['ohohmok-mem-hard']==='{"m":1}'&&s['zestmok-level']==='hard'&&s['zestmok-mem-hard']==='{"m":1}');
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('zestmok-level','hard');localStorage.setItem('ohohmok-level','easy');});
  await p.reload(); s=await ls();
  ok('existing ohohmok-level not overwritten', s['ohohmok-level']==='easy'&&await p.evaluate(()=>aiLevel==='easy'));
  const th=()=>p.evaluate(()=>[document.documentElement.dataset.theme,document.getElementById('theme-btn').getAttribute('aria-pressed')].join());
  ok('theme follows OS (dark) by default', await th()==='dark,true');
  await p.evaluate(()=>toggleTheme()); await p.reload();
  ok('theme toggle persists across reload', await th()==='light,false'&&(await ls())['ohohmok-theme']==='light');
  await ctx.close();
}
await b.close();
