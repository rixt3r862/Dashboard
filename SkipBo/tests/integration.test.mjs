import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRESETS} from '../../ScoreKeeper/js/config.js';
import * as E from '../engine.mjs';
const read = path => fs.readFileSync(new URL(path,import.meta.url),'utf8');
test('Skip-Bo is linked, cached, and exposes the matching ScoreKeeper preset',()=>{
 const catalogWindow={};vm.runInNewContext(read('../../shared/app-catalog.js'),{window:catalogWindow});
 assert.ok(catalogWindow.DashboardCatalog.apps.some(app=>app.url==='./SkipBo/index.html'));
 assert.ok(catalogWindow.DashboardCatalog.forCategory('games').some(app=>app.href==='../SkipBo/index.html'));
 for(const asset of ['index.html','skipbo.css','skipbo.js','engine.mjs','icon.svg']) assert.ok(read('../../sw.js').includes(`./SkipBo/${asset}`));
 assert.equal(PRESETS.skipbo.target,500);assert.equal(PRESETS.skipbo.winMode,'high');
 assert.equal((read('../../ScoreKeeper/index.html').match(/value="skipbo"/g)||[]).length,2);
});
test('completed game exports awarded scores in the shared ScoreKeeper format',()=>{
 const window={};vm.runInNewContext(read('../../shared/game-room.js'),{window});const G=window.GameRoom;
 const s=E.createGame(['A','B'],{short:true,target:1});let steps=0;
 while(s.phase==='playing'&&steps++<20000){const m=E.botMove(s,'hard');if(m.type==='play')E.play(s,m.source,m.pile);else if(m.type==='discard')E.discard(s,m.index,m.pile);else E.pass(s);}
 assert.equal(s.phase,'finished');
 const payload=G.scoreKeeperPayloadFromRounds({payload:s,history:s.history,presetKey:'skipbo',target:s.target,winMode:'high',scoreForRound:(h,p)=>h.scores[p.id]});
 assert.equal(payload.presetKey,'skipbo');assert.equal(payload.winnerId,s.winnerId);assert.equal(payload.rounds.length,1);
 for(const p of s.players)assert.equal(payload.rounds[0].scores[p.id],p.score);
 assert.equal(G.scoreKeeperExportBundle({scorekeeperPayload:payload}).app,'dashboard-game-export');
});
