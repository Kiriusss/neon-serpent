export const WORLD = Object.freeze({ x: 14, y: 7, z: 14 });
export const SIZE = WORLD.x;
export const DIRECTIONS = Object.freeze({ up:[0,0,-1], down:[0,0,1], left:[-1,0,0], right:[1,0,0], rise:[0,1,0], fall:[0,-1,0] });
export const WAVE_NAMES = ['破碎航道','失重庭院','回声熔炉','零界深井','寂星之心'];
export const UPGRADES = Object.freeze([
  {id:'overdrive',name:'超频核心',description:'攻击力提升25%。武器与主动技能共同受益。',rarity:'R',maxStacks:5,icon:'✦',tag:'火力'},
  {id:'vitality',name:'生命编织',description:'最大生命+30，立即回复30点生命。',rarity:'R',maxStacks:4,icon:'＋',tag:'生存'},
  {id:'accelerator',name:'脉冲加速器',description:'自动攻击间隔缩短16%。',rarity:'SR',maxStacks:4,icon:'»',tag:'火力'},
  {id:'multishot',name:'分形弹幕',description:'每次自动攻击额外锁定1个不同的敌人。',rarity:'SSR',maxStacks:3,icon:'⋈',tag:'弹幕'},
  {id:'chain',name:'链式雷鸣',description:'攻击向3.5格内另一敌人弹射，造成55%伤害；每层增加1次弹射。',rarity:'SR',maxStacks:3,icon:'ϟ',tag:'连锁'},
  {id:'frost',name:'绝对零域',description:'命中冻结敌人1.2秒，每层额外延长0.6秒。',rarity:'SR',maxStacks:3,icon:'❄',tag:'控制'},
  {id:'barrier',name:'再生棱镜',description:'护盾上限和当前护盾+20，每秒回复1.5护盾。',rarity:'SR',maxStacks:4,icon:'◇',tag:'生存'},
  {id:'precision',name:'弱点解析',description:'暴击率+12%，暴击伤害额外+10%。',rarity:'R',maxStacks:4,icon:'⌖',tag:'暴击'},
  {id:'magnet',name:'引力捕获',description:'三维吸附半径+0.7格，可以跨高度收集星骸。',rarity:'R',maxStacks:3,icon:'◎',tag:'探索'},
  {id:'phase',name:'相位稳流',description:'冲刺能耗减少22%，每秒能量回复+3。',rarity:'R',maxStacks:4,icon:'↗',tag:'机动'},
  {id:'vampiric',name:'生命回响',description:'每次击败敌人回复4点生命。',rarity:'SR',maxStacks:3,icon:'♥',tag:'生存'},
  {id:'resonance',name:'深层共鸣',description:'获得的经验提升25%，更快解锁构筑。',rarity:'R',maxStacks:3,icon:'∿',tag:'成长'},
  {id:'longshot',name:'天穹瞄具',description:'自动攻击的三维射程增加2格。',rarity:'R',maxStacks:3,icon:'⊕',tag:'火力'},
  {id:'novaBurst',name:'吞星反应',description:'吞噬星骸引爆半径2.5格的脉冲，造成65%攻击伤害；可叠加伤害。',rarity:'SSR',maxStacks:3,icon:'✺',tag:'连锁'},
  {id:'chrono',name:'时序锚点',description:'立刻冻结敌人4秒，之后每波开始冻结敌人；每秒能量回复+4。',rarity:'SR',maxStacks:2,icon:'◷',tag:'控制'},
]);
const DEFAULT_STATS={maxHp:120,attack:24,defense:4,crit:.12,critDamage:1.7,speed:3.2,energyMax:100,energyRegen:14,skillCooldown:16,pickupRadius:.4,shield:15};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
const key=p=>`${p.x},${p.y},${p.z}`;
const copy=p=>({x:p.x,y:p.y,z:p.z});

