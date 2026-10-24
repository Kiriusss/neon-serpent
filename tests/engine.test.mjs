import test from 'node:test';
import assert from 'node:assert/strict';
import {SnakeGame,WORLD,MISSIONS,UPGRADES} from '../dist/engine.js';
import {createProfile,getStats,getSquadStats} from '../dist/meta.js';

const seeded=seed=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function game(options={}){
  const events=[];const g=new SnakeGame({random:seeded(19),onEvent:(name,data)=>events.push({name,data})});g.reset(options);g.start();
  g.obstacles=[];g.food=[];g.enemies=[];g.projectiles=[];g.attackTimer=999;g._waveWait=-999;g._spawnTimer=999;g._bossAddsTimer=999;
  return {g,events};
}
function enemy(g,type='scout',p={},extra={}){const e=g._spawnEnemy(type,{x:10,z:12,...p});Object.assign(e,{attackTimer:999,chargeTimer:999,speed:0},extra);return e;}
function choose(g,id){g.status='choosing';g.choices=[UPGRADES.find(u=>u.id===id)];return g.chooseUpgrade(id);}
function advance(g,seconds,autoChoose=false){for(let t=0;t<seconds-1e-8;t+=.05){if(g.status==='choosing'&&autoChoose)g.chooseUpgrade(g.choices[0].id);g.update(Math.min(.05,seconds-t));}}

test('four mission contracts expose planar geometry and distinct real objectives',()=>{
  const seen=[];const g=new SnakeGame({random:seeded(1),onEvent:(...event)=>seen.push(event)});
  assert.deepEqual(WORLD,{x:32,y:1,z:24});assert.equal(g.status,'ready');assert.equal(seen.length,0);
  assert.equal(MISSIONS.length,4);assert.equal(new Set(MISSIONS.map(m=>m.type)).size,4);
  for(const m of MISSIONS){for(const field of ['id','code','name','type','description','briefing','recommendation','enemyTypes','targetTime','theme','color'])assert.ok(m[field],`${m.id}.${field}`);g.reset({mission:m.id});assert.equal(g.missionId,m.id);assert.equal(g.player.y,0);assert.equal(g.snake.length,5);assert.ok(g.obstacles.every(o=>o.w>0&&o.d>0&&o.y===0));}
  assert.ok(g.boss);g.reset({mission:'m2'});assert.ok(g.payload);g.reset({mission:'m3'});assert.equal(g.objectives.length,3);
});

test('continuous movement stops immediately, reverses freely, and normalizes diagonals',()=>{
  const {g}=game();const start={...g.player};g.setMove(1,0);g.update(.1);const step=g.player.x-start.x;assert.ok(step>0);
  g.setMove(0,0);g.update(.1);assert.equal(g.player.x,start.x+step);
  g.setMove(-1,0);g.update(.1);assert.ok(Math.abs(g.player.x-start.x)<1e-9);
  g.setMove(1,1);g.update(.1);assert.ok(Math.abs(dist(g.player,start)-step)<1e-9);assert.equal(g.player.y,0);
  assert.equal(g.setMove(NaN,0),false);assert.equal(g.turn('rise'),false);
});

test('scenery blocks walking and fast dashes, boundaries and own drones cause no damage',()=>{
  const {g}=game({stats:{shield:0}});g.obstacles=[{id:'wall',x:7,y:0,z:12,w:1,d:8}];g.setMove(1,0);g.dash();advance(g,1);
  assert.ok(g.player.x<=6.04+.001);assert.equal(g.hp,g.maxHp);
  g.obstacles=[];g.snake=g.snake.map(()=>({...g.player}));g.setMove(-1,0);advance(g,4);assert.ok(g.player.x>=.46);assert.equal(g.hp,g.maxHp);assert.equal(g.snake.length,5);
});

test('dash has two finite charges, invulnerable travel, and timed recharge',()=>{
  const {g}=game({stats:{shield:0,defense:0}});g.setMove(1,0);assert.equal(g.dash(),true);assert.equal(g.dashCharges,1);assert.equal(g.dash(),false);
  const hp=g.hp;g._takeDamage(40,'test');assert.equal(g.hp,hp);advance(g,.3);assert.equal(g.dash(),true);assert.equal(g.dashCharges,0);advance(g,.3);assert.equal(g.dash(),false);
  advance(g,4.1);assert.equal(g.dashCharges,1);advance(g,4.5);assert.equal(g.dashCharges,2);assert.equal(g.dashCooldown,0);
});

