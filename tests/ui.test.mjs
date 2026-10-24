import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {SnakeGame,WORLD,UPGRADES} from '../dist/engine.js';
import * as meta from '../dist/meta.js';

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const code=(await readFile(new URL('../dist/main.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
function harness(saved){
  const {document,window:domWindow}=parseHTML(html);
  Object.defineProperty(document,'activeElement',{writable:true,value:document.body});
  Object.defineProperty(domWindow.HTMLElement.prototype,'offsetParent',{get(){return this.hidden?null:this.parentElement;},configurable:true});
  domWindow.HTMLElement.prototype.focus=function(){document.activeElement=this;};
  const store=new Map(saved?[['starfall.profile.v2',JSON.stringify(saved)]]:[]),timers=new Map();let timer=0;
  class Arena{constructor(){this.low=false;this.cameraLabel='等轴';}setQuality(v){this.low=v;}setCharacter(c){this.character=c;}setMenu(v){this.menu=v;}render(){}effect(){}cycleCamera(){return '俯视';}orbit(){}}
  class SoundEngine{setMuted(v){this.muted=v;}async unlock(){return true;}setPlaying(v){this.playing=v;}setBoost(v){this.boost=v;}play(){}dispose(){}}
  const context=vm.createContext({document,window:{addEventListener(){}},console,SnakeGame,WORLD,UPGRADES,...meta,Arena,SoundEngine,
    crypto:{randomUUID},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
    matchMedia:()=>({matches:false}),requestAnimationFrame(){},setTimeout:(fn)=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),location:{reload(){}}});
  vm.runInContext(code,context);
  return {document,store,run:expression=>vm.runInContext(expression,context),state:()=>vm.runInContext('({phase,profile,game,draws,settled,runStarted})',context),
    key(key,options={}){const e=new domWindow.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,code:key===' '?'Space':key,repeat:false,...options});(document.activeElement||document.body).dispatchEvent(e);return e;}};
}
async function playing(h){await h.run('start()');h.run('for(let i=0;i<29;i++)frame(i*100);');assert.equal(h.state().phase,'playing');}

test('the actual menu HTML initializes with currency, six portrait cards and persistent profile',()=>{
  const h=harness();assert.equal(h.state().profile.crystals,3200);assert.equal(h.document.querySelector('#loading').hidden,true);
  h.run("showScreen('roster')");assert.equal(h.document.querySelectorAll('.character-card').length,6);assert.ok(h.store.has('starfall.profile.v2'));
});
test('ten-pull UI debits once, reveals all ten and records the guaranteed SSR',()=>{
  const h=harness();h.run('recruit(10)');assert.equal(h.state().profile.crystals,1600);assert.equal(h.state().draws.length,10);assert.ok(h.state().draws.some(d=>d.rarity==='SSR'));
  h.run('recruit(10)');assert.equal(h.state().profile.crystals,1600,'overlay prevents another debit');
  h.run('revealDraws()');assert.equal(h.document.querySelectorAll('.draw-card').length,10);assert.equal(h.document.querySelector('#summon-results').hidden,false);
  const repeated=h.key('Enter',{repeat:true});assert.equal(repeated.defaultPrevented,true);
});
test('roster button events cultivate and deploy a pilot whose stats reach the combat engine',async()=>{
  const h=harness();h.run("showScreen('roster')");h.document.querySelector('[data-character="iris"]').click();
  h.document.querySelector('[data-level="iris"]').click();assert.equal(h.state().profile.materials,165);
  h.document.querySelector('[data-deploy="iris"]').click();assert.equal(h.state().profile.selected,'iris');
  await h.run('start()');assert.equal(h.state().game.character,'iris');assert.equal(h.state().game.stats.attack,25.2);assert.equal(h.state().game.stats.pickupRadius,1.35);
});
test('cancelling countdown or retreating before ten seconds grants no currency',async()=>{
  const h=harness();await h.run('start()');h.run('pause();finish(false,true)');assert.equal(h.state().profile.crystals,3200);assert.equal(h.state().profile.totalRuns,0);
  h.run('goHome()');await playing(h);h.run('finish(false,true)');assert.equal(h.state().profile.crystals,3200);assert.equal(h.state().profile.totalRuns,0);
});
test('upgrade selection freezes combat, survives pause and resumes with a real modifier',async()=>{
  const h=harness();await playing(h);h.run('game._gainXp(30);game._flush()');assert.equal(h.state().phase,'choosing');
  const before=h.state().game.elapsed;h.run('frame(3100)');assert.equal(h.state().game.elapsed,before);
  h.run('pause();resume()');assert.equal(h.state().phase,'choosing');assert.equal(h.document.querySelector('#upgrade-overlay').hidden,false);
  const chosen=h.state().game.choices[0].id;h.document.querySelector('[data-upgrade="'+chosen+'"]').click();
  assert.equal(h.state().phase,'playing');assert.ok(h.state().game.build.includes(chosen));assert.equal(h.document.querySelector('#upgrade-overlay').hidden,true);
});
test('all six input keys control XYZ, including phase while a toolbar has keyboard focus',async()=>{
  const h=harness();await playing(h);h.key('q');assert.equal(h.state().game.queue[0],'rise');h.run('game.step()');assert.equal(h.state().game.snake[0].y,4);
  h.document.querySelector('#quality').focus();const event=h.key(' ');assert.equal(event.defaultPrevented,true);assert.equal(h.state().game.boostRequested,true);
});
test('a completed run settles once and a new run clears the previous build HUD',async()=>{
  const h=harness();await playing(h);h.run("game.elapsed=12;game.build=['overdrive'];updateHud();finish(false,true)");
  const crystals=h.state().profile.crystals;assert.ok(crystals>3200);h.run('finish(false,true);settleCurrent(false)');assert.equal(h.state().profile.crystals,crystals);
  await h.run('start()');assert.equal(h.document.querySelector('#build-count').textContent,'0');assert.equal(h.document.querySelectorAll('.build-item').length,0);
});
test('victory remains the result screen even when a skill event was queued afterwards',async()=>{
  const h=harness();await playing(h);h.run("game._finish(true,'test');game._emit('skill',{name:'超新星坍缩'});game._flush()");
  assert.equal(h.state().phase,'results');assert.equal(h.state().profile.wins,1);assert.equal(h.document.querySelector('#upgrade-overlay').hidden,true);
});
