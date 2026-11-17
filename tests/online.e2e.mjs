// Online E2E: needs network (public PeerJS broker). Run: npm run test:online
import { chromium } from 'playwright';
const url=new URL('../index.html',import.meta.url).href;
const b=await chromium.launch({args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const mk=async()=>{const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));;await p.goto(url);return p;};
const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n);if(!c)process.exitCode=1;};
const H=await mk(),G=await mk(),T=await mk();
await H.click('.mode-card >> nth=1'); await H.waitForFunction(()=>document.getElementById('room-code-display').textContent.length===6,{timeout:15000});
const code=await H.textContent('#room-code-display'); ok('6-char code '+code,/^[A-Z2-9]{6}$/.test(code));
await G.click('.mode-card >> nth=1'); await G.click('#tab-join'); await G.fill('#join-code-input',code); await G.evaluate(()=>joinRoom());
await H.waitForFunction(()=>onlineStarted,{timeout:20000}); await G.waitForFunction(()=>onlineStarted,{timeout:20000});
ok('both started',true);
ok('overlays not blocking', await H.evaluate(()=>['mode','select','room'].every(n=>getComputedStyle(document.getElementById(n+'-overlay')).pointerEvents==='none')));
await H.evaluate(()=>handleClick(7,7)); await G.waitForFunction(()=>board[7][7]===1,{timeout:5000}); ok('move relayed host→guest',true);
await G.evaluate(()=>handleClick(7,8)); await H.waitForFunction(()=>board[7][8]===2,{timeout:5000}); ok('move relayed guest→host',true);
// invalid messages to host: bad coords, string coords, out of turn (host turn now is 1 -> guest move invalid)
await G.evaluate(()=>{send({type:'move',row:99,col:1});send({type:'move',row:'1',col:1});send({type:'move',row:null});send({type:'move',row:7,col:7});send({type:'sync',board:'x'});});
await G.evaluate(()=>send({type:'move',row:0,col:0})); // guest not its turn
await H.waitForTimeout(1500);
ok('host ignores invalid', await H.evaluate(()=>board[0][0]===0&&board.flat().filter(Boolean).length===2)); ok('host no errors',H.errs.length===0);
// out-of-turn from host to guest -> guest rejects + resync
await H.evaluate(()=>{send({type:'move',row:1,col:1});send({type:'move',row:2,col:2});}); await G.waitForTimeout(2000);
ok('guest rejects out-of-turn + resyncs to host', await G.evaluate(()=>board[2][2]===0&&board[1][1]===0&&board.flat().filter(Boolean).length===2)); ok('guest no errors',G.errs.length===0);
// third joiner rejected
await T.click('.mode-card >> nth=1'); await T.click('#tab-join'); await T.fill('#join-code-input',code); await T.evaluate(()=>joinRoom());
await T.waitForFunction(()=>document.getElementById('join-status').textContent.includes('가득'),{timeout:15000}); ok('3rd rejected',true);
ok('game undisturbed', await H.evaluate(()=>onlineStarted&&!peerLost));
// disconnect + auto rejoin
await G.evaluate(()=>conn.close());
await H.waitForFunction(()=>peerLost,{timeout:8000}); ok('host detects drop',true);
await H.waitForFunction(()=>!peerLost,{timeout:25000}); await G.waitForFunction(()=>!peerLost,{timeout:5000}); ok('guest rejoined',true);
ok('state preserved', await G.evaluate(()=>board[7][7]===1&&board[7][8]===2&&currentPlayer===1));
// restart consent
await H.evaluate(()=>{gameOver=true;showEndOverlay('t','t');onlineRematch()});
await G.waitForFunction(()=>incomingRestart,{timeout:5000}); ok('guest got restart request',true);
ok('not restarted without consent', await G.evaluate(()=>board.flat().filter(Boolean).length===2));
await G.evaluate(()=>rematch()); await H.waitForFunction(()=>board.flat().every(v=>!v),{timeout:5000}); await G.waitForFunction(()=>board.flat().every(v=>!v));
ok('restart after accept',true);
console.log('errs',H.errs,G.errs,T.errs);
await b.close();