test('recovery stats and Iris support accelerate real dash charging within two to six seconds',()=>{
  const profile=createProfile(),base=game({stats:getStats(profile,'rook')}).g,supported=game({stats:getSquadStats(profile)}).g;
  assert.equal(base.dashRecharge,4.5);assert.equal(supported.dashRecharge,4);base.dash();supported.dash();advance(base,4.05);advance(supported,4.05);assert.equal(base.dashCharges,1);assert.equal(supported.dashCharges,2);
  const fast=game({stats:{energyRegen:1000}}).g,slow=game({stats:{energyRegen:0}}).g;assert.equal(fast.dashRecharge,2);assert.equal(slow.dashRecharge,6);choose(fast,'phase');assert.equal(fast.dashRecharge,2);assert.ok(fast.dashDuration>.24);
});

test('pause freezes movement, projectile positions, and all cooldowns',()=>{
  const {g}=game();g.skillRemaining=8;g.supportRemaining=12;g._fire(g.player,0);g.setMove(1,1);g.pause();const before=JSON.stringify(g);g.update(.1);assert.equal(JSON.stringify(g),before);assert.equal(g.dash(),false);assert.equal(g.useSkill(),false);g.resume();g.update(.1);assert.ok(g.elapsed>0);assert.ok(g.skillRemaining<8);
});

test('auto fire creates travelling projectiles and respects range and cover',()=>{
  const {g}=game({stats:{attack:30,crit:0}});const e=enemy(g);g.attackTimer=0;g.update(.01);assert.equal(e.hp,e.maxHp);assert.equal(g.projectiles.length,1);advance(g,.3);assert.equal(e.hp,e.maxHp-30);
  g.projectiles=[];g.attackTimer=0;e.x=30;g.update(.01);assert.equal(g.projectiles.length,0);e.x=10;g.obstacles=[{id:'cover',x:8,y:0,z:12,w:1,d:4}];g.update(.01);assert.equal(g.projectiles.length,0);
});

test('swept projectile collision cannot skip targets and enemy rounds can be dodged',()=>{
  const {g}=game({stats:{shield:0,defense:0}});const e=enemy(g,'scout',{x:10,z:12});g._fire(g.player,0,{damage:30,speed:120});g.update(.1);assert.equal(e.hp,e.maxHp-30);
  g.projectiles=[];g._fire({x:9,z:12,radius:.1},Math.PI,{hostile:true,damage:20,speed:20});advance(g,.2);assert.equal(g.hp,g.maxHp-20);
  g.invulnerable=0;g._fire({x:9,z:12,radius:.1},Math.PI,{hostile:true,damage:20,speed:20});g.setMove(0,1);advance(g,.2);assert.equal(g.hp,g.maxHp-20);
});

test('projectiles hit the first surface along their path, including enemies immediately before cover',()=>{
  const {g}=game();g.obstacles=[{id:'wall',x:8,y:0,z:12,w:1,d:4}];const e=enemy(g,'scout',{x:7,z:12});g._fire(g.player,0,{damage:30,speed:30});g.update(.1);assert.equal(e.hp,e.maxHp-30);
  e.x=9;g._fire(g.player,0,{damage:30,speed:80});g.update(.1);assert.equal(e.hp,e.maxHp-30);
  const escort=game({mission:'m2',stats:{shield:0}}).g;escort.player.x=2;escort._fire({x:8,z:12},Math.PI,{hostile:true,damage:30,speed:60});escort.update(.1);assert.ok(escort.payload.hp<escort.payload.maxHp);assert.equal(escort.hp,escort.maxHp);
});

test('scout, gunner, charger, and turret use distinct movement and fire rules',()=>{
  const {g}=game();const scout=enemy(g,'scout',{x:8,z:12},{speed:1.65}),gunner=enemy(g,'gunner',{x:5,z:15},{speed:1.1,attackTimer:0}),charger=enemy(g,'charger',{x:10,z:10},{speed:1.1,chargeTimer:0}),turret=enemy(g,'turret',{x:5,z:5},{attackTimer:0});
  g.update(.1);assert.ok(scout.x<8);assert.ok(gunner.z>15);assert.equal(turret.z,5);assert.ok(charger.telegraphRemaining>0);assert.ok(g.hazards.some(h=>h.type==='charge'));assert.equal(g.projectiles.filter(p=>p.hostile).length,4);
  advance(g,.9);assert.ok(charger.chargeRemaining>0);assert.ok(g.enemies.every(e=>e.y===0));
});