/** Six-axis rules; render positions never determine collisions. */
export class SnakeGame {
  constructor({random=Math.random,onEvent=()=>{}}={}) {this.random=random;this.onEvent=onEvent;this._events=[];this._flushing=false;this.reset();}
  reset({character='rook',stats={},difficulty='normal'}={}) {
    this._events=[];this._id=0;this.character=typeof character==='string'?character:character?.id||'rook';
    this.difficulty=difficulty==='easy'?'chill':['chill','normal','hard'].includes(difficulty)?difficulty:'normal';
    this.stats={...DEFAULT_STATS};for(const field of Object.keys(DEFAULT_STATS))if(Number.isFinite(stats[field]))this.stats[field]=stats[field];
    this.stats.maxHp=Math.max(1,this.stats.maxHp);this.stats.attack=Math.max(1,this.stats.attack);this.stats.defense=Math.max(0,this.stats.defense);
    this.stats.crit=clamp(this.stats.crit,0,.95);this.stats.critDamage=Math.max(1,this.stats.critDamage);this.stats.speed=clamp(this.stats.speed,1.5,6);
    this.stats.energyMax=Math.max(20,this.stats.energyMax);this.stats.energyRegen=Math.max(0,this.stats.energyRegen);this.stats.skillCooldown=Math.max(3,this.stats.skillCooldown);
    this.stats.pickupRadius=Math.max(0,this.stats.pickupRadius);this.stats.shield=Math.max(0,this.stats.shield);
    this.status='ready';this.snake=Array.from({length:6},(_,i)=>({x:6-i,y:3,z:7}));this.previous=this.snake.map(copy);this.direction='right';this.queue=[];
    this.food=[];this.enemies=[];this.obstacles=[];this.shots=[];this.hazards=[];this.boss=null;
    this.score=0;this.eaten=0;this.elapsed=0;this.kills=0;this.wave=1;this.waveName=WAVE_NAMES[0];
    this.level=1;this.xp=0;this.xpToNext=28;this.choices=[];this.build=[];
    this.hp=this.maxHp=this.stats.maxHp;this.shield=this.stats.shield;this.energy=this.stats.energyMax;
    this.boosting=false;this.boostRequested=false;this.accumulator=0;this.skillRemaining=0;this.invulnerable=0;
    this.slowTime=0;this.timeStopRemaining=0;this.echoRemaining=0;this.regenRemaining=0;this.magnetRemaining=0;this.combo=0;this.comboTime=0;this.lastFoodHeight=3;
    this.reason='';this.deathReason='';this.waveElapsed=0;this.attackRange=7.5;this.attackInterval=.8;this.attackTimer=.35;
    this.multishot=1;this.chainCount=0;this.frost=0;this.shieldRegen=0;this.boostCost=28;this.killHeal=0;this.xpMultiplier=1;this.novaBurst=0;
    for(let i=0;i<12;i++){const p=this._freeCell({minDistance:4});if(p)this.obstacles.push(p);}
    this.spawnFood({x:8,y:3,z:7},'normal');this.spawnFood({x:8,y:4,z:7},'gold');this.spawnFood({x:8,y:2,z:7},'normal');
    for(let y=0;y<WORLD.y;y++)this.spawnFood(null,y%3===0?'gold':'normal',y);
    this._spawnWave(false);
  }
  _emit(name,data={}){this._events.push({name,data});}
  _flush(){if(this._flushing)return;this._flushing=true;try{while(this._events.length){const e=this._events.shift();this.onEvent(e.name,e.data);}}finally{this._flushing=false;}}
  _rand(){return clamp(Number(this.random())||0,0,.999999999);}
  _uid(prefix){return `${prefix}-${++this._id}`;}
  _freeCell({preferred=null,minDistance=0,height=null}={}) {
    const occupied=new Set([...this.snake,...this.food,...this.obstacles,...this.enemies].map(key));
    const valid=p=>p.x>=0&&p.x<WORLD.x&&p.y>=0&&p.y<WORLD.y&&p.z>=0&&p.z<WORLD.z&&!occupied.has(key(p))&&(!this.snake.length||distance(p,this.snake[0])>=minDistance);
    if(preferred&&valid(preferred))return copy(preferred);
    const cells=[];for(let y=0;y<WORLD.y;y++){if(height!==null&&height!==y)continue;for(let x=0;x<WORLD.x;x++)for(let z=0;z<WORLD.z;z++){const p={x,y,z};if(valid(p))cells.push(p);}}
    return cells.length?cells[Math.floor(this._rand()*cells.length)]:null;
  }
  spawnFood(preferred=null,type=null,height=null){const p=this._freeCell({preferred,height});if(!p)return false;const r=this._rand();this.food.push({...p,id:this._uid('food'),type:type||(r<.08?'heal':r<.16?'chrono':r<.34?'gold':'normal')});return true;}
  start(){if(this.status!=='ready')return false;this.status='playing';this._emit('start');this._emit('wave',{wave:this.wave,name:this.waveName});this._flush();return true;}
  pause(){if(this.status!=='playing')return false;this.status='paused';this.boostRequested=false;this.boosting=false;return true;}
  resume(){if(this.status!=='paused')return false;this.status='playing';return true;}
  turn(direction){if(!DIRECTIONS[direction]||this.status!=='playing'||this.queue.length>=2)return false;const last=this.queue.at(-1)||this.direction,a=DIRECTIONS[last],b=DIRECTIONS[direction];if(last===direction||a.every((v,i)=>v+b[i]===0))return false;this.queue.push(direction);return true;}
  get speed(){return this.stats.speed*({chill:.8,normal:1,hard:1.18}[this.difficulty]||1)*(this.boosting?1.65:1)*(this.slowTime>0?.8:1);}
  get progress(){return clamp(this.accumulator*this.speed,0,1);}
  setBoost(value){this.boostRequested=this.status==='playing'&&!!value;if(!value)this.boosting=false;}
  update(dt){
    if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.elapsed+=dt;this.waveElapsed+=dt;
    for(const f of ['skillRemaining','invulnerable','slowTime','timeStopRemaining','echoRemaining','regenRemaining','magnetRemaining','comboTime'])this[f]=Math.max(0,this[f]-dt);
    if(!this.comboTime)this.combo=0;
    if(this.shield<this.stats.shield)this.shield=Math.min(this.stats.shield,this.shield+this.shieldRegen*dt);
    if(this.regenRemaining>0)this.hp=Math.min(this.maxHp,this.hp+5*dt);
    const was=this.boosting;this.boosting=this.boostRequested&&this.energy>2;this.energy=clamp(this.energy+(this.boosting?-this.boostCost:this.stats.energyRegen)*dt,0,this.stats.energyMax);
    if(this.energy<=2){this.boosting=false;this.boostRequested=false;}if(this.boosting&&!was)this._emit('boost');
    this.shots.forEach(s=>s.life-=dt);this.shots=this.shots.filter(s=>s.life>0);this.accumulator+=dt;
    let steps=0;while(this.status==='playing'&&this.accumulator>=1/this.speed&&steps++<5){this.accumulator-=1/this.speed;this._step();}
    if(this.status==='playing'){this._collectNearby();if(this.status==='playing')this._combat(dt);}this._flush();
  }
  step(){if(this.status!=='playing')return;this._step();this._flush();}
  _step(){
    if(this.queue.length){this.direction=this.queue.shift();this._emit('turn',{direction:this.direction});}
    this.previous=this.snake.map(copy);const [dx,dy,dz]=DIRECTIONS[this.direction],head=this.snake[0];const p={x:head.x+dx,y:head.y+dy,z:head.z+dz};
    const wall=p.x<0||p.x>=WORLD.x||p.y<0||p.y>=WORLD.y||p.z<0||p.z>=WORLD.z;
    if(wall){p.x=(p.x+WORLD.x)%WORLD.x;p.y=(p.y+WORLD.y)%WORLD.y;p.z=(p.z+WORLD.z)%WORLD.z;}
    const body=!this.boosting&&this.snake.slice(0,-1).some(s=>same(s,p)),obstacle=this.obstacles.some(s=>same(s,p));
    this.snake.unshift(p);this.snake.pop();
    if(wall||body||obstacle){const reason=wall?'穿越边界消耗了机体结构':obstacle?'与空间残骸相撞':'蛇身轨迹发生碰撞';if(body||obstacle)this.snake.splice(Math.max(3,this.snake.length-2));this._takeDamage(wall?14:body?20:24,reason);if(wall)this._emit('warp',{...p});}
    if(this.status!=='playing')return;this._collectNearby();if(this.status==='playing')this._contactDamage();
  }
  _collectNearby(){
    const collected=this.food.filter(f=>distance(f,this.snake[0])<=Math.max(.01,this.stats.pickupRadius+(this.magnetRemaining>0?3.5:0)));
    for(const food of collected){
      if(this.status!=='playing')break;const index=this.food.findIndex(f=>f.id===food.id);if(index===-1)continue;this.food.splice(index,1);
      this.eaten++;this.snake.push(copy(this.snake.at(-1)));this.combo=this.comboTime>0?Math.min(6,this.combo+1):1;this.comboTime=8;
      const heightCombo=food.y!==this.lastFoodHeight;this.lastFoodHeight=food.y;
      const gain=Math.round((food.type==='gold'?180:80)*this.combo*(this.boosting?2:1)*(heightCombo?1.5:1));
      this.score+=gain;this.energy=Math.min(this.stats.energyMax,this.energy+14+(heightCombo?6:0));
      if(food.type==='chrono'){this.timeStopRemaining=Math.max(this.timeStopRemaining,3);this.slowTime=2;}if(food.type==='heal')this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.16);
      this.spawnFood(null,null,this.eaten%WORLD.y);this._emit('eat',{...food,gain,combo:this.combo,heightCombo,boosting:this.boosting});
      if(this.novaBurst)for(const e of [...this.enemies])if(distance(e,food)<=2.5)this._hitEnemy(e,this.stats.attack*.65*this.novaBurst,food,false,'pulse');
      if(!['dead','won'].includes(this.status))this._gainXp(food.type==='gold'?16:10);
    }
  }
  _takeDamage(raw,reason){
    if(this.invulnerable>0||!['playing','choosing'].includes(this.status))return false;
    const damage=Math.max(1,Math.round(raw*(this.difficulty==='hard'?1.25:this.difficulty==='chill'?.75:1)-this.stats.defense));
    const absorbed=Math.min(this.shield,damage);this.shield-=absorbed;const hpDamage=Math.min(this.hp,damage-absorbed);this.hp-=hpDamage;this.invulnerable=1.05;this.combo=0;this.comboTime=0;
    this._emit('damage',{amount:damage,hpDamage,absorbed,reason,position:copy(this.snake[0])});if(this.hp<=0)this._finish(false,reason);return true;
  }
  _contactDamage(){for(const e of this.enemies)if(distance(e,this.snake[0])<=(e.type==='boss'?1.2:.6)){this._takeDamage(e.damage,e.type==='boss'?'与寂星之心相撞':'被异构体拦截');if(this.status==='dead')break;}}
  _spawnWave(emit=true){
    const mul=this.difficulty==='hard'?1.18:this.difficulty==='chill'?.85:1,count=this.wave===5?4:3+this.wave;this.waveName=WAVE_NAMES[this.wave-1];
    for(let i=0;i<count;i++){
      const p=this._freeCell({minDistance:4,height:(i*2+this.wave)%WORLD.y})||this._freeCell({minDistance:3});if(!p)continue;
      const type=i%4===3?'turret':this.wave>=3&&i%3===0?'elite':'scout',maxHp=Math.round((30+this.wave*14)*(type==='elite'?1.55:1)*mul);
      this.enemies.push({...p,id:this._uid('enemy'),type,hp:maxHp,maxHp,damage:13+this.wave*3,moveTimer:.5+this._rand()*.7,attackTimer:2+this._rand(),frozen:0});
    }
    if(this.wave===5){const p=this._freeCell({preferred:{x:10,y:4,z:3},minDistance:4})||this._freeCell();if(p){const maxHp=Math.round(720*mul);this.boss={...p,id:this._uid('boss'),name:'寂星之心 · NULL',type:'boss',hp:maxHp,maxHp,damage:36,moveTimer:1.2,attackTimer:3,frozen:0,phase:1,telegraph:0};this.enemies.push(this.boss);}}
    this.waveElapsed=0;if(this.build.includes('chrono'))this.timeStopRemaining=Math.max(this.timeStopRemaining,3+this.build.filter(x=>x==='chrono').length);
    if(emit){this._emit('wave',{wave:this.wave,name:this.waveName});if(this.boss)this._emit('boss',{boss:{...this.boss}});}
  }
  _combat(dt){
    this.attackTimer-=dt;
    if(this.attackTimer<=0){
      this.attackTimer+=this.attackInterval;
      const attackWave=this.wave,eligibleIds=new Set(this.enemies.map(e=>e.id));
      const targets=[...this.enemies].filter(e=>distance(e,this.snake[0])<=this.attackRange).sort((a,b)=>distance(a,this.snake[0])-distance(b,this.snake[0])).slice(0,this.multishot+(this.echoRemaining>0?1:0));
      for(const target of targets){
        if(this.wave!==attackWave)break;
        if(target.hp<=0||this.status!=='playing'||!this.enemies.includes(target))continue;const crit=this._rand()<this.stats.crit;this._hitEnemy(target,this.stats.attack*(crit?this.stats.critDamage:1),this.snake[0],crit);
        if(this.wave!==attackWave)break;
        if(this.frost&&target.hp>0)target.frozen=Math.max(target.frozen,.6+this.frost*.6);
        let origin=target;const visited=new Set([target.id]);for(let bounce=0;bounce<this.chainCount&&this.status==='playing'&&this.wave===attackWave;bounce++){
          const next=this.enemies.filter(e=>eligibleIds.has(e.id)&&!visited.has(e.id)&&distance(e,origin)<=3.5).sort((a,b)=>distance(a,origin)-distance(b,origin))[0];if(!next)break;
          visited.add(next.id);this._hitEnemy(next,this.stats.attack*.55,origin,false,'chain');origin=next;
        }
      }
    }
    if(this.status!=='playing')return;
    if(this.timeStopRemaining<=0)for(const e of this.enemies){
      e.frozen=Math.max(0,e.frozen-dt);if(e.frozen>0)continue;e.moveTimer-=dt;e.attackTimer-=dt;
      if(e.type==='boss'){e.phase=e.hp/e.maxHp<.45?2:1;e.telegraph=Math.max(0,e.telegraph-dt);}
      if(e.moveTimer<=0&&e.type!=='turret'){e.moveTimer=e.type==='boss'?1.1:e.type==='elite'?.6:Math.max(.65,1.15-this.wave*.07);this._moveEnemy(e);}
      if((e.type==='turret'||e.type==='boss')&&e.attackTimer<=0){
        e.attackTimer=e.type==='boss'?(e.phase===2?2.1:3.2):4;const radius=e.type==='boss'?1.7:.85,duration=e.type==='boss'?1.35:1.1;
        this.hazards.push({...copy(this.snake[0]),id:this._uid('hazard'),radius,remaining:duration,duration,damage:e.damage,type:e.type==='boss'?'rupture':'target'});if(e.type==='boss')e.telegraph=duration;
      }
    }
    for(const h of this.hazards){if(this.timeStopRemaining>0)continue;h.remaining-=dt;if(h.remaining<=0&&distance(h,this.snake[0])<=h.radius)this._takeDamage(h.damage,'未能躲开空间轰击');}
    this.hazards=this.hazards.filter(h=>h.remaining>0);this._contactDamage();if(this.status==='playing'&&!this.enemies.length)this._advanceWave();
  }
  _moveEnemy(e){
    const head=this.snake[0],axes=['x','y','z'].sort((a,b)=>Math.abs(head[b]-e[b])-Math.abs(head[a]-e[a]));
    for(const axis of axes){if(e[axis]===head[axis])continue;const next={...copy(e),[axis]:e[axis]+Math.sign(head[axis]-e[axis])};if(this.obstacles.some(p=>same(p,next))||this.enemies.some(other=>other!==e&&same(other,next)))continue;Object.assign(e,next);break;}
  }
  _hitEnemy(e,damage,origin,critical=false,kind='normal'){
    if(e.hp<=0||!this.enemies.includes(e)||['dead','won'].includes(this.status))return;const dealt=Math.max(1,Math.round(damage));e.hp=Math.max(0,e.hp-dealt);
    const shot={id:this._uid('shot'),from:copy(origin),to:copy(e),life:.23,maxLife:.23,color:critical?0xe4b75e:kind==='chain'?0xa99bea:kind==='pulse'?0x89d9c9:0x85b5e1,critical,damage:dealt,kind};this.shots.push(shot);this._emit('shot',{...shot});
    if(e.hp>0)return;this.enemies=this.enemies.filter(other=>other.id!==e.id);this.kills++;const gain=e.type==='boss'?3000:e.type==='elite'?240:120;this.score+=gain;this.hp=Math.min(this.maxHp,this.hp+this.killHeal);
    this._emit('kill',{...copy(e),id:e.id,type:e.type,gain});if(e.type==='boss'){this._finish(true,'寂星之心已被击破');return;}
    this._gainXp(e.type==='elite'?22:14);if(!this.enemies.length&&!['dead','won'].includes(this.status))this._advanceWave();
  }
  _advanceWave(){if(this.wave>=5){this._finish(true,'全部异构体已被清除');return;}this.wave++;this.hp=Math.min(this.maxHp,this.hp+18);this.energy=this.stats.energyMax;this.hazards=[];this._spawnWave();}
  _gainXp(amount){if(['won','dead'].includes(this.status))return;this.xp+=Math.round(amount*this.xpMultiplier);if(this.status!=='choosing'&&this.xp>=this.xpToNext)this._offerUpgrade();}
  _offerUpgrade(){
    const pool=UPGRADES.filter(u=>this.build.filter(id=>id===u.id).length<u.maxStacks);if(!pool.length){this.xp=0;this.hp=this.maxHp;return;}
    this.xp-=this.xpToNext;this.level++;this.xpToNext=28+(this.level-1)*12;this.choices=[];
    while(this.choices.length<3&&pool.length)this.choices.push(pool.splice(Math.floor(this._rand()*pool.length),1)[0]);
    this.status='choosing';this.boostRequested=false;this.boosting=false;this.queue=[];this._emit('level',{level:this.level,choices:this.choices.map(u=>({...u}))});
  }
  chooseUpgrade(id){
    if(this.status!=='choosing'||!this.choices.some(u=>u.id===id))return false;this.build.push(id);
    switch(id){
      case 'overdrive':this.stats.attack*=1.25;break;case 'vitality':this.stats.maxHp+=30;this.maxHp+=30;this.hp=Math.min(this.maxHp,this.hp+30);break;
      case 'accelerator':this.attackInterval=Math.max(.2,this.attackInterval*.84);break;case 'multishot':this.multishot++;break;case 'chain':this.chainCount++;break;case 'frost':this.frost++;break;
      case 'barrier':this.stats.shield+=20;this.shield+=20;this.shieldRegen+=1.5;break;case 'precision':this.stats.crit=Math.min(.95,this.stats.crit+.12);this.stats.critDamage+=.1;break;
      case 'magnet':this.stats.pickupRadius+=.7;break;case 'phase':this.boostCost*=.78;this.stats.energyRegen+=3;break;case 'vampiric':this.killHeal+=4;break;
      case 'resonance':this.xpMultiplier*=1.25;break;case 'longshot':this.attackRange+=2;break;case 'novaBurst':this.novaBurst++;break;
      case 'chrono':this.timeStopRemaining=Math.max(this.timeStopRemaining,4);this.stats.energyRegen+=4;break;
    }
    this.choices=[];this.status='playing';this.invulnerable=Math.max(this.invulnerable,.7);this._emit('upgrade',{id,level:this.level});if(this.xp>=this.xpToNext)this._offerUpgrade();this._flush();return true;
  }
  useSkill(){
    if(this.status!=='playing'||this.skillRemaining>0)return false;this.skillRemaining=this.stats.skillCooldown;const origin=copy(this.snake[0]);
    const targets=[...this.enemies].sort((a,b)=>distance(a,origin)-distance(b,origin));let name='战地重整';
    if(this.character==='nova'){name='超新星坍缩';this.energy=Math.min(this.stats.energyMax,this.energy+25);for(const e of targets)if(distance(e,origin)<=7)this._hitEnemy(e,this.stats.attack*4.2,origin,true,'pulse');}
    else if(this.character==='aegis'){name='绝对棱域';this.shield=Math.max(this.shield,this.stats.shield+35);this.hp=Math.min(this.maxHp,this.hp+18);this.invulnerable=3;for(const e of targets)if(distance(e,origin)<=5){e.frozen=3;this._hitEnemy(e,this.stats.attack*1.5,origin,false,'pulse');}}
    else if(this.character==='lyra'){name='群星连奏';this.echoRemaining=8;this.attackTimer=0;for(const e of targets.slice(0,5))if(distance(e,origin)<=10)this._hitEnemy(e,this.stats.attack*2.5,origin,false,'chain');}
    else if(this.character==='echo'){name='零时回廊';this.timeStopRemaining=6;this.invulnerable=1.5;for(const e of targets)if(distance(e,origin)<=8)this._hitEnemy(e,this.stats.attack*2.1,origin,false,'pulse');}
    else if(this.character==='iris'){name='星尘牵引';this.magnetRemaining=6;this.energy=Math.min(this.stats.energyMax,this.energy+40);this.invulnerable=1.5;this._collectNearby();}
    else{this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.3);this.energy=Math.min(this.stats.energyMax,this.energy+35);this.regenRemaining=8;this.invulnerable=1.5;}
    this._emit('skill',{character:this.character,name,position:origin});this._flush();return true;
  }
  _finish(won,reason){
    if(['dead','won'].includes(this.status))return;this.status=won?'won':'dead';this.reason=reason;this.deathReason=reason;this.boosting=false;this.boostRequested=false;this.choices=[];this.queue=[];
    if(won){this.score+=2000+Math.max(0,Math.round((300-this.elapsed)*5));this.boss=null;}
    // An area skill can cross a level threshold just before the final hit; victory supersedes its queued draft.
    this._events=this._events.filter(e=>e.name!=='level');
    this._emit(won?'won':'death',{reason,position:copy(this.snake[0]),score:this.score,wave:this.wave,kills:this.kills});
  }
}
