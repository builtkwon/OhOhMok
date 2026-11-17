// UI E2E (local, no network). Run: npm run test:ui
import { chromium, devices } from 'playwright';
const url=new URL('../index.html',import.meta.url).href;
const b=await chromium.launch({args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n);if(!c)process.exitCode=1;};
for (const [name,opts] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{...devices['iPhone 13']}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const errs=[],bad=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('response',r=>{if(r.status()>=400)bad.push(r.url())}); p.on('requestfailed',r=>bad.push(r.url()));
  const dialogs=[]; p.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
  await p.goto(url); await p.waitForTimeout(300);
  ok(name+' no external requests/failures', bad.length===0 && true); if(bad.length)console.log(bad);
  ok(name+' mode overlay focused', await p.evaluate(()=>document.activeElement.classList.contains('mode-card')));
  ok(name+' background inert', await p.evaluate(()=>document.querySelector('.game-layout').inert));
  ok(name+' hidden overlays not focusable', await p.evaluate(()=>['select-overlay','room-overlay','overlay'].every(id=>getComputedStyle(document.getElementById(id)).visibility==='hidden')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(500); // AI card via keyboard
  ok(name+' select dialog open + focus inside', await p.evaluate(()=>document.getElementById('select-overlay').contains(document.activeElement)));
  await p.click('.level-chip[data-level="hard"]');
  ok(name+' level hard checked', await p.evaluate(()=>document.querySelector('.level-chip[data-level=hard]').getAttribute('aria-checked')==='true'&&aiLevel==='hard'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(name+' Esc back to mode', await p.evaluate(()=>document.getElementById('mode-overlay').classList.contains('show')&&!document.getElementById('select-overlay').classList.contains('show')));
  await p.click('.mode-card >> nth=0'); await p.waitForTimeout(400); await p.click('.stone-choice >> nth=0'); await p.waitForTimeout(600);
  ok(name+' game visible/not inert', await p.evaluate(()=>!document.querySelector('.game-layout').inert));
  ok(name+' badge text', (await p.textContent('#badge-white')).includes('AI · 어려움') && (await p.textContent('#badge-black'))==='나');
  await p.focus('#board-click'); await p.keyboard.press('Tab').catch(()=>{}); await p.focus('#board-click');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  const st=await p.evaluate(()=>({b:board[6][6],cnt:board.flat().filter(Boolean).length,live:document.getElementById('sr-live').textContent}));
  ok(name+' keyboard placed at (6,6) and AI replied', st.b===1&&st.cnt===2); console.log('  live:',st.live);
  await p.evaluate(()=>newGame()); ok(name+' confirm on leaving AI game', dialogs.some(m=>m.includes('종료')));
  ok(name+' still in game after cancel', await p.evaluate(()=>board.flat().filter(Boolean).length===2));
  await p.evaluate(()=>{scores={1:2,2:0};resetScore()}); ok(name+' confirm on score reset', dialogs.some(m=>m.includes('전적')));
  const fonts=await p.evaluate(()=>getComputedStyle(document.body).fontFamily); 
  ok(name+' no page errors '+JSON.stringify(errs), errs.length===0);
  await ctx.close();
}
await b.close();