test('pursuing enemies navigate around cover instead of walking forever into a wall',()=>{
  const {g}=game({stats:{maxHp:1000}});g.obstacles=[{id:'wall',x:8,y:0,z:12,w:2,d:5}];const e=enemy(g,'scout',{x:12,z:12},{speed:1.65});
  advance(g,12);assert.ok(dist(e,g.player)<1.5,`enemy remained at ${e.x},${e.z}`);
});

test('experience is recovered automatically without growing the drone formation',()=>{
  const {g}=game();g.spawnFood({x:g.player.x,z:g.player.z},'xp');g.update(.01);assert.equal(g.xp,12);assert.equal(g.eaten,1);assert.equal(g.snake.length,5);assert.equal(g.food.length,0);
  const e=enemy(g);g._hitEnemy(e,1000);assert.equal(g.xp,12);assert.ok(g.food.some(f=>f.type==='xp'));assert.equal(g.kills,1);
});

test('level selection pauses, rejects invalid choices and preserves multiple earned levels',()=>{
  const {g,events}=game();g._gainXp(180);g._flush();assert.equal(g.status,'choosing');assert.equal(g.level,2);assert.equal(g.choices.length,3);assert.equal(new Set(g.choices.map(u=>u.id)).size,3);assert.equal(g.chooseUpgrade('unknown'),false);
  const elapsed=g.elapsed;g.update(.1);assert.equal(g.elapsed,elapsed);while(g.status==='choosing')g.chooseUpgrade(g.choices[0].id);assert.ok(g.level>=4);assert.equal(g.status,'playing');assert.equal(events.filter(e=>e.name==='upgrade').length,g.level-1);
});

test('an Iris collection burst preserves all experience across simultaneous level thresholds',()=>{
  const {g,events}=game({character:'iris'});for(let i=0;i<5;i++)g.spawnFood(g.player,'xp');g.useSkill();assert.equal(g.eaten,5);assert.equal(g.status,'choosing');assert.equal(g.xp,36);
  g.chooseUpgrade(g.choices[0].id);assert.equal(g.level,3);assert.equal(g.status,'choosing');assert.equal(g.xp,0);assert.equal(events.filter(e=>e.name==='level').length,2);
});

test('all fifteen roguelike upgrades change meaningful combat or recovery behavior',()=>{
  const {g}=game({stats:{attack:40,crit:0}});const initial={hp:g.maxHp,interval:g.attackInterval,speed:g.speed,range:g.attackRange,cooldown:g.stats.skillCooldown,dash:g.dashRecharge};g.hp=20;
  for(const u of UPGRADES)assert.equal(choose(g,u.id),true,u.id);
  assert.equal(UPGRADES.length,15);assert.equal(g.stats.attack,50);assert.equal(g.maxHp,initial.hp+30);assert.equal(g.hp,55);assert.ok(g.attackInterval<initial.interval);assert.equal(g.multishot,2);assert.equal(g.chainCount,1);assert.equal(g.frost,1);assert.equal(g.shieldRegen,1.5);assert.ok(g.stats.crit>0);assert.ok(g.speed>initial.speed);assert.ok(g.dashRecharge<initial.dash);assert.equal(g.killHeal,4);assert.equal(g.xpMultiplier,1.25);assert.ok(g.attackRange>initial.range);assert.equal(g.novaBurst,1);assert.ok(g.stats.skillCooldown<initial.cooldown);assert.equal(g.timeStopRemaining,4);
});

test('maxed upgrades are excluded and different random seeds produce different offers',()=>{
  const a=game().g,b=game().g;a.build=Array(5).fill('overdrive');a._gainXp(30);assert.ok(a.choices.every(u=>u.id!=='overdrive'));
  a.reset();a.start();a.random=seeded(100);b.random=seeded(900);a._gainXp(30);b._gainXp(30);assert.notDeepEqual(a.choices.map(u=>u.id),b.choices.map(u=>u.id));
});

