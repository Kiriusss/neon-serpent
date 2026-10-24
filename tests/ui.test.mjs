import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {SnakeGame,WORLD,MISSIONS,UPGRADES} from '../dist/engine.js';
import * as meta from '../dist/meta.js';

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const code=(await readFile(new URL('../dist/main.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
function harness(saved){
  const {document,window:domWindow}=parseHTML(html);
  Object.defineProperty(document,'activeElement',{writable:true,value:document.body});
  Object.defineProperty(domWindow.HTMLElement.prototype,'offsetParent',{get(){return this.hidden?null:this.parentElement;},configurable:true});
  domWindow.HTMLElement.prototype.focus=function(){document.activeElement=this;};
  const store=new Map(saved?[['starfall.profile.v2',JSON.stringify(saved)]]:[]),timers=new Map(),errors=[],events={};let timer=0;
  class Arena{constructor(){this.low=false;}setQuality(v){this.low=v;}setCharacter(c){this.character=c;}setMission(m){this.mission=m;}setMenu(v){this.menu=v;}render(){}effect(){}cycleCamera(){return '俯视';}dispose(){}}
  class SoundEngine{setMuted(v){this.muted=v;}async unlock(){return true;}setPlaying(v){this.playing=v;}setBoost(v){this.boost=v;}play(){}dispose(){}}
  const context=vm.createContext({document,window:{addEventListener:(n,f)=>events[n]=f},console:{...console,error:(...args)=>errors.push(args)},SnakeGame,WORLD,MISSIONS,UPGRADES,...meta,pull:(p,n)=>meta.pull(p,n,()=>.99),Arena,SoundEngine,
    crypto:{randomUUID},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
    matchMedia:()=>({matches:false}),requestAnimationFrame(){},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),location:{reload(){}}});
  vm.runInContext(code,context);assert.deepEqual(errors,[],'menu initialization has no runtime errors');
  return {document,store,events,pointer(selector,type,pointerId){const e=new domWindow.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId});document.querySelector(selector).dispatchEvent(e);},run:expression=>vm.runInContext(expression,context),state:()=>vm.runInContext('({phase,profile,game,draws,settled,runStarted,missionId,screen,arena,secretaryId})',context),
    key(key,options={}){const e=new domWindow.Event(options.type||'keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,code:key===' '?'Space':key,repeat:false,...options});(document.activeElement||document.body).dispatchEvent(e);return e;}};
}
async function playing(h){await h.run('start()');h.run('for(let i=0;i<29;i++)frame(i*100);');assert.equal(h.state().phase,'playing');}

test('actual home initializes, all five functional pages render and secretary changes independently',()=>{
  const h=harness();assert.equal(h.state().profile.crystals,1600);assert.equal(h.document.querySelector('#loading').hidden,true);assert.equal(h.state().secretaryId,'iris');
  for(const name of ['campaign','squad','roster','gacha','lobby']){h.document.querySelector('[data-screen="'+name+'"]').click();assert.equal(h.state().screen,name);assert.equal(h.document.querySelector('#'+name).hidden,false);}
  assert.equal(h.document.querySelectorAll('.character-card').length,6);assert.equal(h.document.querySelectorAll('.squad-slot').length,3);assert.equal(h.document.querySelectorAll('.mission-node').length,4);
  h.document.querySelector('#change-secretary').click();assert.equal(h.state().secretaryId,'rook');assert.equal(h.state().profile.selected,'rook');assert.ok(h.store.has('starfall.profile.v2'));
});

test('locked missions expose briefing but cannot deploy, unlocked mission and difficulty reach engine',async()=>{
  const h=harness();h.run("showScreen('campaign')");h.document.querySelector('[data-mission="m4"]').click();assert.equal(h.state().missionId,'m4');assert.equal(h.document.querySelector('#deploy-mission').disabled,true);
  await h.run('start()');assert.equal(h.state().phase,'menu');h.document.querySelector('[data-mission="m1"]').click();h.document.querySelector('[data-difficulty="hard"]').click();await h.run('start()');assert.equal(h.state().game.missionId,'m1');assert.equal(h.state().game.difficulty,'hard');
});

test('ten-pull UI debits once, guarantees only rare tier, renders ten results and persists pity',()=>{
  const h=harness();h.run('recruit(10)');assert.equal(h.state().profile.crystals,0);assert.equal(h.state().draws.length,10);assert.equal(h.state().draws.filter(d=>d.rarity==='SSR').length,0);assert.equal(h.state().draws.filter(d=>d.rarity==='SR').length,1);
  h.run('recruit(10)');assert.equal(h.state().profile.crystals,0);assert.equal(h.state().profile.gacha.total,10);
  h.run('revealDraws()');assert.equal(h.document.querySelectorAll('.draw-card').length,10);assert.equal(h.document.querySelector('#summon-results').hidden,false);assert.equal(h.key('Enter',{repeat:true}).defaultPrevented,true);
  const persisted=JSON.parse(h.store.get('starfall.profile.v2'));assert.equal(persisted.gacha.pitySSR,10);assert.equal(persisted.version,3);
});

test('V2 currency, ownership, growth and old pity survive real UI initialization without free refills',()=>{
  const saved=meta.createProfile();saved.version=2;saved.crystals=237;saved.materials=51;saved.characters.nova.owned=true;saved.characters.nova.level=7;saved.selected='nova';saved.gacha={total:17,pitySSR:7,pitySR:2,beginnerClaimed:true};delete saved.squad;delete saved.stageRecords;
  const h=harness(saved);assert.equal(h.state().profile.crystals,237);assert.equal(h.state().profile.characters.nova.level,7);assert.equal(h.state().profile.selected,'nova');assert.equal(h.state().profile.gacha.pitySSR,7);assert.equal(h.document.querySelector('#ssr-pity').textContent,'7 / 80');assert.equal(h.state().profile.version,3);
});

test('squad selection swaps lead, removes support, and passes real combined stats to combat',async()=>{
  const h=harness();h.run("showScreen('squad')");h.document.querySelector('[data-slot="0"]').click();h.document.querySelector('[data-pick-id="iris"]').click();assert.deepEqual(Array.from(h.state().profile.squad),['iris','rook',null]);
  await h.run('start()');assert.equal(h.state().game.character,'iris');assert.equal(h.state().game.stats.defense,meta.getStats(h.state().profile,'iris').defense+4);assert.deepEqual(Array.from(h.state().game.supportIds),['rook']);
  h.run("goHome('squad')");h.document.querySelector('[data-slot="1"]').click();h.document.querySelector('#modal-actions button').click();assert.equal(h.state().profile.squad[1],null);
});

test('cultivation button consumes materials and enhanced character reaches the next run',async()=>{
  const h=harness();h.run("showScreen('roster')");h.document.querySelector('[data-character="iris"]').click();h.document.querySelector('[data-level="iris"]').click();assert.equal(h.state().profile.materials,165);assert.equal(h.state().profile.characters.iris.level,2);
  h.document.querySelector('[data-deploy="iris"]').click();await h.run('start()');assert.equal(h.state().game.character,'iris');assert.equal(h.state().game.stats.attack,meta.getSquadStats(h.state().profile).attack);
});

test('WASD release stops, reversals work, duplicate direction keys and toolbar-focused dash work',async()=>{
  const h=harness();await playing(h);h.run('game.enemies=[];game._waveWait=-100;game.obstacles=[]');const z=h.state().game.player.z;h.key('w');h.key('ArrowUp');h.run('game.update(.1)');assert.ok(h.state().game.player.z<z);
  h.key('w',{type:'keyup'});const next=h.state().game.player.z;h.run('game.update(.1)');assert.ok(h.state().game.player.z<next,'arrow is still held');h.key('ArrowUp',{type:'keyup'});const stopped=h.state().game.player.z;h.run('game.update(.1)');assert.equal(h.state().game.player.z,stopped);
  h.key('s');h.run('game.update(.1)');assert.ok(h.state().game.player.z>stopped);h.key('s',{type:'keyup'});assert.equal(h.state().game.player.y,0);
  h.document.querySelector('#quality').focus();assert.equal(h.key(' ').defaultPrevented,true);assert.equal(h.state().game.dashCharges,1);h.key(' ',{repeat:true});assert.equal(h.state().game.dashCharges,1);h.key('q');assert.equal(h.state().game.supportRemaining,25);
});

test('opening build during countdown pauses and resumes countdown without background combat',async()=>{
  const h=harness();await h.run('start()');h.document.querySelector('#build-open').click();assert.equal(h.state().phase,'paused');h.run('for(let i=0;i<60;i++)frame(i*100)');assert.equal(h.state().game.elapsed,0);assert.equal(h.state().runStarted,false);
  h.document.querySelector('#modal-actions button').click();assert.equal(h.state().phase,'countdown');h.run('for(let i=60;i<90;i++)frame(i*100)');assert.equal(h.state().phase,'playing');
});

test('upgrade modal freezes battle, preserves pause state and applies chosen modifier',async()=>{
  const h=harness();await playing(h);h.run('game._gainXp(30);game._flush()');assert.equal(h.state().phase,'choosing');const elapsed=h.state().game.elapsed;h.run('frame(3100)');assert.equal(h.state().game.elapsed,elapsed);
  h.run('pause();resume()');assert.equal(h.state().phase,'choosing');assert.equal(h.document.querySelector('#upgrade-overlay').hidden,false);const id=h.state().game.choices[0].id;h.document.querySelector('[data-upgrade="'+id+'"]').click();assert.equal(h.state().phase,'playing');assert.ok(h.state().game.build.includes(id));
});

test('blur clears held input and pauses without resuming automatically',async()=>{
  const h=harness();await playing(h);h.key('d');h.events.blur();assert.equal(h.state().phase,'paused');assert.equal(h.state().game._move.x,0);h.run('resume()');assert.equal(h.state().game._move.x,0);
});

test('P toggles pause once per press and touch cancellation releases only the relevant direction',async()=>{
  const h=harness();await playing(h);h.key('p');assert.equal(h.state().phase,'paused');h.key('p',{repeat:true});assert.equal(h.state().phase,'paused');h.key('p');assert.equal(h.state().phase,'playing');
  h.pointer('[data-move="up"]','pointerdown',1);h.pointer('[data-move="right"]','pointerdown',2);assert.ok(h.state().game._move.x>0&&h.state().game._move.z<0);
  h.pointer('[data-move="up"]','pointercancel',1);assert.equal(h.state().game._move.z,0);assert.equal(h.state().game._move.x,1);h.pointer('[data-move="right"]','lostpointercapture',2);assert.equal(h.state().game._move.x,0);
});

test('countdown cancellation and early retreat never award currency',async()=>{
  const h=harness();await h.run('start()');h.run('finish(false,true)');assert.equal(h.state().profile.crystals,1600);assert.equal(h.state().profile.totalRuns,0);
  h.run('goHome()');await playing(h);h.run('finish(false,true)');assert.equal(h.state().profile.crystals,1600);assert.equal(h.state().profile.wins,0);
});

test('victory awards first clear once, records stars, unlocks next stage and result cannot be overwritten',async()=>{
  const h=harness();await playing(h);h.run("game.elapsed=60;game._finish(true,'目标完成');game._emit('skill',{});game._flush()");
  assert.equal(h.state().phase,'results');assert.equal(h.state().profile.crystals,1820);assert.equal(h.state().profile.stageRecords.m1.bestStars,3);assert.equal(h.state().profile.unlockedMissions.includes('m2'),true);assert.equal(h.document.querySelector('#upgrade-overlay').hidden,true);
  h.run('finish(true);settleCurrent(true)');assert.equal(h.state().profile.crystals,1820);h.document.querySelector('#modal-actions button').click();assert.equal(h.state().phase,'menu');assert.equal(h.state().screen,'campaign');assert.equal(h.state().missionId,'m2');
  await h.run('start()');assert.equal(h.state().game.missionId,'m2');assert.equal(h.state().game.build.length,0);assert.equal(h.document.querySelector('#build-count').textContent,'0');
});
