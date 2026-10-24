import test from 'node:test';
import assert from 'node:assert/strict';
import {SnakeGame,WORLD,DIRECTIONS,UPGRADES} from '../dist/engine.js';
import {createProfile,getStats} from '../dist/meta.js';
function game(options={}){const events=[];const g=new SnakeGame({random:()=>.5,onEvent:(name,data)=>events.push({name,data})});g.reset(options);g.start();g.obstacles=[];g.food=[];g.enemies=[];g.attackTimer=999;return {g,events};}
function enemy(g,p={},extra={}){const e={id:`enemy-${g.enemies.length}`,x:9,y:3,z:7,hp:100,maxHp:100,type:'scout',damage:20,moveTimer:999,attackTimer:999,frozen:0,...p,...extra};g.enemies.push(e);return e;}
function choose(g,id){g.status='choosing';g.choices=[UPGRADES.find(u=>u.id===id)];return g.chooseUpgrade(id);}
test('reset creates XYZ world, layered food and enemies without callbacks',()=>{const seen=[];const g=new SnakeGame({random:()=>.5,onEvent:(...x)=>seen.push(x)});assert.equal(seen.length,0);assert.deepEqual(WORLD,{x:14,y:7,z:14});assert.equal(g.status,'ready');assert.equal(g.enemies.length,4);assert.equal(new Set(g.food.map(f=>f.y)).size,7);const all=[...g.snake,...g.food,...g.enemies,...g.obstacles];assert.equal(new Set(all.map(p=>`${p.x},${p.y},${p.z}`)).size,all.length);});
test('all six directions alter the corresponding coordinate',()=>{for(const [name,v]of Object.entries(DIRECTIONS)){const {g}=game();g.snake=[{x:6,y:3,z:7}];g.direction=name;g.step();assert.deepEqual(g.snake[0],{x:6+v[0],y:3+v[1],z:7+v[2]});}});
test('two queued 3D turns reject direct reversals',()=>{const {g}=game();assert.equal(g.turn('left'),false);assert.equal(g.turn('right'),false);assert.equal(g.turn('rise'),true);assert.equal(g.turn('fall'),false);assert.equal(g.turn('up'),true);assert.equal(g.turn('left'),false);g.step();assert.deepEqual(g.snake[0],{x:6,y:4,z:7});g.step();assert.deepEqual(g.snake[0],{x:6,y:4,z:6});});
test('same horizontal coordinate at another height is not a collision',()=>{const {g}=game({stats:{shield:0}});g.snake=[{x:6,y:4,z:7},{x:7,y:3,z:7},{x:6,y:3,z:7}];g.step();assert.equal(g.hp,g.maxHp);assert.deepEqual(g.snake[0],{x:7,y:4,z:7});});
test('true self collision damages and shortens but phase passes through',()=>{for(const boost of [false,true]){const {g}=game({stats:{shield:0,defense:0}});g.snake=[{x:6,y:3,z:7},{x:6,y:4,z:7},{x:7,y:4,z:7},{x:7,y:3,z:7},{x:7,y:2,z:7}];g.boosting=boost;g.step();assert.equal(g.hp,g.maxHp-(boost?0:20));assert.equal(g.snake.length,boost?5:3);}});
test('XYZ boundaries wrap and charge damage even while boosting',()=>{const cases=[['right',{x:13,y:3,z:7},{x:0,y:3,z:7}],['rise',{x:6,y:6,z:7},{x:6,y:0,z:7}],['fall',{x:6,y:0,z:7},{x:6,y:6,z:7}],['up',{x:6,y:3,z:0},{x:6,y:3,z:13}]];for(const [dir,start,end]of cases){const {g}=game({stats:{shield:0,defense:0}});g.snake=[start];g.direction=dir;g.boosting=true;g.step();assert.deepEqual(g.snake[0],end);assert.equal(g.hp,g.maxHp-14);assert.ok(g.invulnerable>0);}});
test('shield absorbs before HP and invulnerability prevents frame stacking',()=>{const {g}=game({stats:{shield:15,defense:4}});g._takeDamage(25,'test');assert.equal(g.shield,0);assert.equal(g.hp,g.maxHp-6);g._takeDamage(25,'test');assert.equal(g.hp,g.maxHp-6);});
test('volumetric food and altitude combos reward three-dimensional routes',()=>{const {g,events}=game();g.food=[{id:'above',x:7,y:4,z:7,type:'normal'},{id:'level',x:7,y:3,z:7,type:'normal'}];g.step();assert.equal(g.eaten,1);assert.equal(g.snake.length,7);assert.equal(g.score,80);g.turn('rise');g.step();assert.equal(g.eaten,2);assert.equal(g.score,320);assert.equal(events.filter(e=>e.name==='eat').at(-1).data.heightCombo,true);});
test('pause freezes movement combat and skill cooldowns',()=>{const {g}=game();enemy(g);g.skillRemaining=8;g.pause();const before=JSON.stringify(g);g.update(.1);g.step();assert.equal(g.turn('rise'),false);assert.equal(JSON.stringify(g),before);g.resume();g.update(.1);assert.ok(g.elapsed>0);assert.ok(g.skillRemaining<8);});
test('automatic fire uses Euclidean 3D range and character attack',()=>{const {g}=game({stats:{attack:30,crit:0}});const near=enemy(g,{x:7,y:4,z:7}),far=enemy(g,{x:13,y:6,z:13});g.attackTimer=0;g.update(.01);assert.equal(near.hp,70);assert.equal(far.hp,100);assert.equal(g.shots.length,1);assert.equal(g.shots[0].to.y,4);});
test('level-up pauses and only a real offered choice resumes',()=>{const {g,events}=game();g._gainXp(30);g._flush();assert.equal(g.status,'choosing');assert.equal(g.level,2);assert.equal(g.choices.length,3);assert.equal(new Set(g.choices.map(u=>u.id)).size,3);const elapsed=g.elapsed;g.update(.1);assert.equal(g.elapsed,elapsed);assert.equal(g.chooseUpgrade('invalid'),false);assert.equal(events.find(e=>e.name==='level').data.choices.length,3);const chosen=g.choices[0].id;assert.equal(g.chooseUpgrade(chosen),true);assert.equal(g.status,'playing');assert.ok(g.build.includes(chosen));});
test('roguelike upgrades change attack fire-rate health targeting and pickup',()=>{const {g}=game({stats:{attack:40,crit:0}});choose(g,'overdrive');assert.equal(g.stats.attack,50);choose(g,'accelerator');assert.ok(Math.abs(g.attackInterval-.672)<1e-9);choose(g,'multishot');choose(g,'chain');assert.equal(g.multishot,2);assert.equal(g.chainCount,1);g.hp=20;choose(g,'vitality');assert.equal(g.maxHp,150);assert.equal(g.hp,50);choose(g,'magnet');g.food=[{id:'vertical',x:6,y:4,z:7,type:'normal'}];g.update(.01);assert.equal(g.eaten,1);});
test('maxed upgrades are excluded from offers',()=>{const {g}=game();g.build=Array(5).fill('overdrive');g._gainXp(30);assert.ok(g.choices.every(u=>u.id!=='overdrive'));});
test('clearing the fourth wave heals and creates the final boss',()=>{const {g}=game();g.wave=4;g.hp=50;const last=enemy(g,{}, {hp:1});g._hitEnemy(last,10,g.snake[0]);g._flush();assert.equal(g.wave,5);assert.equal(g.hp,68);assert.equal(g.enemies.filter(e=>e.type==='boss').length,1);assert.equal(g.boss,g.enemies.find(e=>e.type==='boss'));});
test('boss defeat wins exactly once with no pending upgrade dialog',()=>{const {g,events}=game();g.wave=5;const boss=enemy(g,{}, {hp:1,type:'boss'});g.boss=boss;g._hitEnemy(boss,10,g.snake[0]);g._flush();assert.equal(g.status,'won');assert.equal(g.boss,null);assert.equal(g.choices.length,0);const score=g.score;g.update(.1);g._finish(true,'again');g._flush();assert.equal(g.score,score);assert.equal(events.filter(e=>e.name==='won').length,1);});
test('hazard blasts can be dodged vertically',()=>{const {g}=game({stats:{shield:0,defense:0}});enemy(g);g.hazards=[{id:'bomb',x:6,y:2,z:7,radius:.8,remaining:.01,damage:30}];g.update(.02);assert.equal(g.hp,g.maxHp);g.hazards=[{id:'bomb2',x:6,y:3,z:7,radius:.8,remaining:.01,damage:30}];g.update(.02);assert.equal(g.hp,g.maxHp-30);});
test('character skills have distinct effects and consume cooldown',()=>{const {g}=game({character:'rook'});g.hp=20;g.energy=10;assert.equal(g.useSkill(),true);assert.equal(g.hp,56);assert.equal(g.energy,45);assert.equal(g.useSkill(),false);g.reset({character:'echo'});g.start();assert.equal(g.useSkill(),true);assert.equal(g.timeStopRemaining,6);g.reset({character:'iris'});g.start();g.food=[{id:'far',x:8,y:5,z:7,type:'normal'}];g.useSkill();assert.equal(g.eaten,1);assert.equal(g.magnetRemaining,6);});
test('finite phase energy drains and regenerates without automatic reactivation',()=>{const {g}=game();enemy(g);g.energy=3;g.setBoost(true);g.update(.1);assert.equal(g.boosting,false);assert.equal(g.boostRequested,false);const e=g.energy;g.update(.1);assert.ok(g.energy>e);});
test('callbacks observe committed death and fire once',()=>{let g;const observed=[];g=new SnakeGame({onEvent(name){if(name==='death')observed.push({status:g.status,hp:g.hp,boosted:g.boosting});}});g.reset({stats:{maxHp:10,shield:0,defense:0}});g.start();g.boosting=true;g._takeDamage(50,'test');g._flush();assert.deepEqual(observed,[{status:'dead',hp:0,boosted:false}]);g._takeDamage(50,'again');g._flush();assert.equal(observed.length,1);});
test('a killing chain cannot jump into the next wave from the previous target',()=>{
  const {g}=game({stats:{attack:30,crit:0}});enemy(g,{x:7,y:3,z:7},{hp:1});g.chainCount=3;g.attackTimer=0;
  g._spawnWave=()=>{g.enemies=[{id:'next-wave',x:8,y:3,z:7,hp:100,maxHp:100,type:'scout',damage:20,moveTimer:999,attackTimer:999,frozen:0}];};
  g.update(.01);assert.equal(g.wave,2);assert.equal(g.enemies[0].hp,100);assert.equal(g.shots.length,1);
});