test('three clear waves contain twenty-one enemies and terminal win only fires once',()=>{
  const {g,events}=game();g._waveWait=0;g.wave=1;g._spawnWave();let count=0;
  for(let wave=1;wave<=3;wave++){assert.equal(g.wave,wave);for(const e of [...g.enemies]){g._hitEnemy(e,10000);count++;}advance(g,2.5);}
  assert.equal(count,21);assert.equal(g.status,'won');assert.equal(g.objectiveProgress,1);assert.equal(g.choices.length,0);const score=g.score;g._finish(true,'again');g._flush();assert.equal(g.score,score);assert.equal(events.filter(e=>e.name==='won').length,1);
});

test('escort only moves within its tether and can fail independently of player health',()=>{
  const {g,events}=game({mission:'m2'});g.player.x=30;g.player.z=22;advance(g,2);assert.equal(g.payload.progress,0);assert.equal(g.payload.moving,false);
  Object.assign(g.player,{x:g.payload.x,z:g.payload.z});advance(g,2);assert.ok(g.payload.progress>0);assert.equal(g.payload.moving,true);assert.equal(g.payload.y,0);
  g._damagePayload(999);g._flush();assert.equal(g.status,'dead');assert.equal(g.hp,g.maxHp);assert.equal(g.payload.hp,0);assert.equal(events.filter(e=>e.name==='death').length,1);
});

test('escort follows its actual path to completion and hostile bullets damage the beacon',()=>{
  const {g}=game({mission:'m2',stats:{maxHp:1000}});g.player.x=30;g.player.z=20;g._fire({x:8,z:12,radius:.1},Math.PI,{hostile:true,damage:30,speed:20});advance(g,.2);assert.ok(g.payload.hp<g.payload.maxHp);
  for(let i=0;i<900&&g.status==='playing';i++){Object.assign(g.player,{x:g.payload.x,z:g.payload.z});g.update(.1);}
  assert.equal(g.status,'won');assert.equal(g.payload.progress,1);assert.equal(g.payload.routeIndex,g.payload.route.length);
});

test('capture requires six seconds inside, pauses when contested, and activates sites in order',()=>{
  const {g}=game({mission:'m3'});const first=g.objectives[0];Object.assign(g.player,{x:first.x,z:first.z});const invader=enemy(g,'scout',{x:first.x,z:first.z});advance(g,1);assert.equal(first.progress,0);g.enemies=[];
  advance(g,3);assert.ok(Math.abs(first.progress-.5)<.001);g.player.x=2;advance(g,2);assert.ok(Math.abs(first.progress-.5)<.001);Object.assign(g.player,{x:first.x,z:first.z});advance(g,3.1,true);assert.equal(first.complete,true);assert.equal(g.objectives[1].active,true);
  for(const o of g.objectives.slice(1)){g.enemies=[];Object.assign(g.player,{x:o.x,z:o.z});advance(g,6.1,true);}
  assert.equal(g.status,'won');assert.ok(g.objectives.every(o=>o.complete));assert.equal(g.objectiveProgress,1);assert.equal(g.choices.length,0);
});

test('boss changes attack phases and ground warnings, then wins before any level modal',()=>{
  const {g,events}=game({mission:'m4'});const b=g.boss;g.enemies=[b];b.speed=0;g._hitEnemy(b,b.maxHp*.31);assert.equal(b.phase,2);g._hitEnemy(b,b.maxHp*.35);assert.equal(b.phase,3);
  b.pattern=0;b.attackTimer=0;b.hazardTimer=0;g.update(.01);assert.equal(g.projectiles.filter(p=>p.hostile).length,16);assert.equal(g.hazards.filter(h=>h.type==='blast').length,2);assert.ok(g.hazards.some(h=>h.type==='beam'));
  g.xp=100;g._hitEnemy(b,10000);g._flush();assert.equal(g.status,'won');assert.equal(g.boss,null);assert.equal(g.choices.length,0);assert.deepEqual(events.filter(e=>e.name==='boss').map(e=>e.data.phase),[1,2,3]);assert.equal(events.filter(e=>e.name==='won').length,1);
});

test('a projectile-triggered boss transition clears both earlier and later hostile rounds atomically',()=>{
  const {g}=game({mission:'m4'}),b=g.boss;g.enemies=[b];Object.assign(b,{x:10,z:12,hp:b.maxHp*.7+1,speed:0,attackTimer:999,hazardTimer:999});g.projectiles=[];
  g._fire({x:20,z:20},0,{hostile:true,speed:1});g._fire(g.player,0,{damage:30,speed:100});g._fire({x:22,z:20},0,{hostile:true,speed:1});g.update(.05);
  assert.equal(b.phase,2);assert.equal(g.projectiles.filter(p=>p.hostile).length,0);
});

test('ground warnings deal damage only at detonation and can be crossed with dash invulnerability',()=>{
  const {g}=game({stats:{shield:0,defense:0}});g._addHazard({x:5,z:12,type:'blast',radius:2,duration:.3,damage:30});advance(g,.2);assert.equal(g.hp,g.maxHp);advance(g,.15);assert.equal(g.hp,g.maxHp-30);
  g.invulnerable=0;g._addHazard({x:g.player.x,z:g.player.z,type:'beam',radius:1,angle:0,length:15,width:2,duration:.1,damage:30});g.dash();g.update(.1);assert.equal(g.hp,g.maxHp-30);
});

test('starter and rare pilot skills, support combinations and cooldowns are functional',()=>{
  const {g}=game({character:'rook',supportIds:['aegis','nova','iris']});g.hp=20;assert.equal(g.useSkill(),true);assert.ok(Math.abs(g.hp-62)<1e-9);assert.equal(g.regenRemaining,6);assert.equal(g.useSkill(),false);
  assert.deepEqual(g.supportIds,['aegis','nova']);assert.equal(g.useSupport(),true);assert.equal(g.supportRemaining,25);assert.equal(g.attackBuffRemaining,8);assert.ok(g.shield>g.stats.shield);assert.equal(g.useSupport(),false);
  g.reset({character:'echo'});g.start();g.useSkill();assert.equal(g.timeStopRemaining,6);assert.equal(g.useSupport(),false);
  g.reset({character:'iris'});g.start();g.dashCharges=0;g.useSkill();assert.equal(g.dashCharges,2);assert.equal(g.magnetRemaining,7);
});

test('Nova clears nearby hostile projectiles while preserving friendly and distant rounds',()=>{
  const {g}=game({character:'nova'});const friendly=g._fire(g.player,0),near=g._fire({x:8,z:12},0,{hostile:true}),far=g._fire({x:22,z:12},0,{hostile:true});
  g.useSkill();assert.ok(g.projectiles.includes(friendly));assert.ok(g.projectiles.includes(far));assert.ok(!g.projectiles.includes(near));
});

test('death callback observes committed state and finished simulation never advances again',()=>{
  let g;const observed=[];g=new SnakeGame({onEvent(name){if(name==='death')observed.push({status:g.status,hp:g.hp,boosting:g.boosting,choices:g.choices.length});}});g.reset({stats:{maxHp:10,shield:0,defense:0}});g.start();g.boosting=true;g._takeDamage(50);g._flush();assert.deepEqual(observed,[{status:'dead',hp:0,boosting:false,choices:0}]);const elapsed=g.elapsed;g.update(.1);g._takeDamage(50);g._flush();assert.equal(g.elapsed,elapsed);assert.equal(observed.length,1);
});

test('invalid frame deltas are ignored and long frames are capped for stable collisions',()=>{
  const {g}=game();g.setMove(1,0);for(const dt of [-1,0,NaN,Infinity])g.update(dt);assert.equal(g.elapsed,0);g.update(1000);assert.equal(g.elapsed,.1);assert.ok(g.player.x<6);
});