const seeded=seed=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
const positionKey=p=>`${p.x},${p.y},${p.z}`;
const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const upgradePriority=['multishot','overdrive','vampiric','accelerator','chain','barrier','longshot','vitality','frost','precision','magnet','resonance','phase','chrono','novaBurst'];
// A deterministic, local six-axis bot: it observes the same coordinates and stats as a player.
function safeDirection(g){
  const head=g.snake[0],current=DIRECTIONS[g.direction],blocked=new Set([...g.obstacles,...g.snake.slice(0,-1)].map(positionKey));
  const threats=g.enemies.filter(e=>e.frozen===0&&g.timeStopRemaining===0);let best=null,bestScore=-Infinity;
  for(const [dir,d]of Object.entries(DIRECTIONS)){
    if(d.every((value,i)=>value+current[i]===0))continue;
    const p={x:head.x+d[0],y:head.y+d[1],z:head.z+d[2]};
    if(p.x<0||p.x>=WORLD.x||p.y<0||p.y>=WORLD.y||p.z<0||p.z>=WORLD.z||blocked.has(positionKey(p)))continue;
    let score=0;for(const e of threats){const dist=distance3(p,e);if(dist<2.1)score-=(2.1-dist)*12;}
    for(const h of g.hazards)if(h.remaining<1.5&&distance3(p,h)<h.radius+1)score-=30;
    const closest=g.food.map(f=>({f,d:distance3(p,f)})).sort((a,b)=>a.d-b.d)[0];
    if(closest){score-=closest.d*1.5;if(closest.d<=g.stats.pickupRadius)score+=12;if(g.hp<g.maxHp*.6&&closest.f.type==='heal')score+=7;}
    const nearest=threats.reduce((n,e)=>Math.min(n,distance3(p,e)),100);if(nearest>g.attackRange-1)score-=nearest-g.attackRange+1;
    if(dir===g.direction)score+=.05;if(score>bestScore){best=dir;bestScore=score;}
  }
  return best;
}
for(const id of ['rook','iris','nova','aegis','echo','lyra'])test(`unleveled ${id} can complete all five waves in a deterministic six-axis run`,()=>{
  for(const seed of [11,23]){
    const profile=createProfile();profile.characters[id].owned=true;
    const g=new SnakeGame({random:seeded(seed)});g.reset({character:id,stats:getStats(profile,id)});g.start();let frames=0;const seen=new Set([g.wave]);
    while(!['dead','won'].includes(g.status)&&frames++<18000){
      if(g.status==='choosing'){const pick=[...g.choices].sort((a,b)=>upgradePriority.indexOf(a.id)-upgradePriority.indexOf(b.id))[0];assert.ok(pick);g.chooseUpgrade(pick.id);}
      assert.equal(g.status,'playing');
      if(!g.queue.length){const dir=safeDirection(g);if(dir)g.turn(dir);}
      if(g.skillRemaining<=0)g.useSkill();g.update(.05);seen.add(g.wave);
      for(const value of [g.hp,g.energy,g.score,g.xp,g.skillRemaining,...g.snake.flatMap(p=>[p.x,p.y,p.z])])assert.ok(Number.isFinite(value));
    }
    assert.equal(g.status,'won',`${id}, seed ${seed}: ${g.reason}`);assert.equal(g.wave,5);assert.equal(g.boss,null);assert.ok(g.level>1);assert.equal(seen.size,5);
  }
});