const upgradePriority=['multishot','overdrive','accelerator','vampiric','chain','barrier','longshot','vitality','frost','precision','magnet','resonance','phase','chrono','novaBurst'];
function obstacleAt(g,p,pad=.65){return g.obstacles.some(o=>Math.abs(p.x-o.x)<o.w/2+pad&&Math.abs(p.z-o.z)<o.d/2+pad);}
// A small pathfinder sees only public arena geometry; it does not change simulation state.
function waypoint(g,target){
  const cell=p=>({x:Math.max(0,Math.min(31,Math.round(p.x-.5))),z:Math.max(0,Math.min(23,Math.round(p.z-.5)))}),start=cell(g.player),end=cell(target),key=p=>p.z*32+p.x;
  const queue=[start],visited=new Set([key(start)]),parents=new Map();let best=start,bestD=dist(start,end);
  for(let i=0;i<queue.length;i++){const p=queue[i],d=dist(p,end);if(d<bestD){best=p;bestD=d;}if(key(p)===key(end)){best=p;break;}
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const n={x:p.x+dx,z:p.z+dz},k=key(n);if(n.x<0||n.x>31||n.z<0||n.z>23||visited.has(k)||obstacleAt(g,{x:n.x+.5,z:n.z+.5}))continue;if(dx&&dz&&(obstacleAt(g,{x:p.x+dx+.5,z:p.z+.5})||obstacleAt(g,{x:p.x+.5,z:p.z+dz+.5})))continue;visited.add(k);parents.set(k,p);queue.push(n);}
  }
  if(bestD>dist(start,end)-.01)return target;let cursor=best;while(parents.has(key(cursor))&&key(parents.get(key(cursor)))!==key(start))cursor=parents.get(key(cursor));return {x:cursor.x+.5,z:cursor.z+.5};
}
function botMove(g,frame){
  const p=g.player,nearest=g.enemies.slice().sort((a,b)=>dist(p,a)-dist(p,b))[0],drop=g.food.slice().sort((a,b)=>dist(p,a)-dist(p,b))[0];let target;
  if(g.payload)target=g.payload;
  else if(g.objectives.length)target=g.objectives.find(o=>!o.complete)||p;
  else if(drop&&dist(p,drop)<8)target=drop;
  else if(nearest){const d=dist(p,nearest),angle=Math.atan2(p.z-nearest.z,p.x-nearest.x)+.15;target=d>8?nearest:{x:nearest.x+Math.cos(angle)*6,z:nearest.z+Math.sin(angle)*6};}
  else target=drop||{x:16,z:12};
  let goal=waypoint(g,target);if(dist(p,target)<1.5)goal=target;let best={x:0,z:0},scoreBest=-Infinity;
  for(const [x,z]of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]]){
    const q={x:p.x+x*g.speed*.1,z:p.z+z*g.speed*.1};if(q.x<.6||q.x>31.4||q.z<.6||q.z>23.4||obstacleAt(g,q,.6))continue;
    let score=-dist(q,goal)*2;if(g.payload&&dist(q,g.payload)>3.1)score-=8;if(g.objectives.length&&dist(q,target)<1.8)score+=3;
    for(const e of g.enemies){const d=dist(q,e);if(d<2.3)score-=(2.3-d)*12;}
    for(const h of g.hazards)if(h.remaining<.8&&g._insideHazard(h,q,.6))score-=30;
    for(const bullet of g.projectiles)if(bullet.hostile){const future={x:bullet.x+bullet.vx*.2,z:bullet.z+bullet.vz*.2};const d=dist(q,future);if(d<1.1)score-=(1.1-d)*14;}
    if(x===0&&z===0)score-=.05;if(score>scoreBest){scoreBest=score;best={x,z};}
  }
  g.setMove(best.x,best.z);
  if(g.dashCharges>0&&g.hazards.some(h=>h.remaining<.35&&g._insideHazard(h,p,.6)))g.dash();
  if(g.character==='rook'?g.hp<g.maxHp*.7:nearest&&dist(p,nearest)<8)g.useSkill();
  if(g.supportIds.length&&(g.hp<g.maxHp*.6||nearest&&dist(p,nearest)<7))g.useSupport();
}

for(const character of ['rook','iris'])for(const mission of MISSIONS)test(`unleveled ${character} clears ${mission.id} through public controls`,()=>{
  const profile=createProfile(),g=new SnakeGame({random:seeded(character==='rook'?11:23)});g.reset({character,mission:mission.id,stats:getStats(profile,character)});g.start();const phases=new Set();let frames=0;
  while(!['dead','won'].includes(g.status)&&frames++<6000){
    if(g.status==='choosing'){const choice=[...g.choices].sort((a,b)=>upgradePriority.indexOf(a.id)-upgradePriority.indexOf(b.id))[0];g.chooseUpgrade(choice.id);continue;}
    if(g.boss)phases.add(g.boss.phase);botMove(g,frames);g.update(.05);
    for(const p of [g.player,...g.snake,...g.enemies,...g.food,...g.projectiles]){assert.equal(p.y,0);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));}
  }
  assert.equal(g.status,'won',`${character}/${mission.id}: status=${g.status}, t=${g.elapsed.toFixed(1)}, HP=${g.hp.toFixed(1)}, enemies=${g.enemies.length}, objective=${g.objectiveProgress.toFixed(2)}, player=${g.player.x.toFixed(1)},${g.player.z.toFixed(1)}`);
  if(mission.id==='m1')assert.equal(g.kills,21);if(mission.id==='m4')assert.deepEqual([...phases],[1,2,3]);assert.ok(g.elapsed<220,'playable within a short session');
});
