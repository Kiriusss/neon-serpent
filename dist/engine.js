export const WORLD = Object.freeze({ x:32, y:1, z:24 });
export const SIZE = WORLD.x;
export const DIRECTIONS = Object.freeze({up:[0,0,-1],down:[0,0,1],left:[-1,0,0],right:[1,0,0]});
export const MISSIONS = Object.freeze([
  {id:'m1',code:'01',name:'破晓码头',type:'clear',description:'突破三道封锁，夺回方舟的补给港。',briefing:'清剿三轮巡猎机。自由移动、保持距离，回收残骸经验以选择战术模块。',recommendation:'推荐等级 1 · 机动清剿',enemyTypes:['scout','gunner','charger'],targetTime:90,theme:'harbor',color:'#7ed4cf'},
  {id:'m2',code:'02',name:'失落航线',type:'escort',description:'护送携带旧世界坐标的信标穿越封锁。',briefing:'靠近信标 3.6 米以内才能推进。远程敌机会优先攻击信标；信标被击毁即任务失败。',recommendation:'推荐等级 2 · 护送作战',enemyTypes:['scout','gunner','charger'],targetTime:110,theme:'route',color:'#e5bc7d'},
  {id:'m3',code:'03',name:'裂隙中枢',type:'capture',description:'同步三座锚点，为沉睡的城市重启天幕。',briefing:'依次在三座锚点内停留 6 秒完成同步。敌人进入同步区会使进度暂停，离开不会丢失已有进度。',recommendation:'推荐等级 3 · 据点控制',enemyTypes:['turret','scout','gunner'],targetTime:90,theme:'relay',color:'#a89de8'},
  {id:'m4',code:'04',name:'寂星之心',type:'boss',description:'击破归零协议，带回星骸深处最后的回应。',briefing:'敌方核心拥有三个阶段。注意扇形弹幕、环形弹幕与地面预警，冲刺可以穿越弹幕。',recommendation:'推荐等级 4 · 核心歼灭',enemyTypes:['boss','scout','gunner'],bossName:'守望者 · 归零',targetTime:120,theme:'heart',color:'#dc8b88'},
]);
export const WAVE_NAMES = ['前哨封锁','交叉火网','重装封锁'];
export const UPGRADES = Object.freeze([
  {id:'overdrive',name:'超频核心',description:'攻击力提升 25%，技能同步增强。',rarity:'R',maxStacks:5,icon:'✦',tag:'火力'},
  {id:'vitality',name:'生命编织',description:'最大生命 +30，立即恢复 35 点生命。',rarity:'R',maxStacks:4,icon:'＋',tag:'生存'},
  {id:'accelerator',name:'脉冲加速器',description:'射击间隔缩短 16%。',rarity:'SR',maxStacks:4,icon:'»',tag:'火力'},
  {id:'multishot',name:'分形弹幕',description:'每轮额外发射一枚侧翼弹，造成 65% 伤害。',rarity:'SSR',maxStacks:3,icon:'⋈',tag:'弹幕'},
  {id:'chain',name:'链式雷鸣',description:'命中向附近敌机弹射 55% 伤害，每层增加一次弹射。',rarity:'SR',maxStacks:3,icon:'ϟ',tag:'连锁'},
  {id:'frost',name:'绝对零域',description:'命中冻结敌机 0.45 秒，每层延长 0.25 秒；首领减速。',rarity:'SR',maxStacks:3,icon:'❄',tag:'控制'},
  {id:'barrier',name:'再生棱镜',description:'护盾上限与当前护盾 +20，每秒恢复 1.5 护盾。',rarity:'SR',maxStacks:4,icon:'◇',tag:'生存'},
  {id:'precision',name:'弱点解析',description:'暴击率 +12%，暴击伤害倍率 +0.1。',rarity:'R',maxStacks:4,icon:'⌖',tag:'暴击'},
  {id:'magnet',name:'引力捕获',description:'残骸吸附范围 +1.2 米，机动速度 +4%。',rarity:'R',maxStacks:3,icon:'◎',tag:'探索'},
  {id:'phase',name:'相位稳流',description:'冲刺充能时间缩短 18%（最低 2 秒），无敌时间增加 0.04 秒。',rarity:'R',maxStacks:3,icon:'↗',tag:'机动'},
  {id:'vampiric',name:'生命回响',description:'每次击败敌人恢复 4 点生命。',rarity:'SR',maxStacks:3,icon:'♥',tag:'生存'},
  {id:'resonance',name:'深层共鸣',description:'回收残骸所得经验提升 25%。',rarity:'R',maxStacks:3,icon:'∿',tag:'成长'},
  {id:'longshot',name:'天穹瞄具',description:'射程 +2 米，弹速提升 12%。',rarity:'R',maxStacks:3,icon:'⊕',tag:'火力'},
  {id:'novaBurst',name:'吞星反应',description:'回收残骸触发半径 3 米爆破，造成 70% 攻击伤害。',rarity:'SSR',maxStacks:3,icon:'✺',tag:'连锁'},
  {id:'chrono',name:'时序锚点',description:'立即冻结敌机 4 秒，主动技能冷却缩短 15%。',rarity:'SR',maxStacks:2,icon:'◷',tag:'控制'},
]);
const DEFAULT_STATS={maxHp:150,attack:24,defense:8,crit:.1,critDamage:1.7,speed:3,energyMax:100,energyRegen:16,skillCooldown:18,pickupRadius:.55,shield:20};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const copy=p=>({x:p.x,y:0,z:p.z});
const normalize=(x,z)=>{const n=Math.hypot(x,z);return n>0?{x:x/n,z:z/n}:{x:0,z:0};};
const lerp=(a,b,t)=>a+(b-a)*t;
const PLAYER_RADIUS=.46;
const ENEMY_DATA={
  scout:{hp:64,speed:1.65,radius:.48,damage:13,xp:12,color:'#e38a78'},
  gunner:{hp:82,speed:1.1,radius:.55,damage:14,xp:15,color:'#bc9ce4'},
  charger:{hp:112,speed:1.1,radius:.66,damage:22,xp:19,color:'#e6ba6f'},
  turret:{hp:138,speed:0,radius:.7,damage:16,xp:22,color:'#ae8ddb'},
  boss:{hp:2400,speed:.45,radius:1.55,damage:23,xp:80,color:'#ed927c'},
};
function segmentDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;const t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
function segmentRectEntry(a,b,o,pad=0){let lo=0,hi=1;for(const [axis,size]of [['x','w'],['z','d']]){const min=o[axis]-o[size]/2-pad,max=o[axis]+o[size]/2+pad,d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return Infinity;}else{let t1=(min-a[axis])/d,t2=(max-a[axis])/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return Infinity;}}return lo;}
const segmentRect=(a,b,o,pad=0)=>Number.isFinite(segmentRectEntry(a,b,o,pad));
function segmentCircleEntry(a,b,p,radius){const dx=b.x-a.x,dz=b.z-a.z,ox=a.x-p.x,oz=a.z-p.z,c=ox*ox+oz*oz-radius*radius;if(c<=0)return 0;const length=dx*dx+dz*dz;if(length<1e-12)return Infinity;const dot=ox*dx+oz*dz,discriminant=dot*dot-length*c;if(discriminant<0)return Infinity;const t=(-dot-Math.sqrt(discriminant))/length;return t>=0&&t<=1?t:Infinity;}

/** Continuous XZ combat simulation. The trailing drones are cosmetic, never colliders. */
export class SnakeGame {
  constructor({random=Math.random,onEvent=()=>{}}={}){this.random=random;this.onEvent=onEvent;this._events=[];this._flushing=false;this.reset();}
  reset({character='rook',stats={},difficulty='normal',mission='m1',supportIds=[]}={}){
    this._events=[];this._id=0;this._updating=false;this._bulletEpoch=0;this.character=typeof character==='string'?character:character?.id||'rook';
    this.difficulty=difficulty==='easy'?'chill':['chill','normal','hard'].includes(difficulty)?difficulty:'normal';
    this.mission=MISSIONS.find(m=>m.id===(typeof mission==='string'?mission:mission?.id))||MISSIONS[0];this.missionId=this.mission.id;
    this.supportIds=[...new Set(supportIds)].filter(id=>['nova','aegis','echo','lyra','rook','iris'].includes(id)&&id!==this.character).slice(0,2);
    this.stats={...DEFAULT_STATS};for(const field of Object.keys(DEFAULT_STATS))if(Number.isFinite(stats[field]))this.stats[field]=stats[field];
    this.stats.maxHp=Math.max(1,this.stats.maxHp);this.stats.attack=Math.max(1,this.stats.attack);this.stats.defense=Math.max(0,this.stats.defense);this.stats.crit=clamp(this.stats.crit,0,.95);this.stats.critDamage=Math.max(1,this.stats.critDamage);this.stats.speed=clamp(this.stats.speed,1.5,6);this.stats.energyMax=Math.max(20,this.stats.energyMax);this.stats.energyRegen=Math.max(0,this.stats.energyRegen);this.stats.skillCooldown=Math.max(3,this.stats.skillCooldown);this.stats.pickupRadius=Math.max(0,this.stats.pickupRadius);this.stats.shield=Math.max(0,this.stats.shield);
    this.status='ready';this.player={x:5,y:0,z:12,facingX:1,facingZ:0};this._move={x:0,z:0};this._dashDirection={x:1,z:0};this.direction='right';
    this.snake=Array.from({length:5},(_,i)=>({x:5-i*.65,y:0,z:12}));this.previous=this.snake.map(copy);
    this.food=[];this.enemies=[];this.obstacles=[];this.projectiles=[];this.shots=[];this.hazards=[];this.boss=null;this.payload=null;this.objectives=[];
    this.score=0;this.eaten=0;this.elapsed=0;this.kills=0;this.damageTaken=0;this.wave=1;this.waveName=WAVE_NAMES[0];this.waveElapsed=0;
    this.level=1;this.xp=0;this.xpToNext=24;this.choices=[];this.build=[];this.hp=this.maxHp=this.stats.maxHp;this.shield=this.stats.shield;this.energy=this.stats.energyMax;
    this.boosting=false;this.boostRequested=false;this.dashCharges=2;this.maxDashCharges=2;this.dashRecharge=clamp(72/Math.max(1,this.stats.energyRegen),2,6);this.dashCooldown=0;this.dashRemaining=0;this.dashDuration=.24;
    this.skillRemaining=0;this.supportRemaining=0;this.invulnerable=0;this.timeStopRemaining=0;this.echoRemaining=0;this.regenRemaining=0;this.magnetRemaining=0;this.attackBuffRemaining=0;this.slowTime=0;
    this.reason='';this.deathReason='';this.attackRange=11;this.attackInterval=.46;this.attackTimer=.15;this.projectileSpeed=20;this.multishot=1;this.chainCount=0;this.frost=0;this.shieldRegen=0;this.killHeal=0;this.xpMultiplier=1;this.novaBurst=0;
    this.objectiveText='';this.objectiveProgress=0;this._waveKills=0;this._waveTotal=0;this._waveWait=0;this._spawnTimer=9;this._bossAddsTimer=16;this._captureIndex=0;this._objectiveEvent=-1;
    this._setupMission();this._refreshObjective();this._events=[];return this;
  }
  _emit(name,data={}){this._events.push({name,data});}
  _flush(){if(this._flushing)return;this._flushing=true;try{while(this._events.length){const e=this._events.shift();this.onEvent(e.name,e.data);}}finally{this._flushing=false;}}
  _rand(){return clamp(Number(this.random())||0,0,.999999999);}
  _uid(prefix){return `${prefix}-${++this._id}`;}
  get speed(){return this.stats.speed*1.9*(this.slowTime>0?.75:1);}
  get progress(){return 1;}
  _rect(x,z,w,d){this.obstacles.push({id:this._uid('obstacle'),x,y:0,z,w,d});}
  _setupMission(){
    if(this.missionId==='m1'){this._rect(12,6,4,2.2);this._rect(20,18,4,2.2);this._rect(23,6,2.3,3);this._spawnWave();}
    if(this.missionId==='m2'){
      this.player.x=4;this.player.z=12;this._rect(12,12,3,4);this._rect(21,20,4,2);this._rect(22,4,4,2);
      const route=[{x:4,z:12},{x:8,z:6},{x:17,z:6},{x:24,z:13},{x:28,z:18}];
      this.payload={id:'beacon',x:4,y:0,z:12,hp:340,maxHp:340,progress:0,radius:.7,escortRadius:3.6,route,routeIndex:1,travelled:0,totalDistance:route.slice(1).reduce((n,p,i)=>n+distance(p,route[i]),0),moving:false};
      this.waveName='护送坐标信标';this._spawnEnemy('gunner',{x:13,z:4});this._spawnEnemy('scout',{x:18,z:10});this._spawnTimer=11;
    }
    if(this.missionId==='m3'){
      this._rect(14,9,3,4);this._rect(16,18,3,3);this._rect(26,12,3,2);
      this.objectives=[{id:'A',x:8,y:0,z:5,radius:2.1,progress:0,complete:false,active:true},{id:'B',x:24,y:0,z:6,radius:2.1,progress:0,complete:false,active:false},{id:'C',x:24,y:0,z:20,radius:2.1,progress:0,complete:false,active:false}];
      for(const p of [{x:11,z:5},{x:24,z:9},{x:21,z:20}])this._spawnEnemy('turret',p);
      this._spawnEnemy('scout',{x:18,z:6});this._spawnEnemy('gunner',{x:27,z:17});this.waveName='锚点同步';this._spawnTimer=10;
    }
    if(this.missionId==='m4'){
      this._rect(12,4,2.5,2);this._rect(12,20,2.5,2);this._rect(27,4,2.5,2);this._rect(27,20,2.5,2);
      this.boss=this._spawnEnemy('boss',{x:23,z:12});this.boss.name=this.mission.bossName;this.boss.phase=1;this.boss.attackTimer=2.2;this.boss.hazardTimer=4;this.boss.pattern=0;this.waveName='核心阶段 I';
      for(const p of [{x:7,z:7},{x:8,z:17},{x:12,z:12}])this.spawnFood(p,'gold');
    }
    this.snake=this.snake.map((p,i)=>({x:this.player.x-i*.65,y:0,z:this.player.z}));this.previous=this.snake.map(copy);
  }
  _spawnPosition(minDistance=8){
    for(let i=0;i<80;i++){
      const p={x:1.5+this._rand()*(WORLD.x-3),y:0,z:1.5+this._rand()*(WORLD.z-3)};
      if(distance(p,this.player)>=minDistance&&!this.obstacles.some(o=>Math.abs(p.x-o.x)<o.w/2+.8&&Math.abs(p.z-o.z)<o.d/2+.8)&&!this.enemies.some(e=>distance(e,p)<1.3))return p;
    }
    const candidates=[{x:2,z:2},{x:30,z:2},{x:30,z:22},{x:2,z:22}];return {...candidates.sort((a,b)=>distance(b,this.player)-distance(a,this.player))[0],y:0};
  }
  _spawnEnemy(type,position=null){
    const data=ENEMY_DATA[type]||ENEMY_DATA.scout,p=position||this._spawnPosition(),difficulty={chill:.78,normal:1,hard:1.28}[this.difficulty];
    const e={id:this._uid(type),...copy(p),type,hp:data.hp*difficulty,maxHp:data.hp*difficulty,speed:data.speed,radius:data.radius,damage:data.damage*difficulty,xp:data.xp,color:data.color,facingX:-1,facingZ:0,attackTimer:1+this._rand(),frozen:0,contactTimer:0,chargeTimer:2.3+this._rand(),chargeRemaining:0,telegraphRemaining:0,chargeX:0,chargeZ:0};
    this.enemies.push(e);return e;
  }
  _spawnWave(){
    const types=this.wave===1?['scout','scout','scout','scout','gunner','gunner']:this.wave===2?['scout','scout','gunner','gunner','gunner','charger','charger']:['scout','scout','gunner','gunner','gunner','charger','charger','charger'];
    this._waveKills=0;this._waveTotal=types.length;this._waveWait=0;this.waveElapsed=0;this.waveName=WAVE_NAMES[this.wave-1];for(const type of types)this._spawnEnemy(type);
    if(this.build.includes('chrono'))this.timeStopRemaining=Math.max(this.timeStopRemaining,2);
    this._emit('wave',{wave:this.wave,name:this.waveName,total:types.length});
  }
  spawnFood(preferred=null,type='xp'){
    const p=preferred||this._spawnPosition(2);this.food.push({id:this._uid('drop'),x:clamp(p.x,.7,WORLD.x-.7),y:0,z:clamp(p.z,.7,WORLD.z-.7),type,value:type==='gold'?20:type==='heal'?30:12});return true;
  }
  start(){if(this.status!=='ready')return false;this.status='playing';this._emit('start',{mission:this.missionId});this._emit('wave',{wave:this.wave,name:this.waveName});if(this.boss)this._emit('boss',{phase:1,name:this.boss.name});this._flush();return true;}
  pause(){if(this.status!=='playing')return false;this.status='paused';this._move={x:0,z:0};this.boostRequested=false;this.boosting=false;return true;}
  resume(){if(this.status!=='paused')return false;this.status='playing';return true;}
  setMove(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return false;this._move=this.status==='playing'?normalize(x,z):{x:0,z:0};return this.status==='playing';}
  turn(direction){const d=DIRECTIONS[direction];if(!d||this.status!=='playing')return false;this.direction=direction;this.setMove(d[0],d[2]);this._emit('turn',{direction});this._flush();return true;}
  setBoost(value){if(value&&!this.boostRequested)this.dash();this.boostRequested=!!value;}
  dash(){
    if(this.status!=='playing'||this.dashCharges<=0||this.dashRemaining>0)return false;
    this._dashDirection=Math.hypot(this._move.x,this._move.z)>.01?{...this._move}:normalize(this.player.facingX,this.player.facingZ);this.dashCharges--;this.dashRemaining=this.dashDuration;this.invulnerable=Math.max(this.invulnerable,this.dashDuration+.08);if(this.dashCooldown<=0)this.dashCooldown=this.dashRecharge;this.boosting=true;
    this._emit('dash',{position:copy(this.player),direction:{...this._dashDirection}});this._emit('boost');this._flush();return true;
  }
  update(dt){
    if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this._updating=true;
    try{
      this.previous=this.snake.map(copy);this.elapsed+=dt;this.waveElapsed+=dt;
      for(const f of ['skillRemaining','supportRemaining','invulnerable','timeStopRemaining','echoRemaining','regenRemaining','magnetRemaining','attackBuffRemaining','slowTime'])this[f]=Math.max(0,this[f]-dt);
      this.energy=clamp(this.energy+this.stats.energyRegen*dt,0,this.stats.energyMax);if(this.shield<this.stats.shield)this.shield=Math.min(this.stats.shield,this.shield+this.shieldRegen*dt);if(this.regenRemaining>0)this.hp=Math.min(this.maxHp,this.hp+8*dt);
      if(this.dashCharges<this.maxDashCharges){this.dashCooldown-=dt;while(this.dashCooldown<=0&&this.dashCharges<this.maxDashCharges){this.dashCharges++;this.dashCooldown+=this.dashRecharge;}if(this.dashCharges===this.maxDashCharges)this.dashCooldown=0;}
      const dashTime=Math.min(dt,this.dashRemaining);this.dashRemaining=Math.max(0,this.dashRemaining-dt);this.boosting=this.dashRemaining>0;
      const dx=this._dashDirection.x*this.speed*3.8*dashTime+this._move.x*this.speed*(dt-dashTime),dz=this._dashDirection.z*this.speed*3.8*dashTime+this._move.z*this.speed*(dt-dashTime);
      if(dx||dz){const facing=normalize(dx,dz);this.player.facingX=facing.x;this.player.facingZ=facing.z;this._moveBody(this.player,dx,dz,PLAYER_RADIUS);}this.player.y=0;this._updateDrones(dt);
      this.shots=this.shots.filter(s=>(s.life-=dt)>0);
      this._updateEnemies(dt);if(this.status==='playing')this._autoAttack(dt);if(this.status==='playing')this._updateProjectiles(dt);if(this.status==='playing')this._updateHazards(dt);if(this.status==='playing')this._collectFood(dt);if(this.status==='playing')this._updateMission(dt);
      if(this.status==='playing')this._offerLevel();
    }finally{this._updating=false;this._flush();}
  }
  _moveBody(body,dx,dz,radius){
    // Small substeps stop high-speed dashes from tunnelling through solid scenery.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));for(let s=0;s<steps;s++){
      body.x=clamp(body.x+dx/steps,radius,WORLD.x-radius);body.z=clamp(body.z+dz/steps,radius,WORLD.z-radius);
      for(const o of this.obstacles){const left=o.x-o.w/2,right=o.x+o.w/2,top=o.z-o.d/2,bottom=o.z+o.d/2;const qx=clamp(body.x,left,right),qz=clamp(body.z,top,bottom),nx=body.x-qx,nz=body.z-qz,dist=Math.hypot(nx,nz);
        if(dist>=radius)continue;if(dist>1e-8){body.x=qx+nx/dist*radius;body.z=qz+nz/dist*radius;}else{const choices=[{v:body.x-left,x:left-radius,z:body.z},{v:right-body.x,x:right+radius,z:body.z},{v:body.z-top,x:body.x,z:top-radius},{v:bottom-body.z,x:body.x,z:bottom+radius}].sort((a,b)=>a.v-b.v);body.x=choices[0].x;body.z=choices[0].z;}
      }
    }body.x=clamp(body.x,radius,WORLD.x-radius);body.z=clamp(body.z,radius,WORLD.z-radius);body.y=0;
  }
  _updateDrones(dt){
    this.snake[0]=copy(this.player);const fx=this.player.facingX,fz=this.player.facingZ;
    for(let i=1;i<5;i++){const side=i%2===1?-1:1,row=Math.ceil(i/2),behind=.65+row*.65,lateral=.52+row*.2;const target={x:this.player.x-fx*behind-fz*side*lateral,z:this.player.z-fz*behind+fx*side*lateral};this.snake[i]={x:lerp(this.snake[i]?.x??target.x,target.x,1-Math.exp(-dt*(10-i))),y:0,z:lerp(this.snake[i]?.z??target.z,target.z,1-Math.exp(-dt*(10-i)))};}
  }
  _navigate(enemy,target,dt){
    const clear=(a,b)=>!this.obstacles.some(o=>segmentRect(a,b,o,enemy.radius+.08));let goal=target;enemy.navTimer=(enemy.navTimer||0)-dt;
    if(!clear(enemy,target)){
      if(!enemy.navPath?.length||enemy.navTimer<=0||!enemy.navTarget||distance(target,enemy.navTarget)>2){
        // A tiny visibility graph around cover gives enemies a real route, with a cached path.
        const nodes=[copy(enemy),copy(target)],pad=enemy.radius+.25;
        for(const o of this.obstacles)for(const sx of [-1,1])for(const sz of [-1,1])nodes.push({x:o.x+sx*(o.w/2+pad),z:o.z+sz*(o.d/2+pad)});
        const costs=nodes.map(()=>Infinity),parents=[],visited=new Set();costs[0]=0;
        for(let n=0;n<nodes.length;n++){let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||costs[i]<costs[at]))at=i;if(at<0||!Number.isFinite(costs[at])||at===1)break;visited.add(at);
          for(let i=0;i<nodes.length;i++)if(i!==at&&!visited.has(i)&&clear(nodes[at],nodes[i])){const cost=costs[at]+distance(nodes[at],nodes[i]);if(cost<costs[i]){costs[i]=cost;parents[i]=at;}}
        }
        enemy.navPath=[];if(Number.isFinite(costs[1])){let at=1;while(at!==0){enemy.navPath.unshift(nodes[at]);at=parents[at];}}enemy.navTarget=copy(target);enemy.navTimer=.8;
      }
      while(enemy.navPath?.length&&distance(enemy,enemy.navPath[0])<.22)enemy.navPath.shift();goal=enemy.navPath?.[0]||target;
    }else enemy.navPath=[];
    const dir=normalize(goal.x-enemy.x,goal.z-enemy.z),step=Math.min(enemy.speed*dt,distance(enemy,goal));this._moveBody(enemy,dir.x*step,dir.z*step,enemy.radius);
  }
  _updateEnemies(dt){
    for(const e of [...this.enemies]){
      if(this.status!=='playing')break;if(e.hp<=0)continue;e.y=0;e.frozen=Math.max(0,(e.frozen||0)-dt);e.contactTimer=Math.max(0,(e.contactTimer||0)-dt);
      if(this.timeStopRemaining>0||e.frozen>0&&e.type!=='boss')continue;
      const step=e.frozen>0?dt*.35:dt,target=this.payload&&e.type!=='charger'&&distance(e,this.payload)<distance(e,this.player)+2?this.payload:this.player;
      const dir=normalize(target.x-e.x,target.z-e.z),d=distance(e,target);e.facingX=dir.x;e.facingZ=dir.z;
      if(e.type==='boss'){this._updateBoss(e,step);}
      else if(e.type==='charger'){
        if(e.telegraphRemaining>0){e.telegraphRemaining-=step;if(e.telegraphRemaining<=0)e.chargeRemaining=.75;}
        else if(e.chargeRemaining>0){e.chargeRemaining=Math.max(0,e.chargeRemaining-step);this._moveBody(e,e.chargeX*10*step,e.chargeZ*10*step,e.radius);}
        else{e.chargeTimer-=step;if(e.chargeTimer<=0&&d<13&&this._clearShot(e,target)){e.chargeX=dir.x;e.chargeZ=dir.z;e.telegraphRemaining=.85;e.chargeTimer=4;this._addHazard({x:e.x,z:e.z,radius:.7,type:'charge',angle:Math.atan2(dir.z,dir.x),length:8,width:1.3,duration:.85,damage:0});}else if(d>1.3)this._navigate(e,target,step);}
      }else if(e.type==='scout'){if(d>e.radius+.35)this._navigate(e,target,step);}
      else{
        if(e.type==='gunner'){if(d<5.4)this._moveBody(e,-dir.x*e.speed*step,-dir.z*e.speed*step,e.radius);else if(d>8.5||!this._clearShot(e,target))this._navigate(e,target,step);}
        e.attackTimer-=step;if(e.attackTimer<=0&&d<17&&this._clearShot(e,target)){e.attackTimer=e.type==='turret'?3.2:2.6;const n=e.type==='turret'?3:1;for(let i=0;i<n;i++)this._fire(e,Math.atan2(dir.z,dir.x)+(i-(n-1)/2)*.24,{hostile:true,damage:e.damage,speed:e.type==='turret'?6:6.6,color:e.color});}
      }
      if(distance(e,this.player)<e.radius+PLAYER_RADIUS+.08&&e.contactTimer<=0){e.contactTimer=.85;this._takeDamage(e.damage,e.type==='charger'?'冲锋撞击':'敌机接触');}
      if(this.payload&&distance(e,this.payload)<e.radius+this.payload.radius+.15&&e.contactTimer<=0){e.contactTimer=1.2;this._damagePayload(e.damage*.75);}
    }
    // Soft separation keeps enemy silhouettes readable and prevents damage piles.
    for(let i=0;i<this.enemies.length;i++)for(let j=i+1;j<this.enemies.length;j++){
      const a=this.enemies[i],b=this.enemies[j],d=distance(a,b),min=(a.radius+b.radius)*.85;if(d<min&&d>.01){const n=normalize(a.x-b.x,a.z-b.z),push=(min-d)*.25;if(a.type!=='turret'&&a.type!=='boss')this._moveBody(a,n.x*push,n.z*push,a.radius);if(b.type!=='turret'&&b.type!=='boss')this._moveBody(b,-n.x*push,-n.z*push,b.radius);}
    }
  }
  _updateBoss(e,dt){
    const target=this.player,dir=normalize(target.x-e.x,target.z-e.z),d=distance(e,target);if(d>8.2)this._moveBody(e,dir.x*e.speed*dt,dir.z*e.speed*dt,e.radius);
    e.attackTimer-=dt;e.hazardTimer-=dt;
    if(e.attackTimer<=0){e.attackTimer=[0,2.5,2.1,1.75][e.phase];e.pattern++;
      if(e.phase===1||e.pattern%2===0){const n=e.phase===1?3:e.phase===2?5:7;for(let i=0;i<n;i++)this._fire(e,Math.atan2(dir.z,dir.x)+(i-(n-1)/2)*.19,{hostile:true,damage:e.damage,speed:5.4+e.phase*.35,color:'#e9a481',radius:.23});}
      else{const n=e.phase===2?12:16;for(let i=0;i<n;i++)this._fire(e,i*Math.PI*2/n+e.pattern*.17,{hostile:true,damage:e.damage*.8,speed:4.4+e.phase*.3,color:'#b7a0e7',radius:.2});}
    }
    if(e.hazardTimer<=0){e.hazardTimer=[0,5.7,4.8,4.1][e.phase];this._addHazard({x:target.x,z:target.z,type:'blast',radius:e.phase===3?2.5:2.1,duration:1.6,damage:30});
      if(e.phase>=2)this._addHazard({x:e.x,z:e.z,type:'beam',angle:Math.atan2(dir.z,dir.x),length:24,width:1.7,radius:1,duration:1.45,damage:28});
      if(e.phase===3){const angle=this._rand()*Math.PI*2;this._addHazard({x:clamp(target.x+Math.cos(angle)*3,2,30),z:clamp(target.z+Math.sin(angle)*3,2,22),type:'blast',radius:2.5,duration:2.1,damage:30});}
    }
  }
  _clearShot(from,to){return !this.obstacles.some(o=>segmentRect(from,to,o,.08));}
  _fire(from,angle,{hostile=false,damage=this.stats.attack,speed=this.projectileSpeed,color='#9fd9df',radius=.17}={}){
    const vx=Math.cos(angle)*speed,vz=Math.sin(angle)*speed;const offset=(from.radius||PLAYER_RADIUS)+radius+.04;
    const p={id:this._uid('bullet'),x:from.x+Math.cos(angle)*offset,y:0,z:from.z+Math.sin(angle)*offset,vx,vz,hostile,radius,color,damage,remaining:hostile?5:this.attackRange/speed+.1,sourceId:from.id||'player',epoch:this._bulletEpoch};this.projectiles.push(p);this._emit('shot',{position:copy(from),hostile});return p;
  }
  _autoAttack(dt){
    this.attackTimer-=dt;if(this.attackTimer>0)return;const targets=this.enemies.filter(e=>e.hp>0&&distance(e,this.player)<=this.attackRange&&this._clearShot(this.player,e)).sort((a,b)=>distance(a,this.player)-distance(b,this.player));if(!targets.length){this.attackTimer=0;return;}
    this.attackTimer=this.attackInterval;const damage=this.stats.attack*(this.attackBuffRemaining>0?1.35:1)*(this._rand()<this.stats.crit?this.stats.critDamage:1);
    for(let i=0;i<this.multishot;i++){const t=targets[i%targets.length],lead=Math.min(.3,distance(this.player,t)/this.projectileSpeed);const tx=t.x+(t.type==='scout'?t.facingX*t.speed*lead:0),tz=t.z+(t.type==='scout'?t.facingZ*t.speed*lead:0);const angle=Math.atan2(tz-this.player.z,tx-this.player.x)+(i>=targets.length?(i%2?.065:-.065):0);this._fire(this.player,angle,{damage:damage*(i?.65:1)});}
  }
  _updateProjectiles(dt){
    const survivors=[];for(const p of this.projectiles){
      if(this.status!=='playing')break;if(p.hostile&&p.epoch!==undefined&&p.epoch!==this._bulletEpoch)continue;const travel=Math.min(dt,p.remaining);if(travel<=0)continue;const previous=copy(p);p.x+=p.vx*travel;p.z+=p.vz*travel;p.y=0;p.remaining-=dt;
      const obstacleAt=this.obstacles.reduce((first,o)=>Math.min(first,segmentRectEntry(previous,p,o,p.radius)),Infinity);
      if(p.hostile){
        const playerAt=segmentCircleEntry(previous,p,this.player,p.radius+PLAYER_RADIUS),payloadAt=this.payload?segmentCircleEntry(previous,p,this.payload,p.radius+this.payload.radius):Infinity;
        if(playerAt<obstacleAt&&playerAt<=payloadAt){this._takeDamage(p.damage,'敌方弹幕');continue;}
        if(payloadAt<obstacleAt){this._damagePayload(p.damage*.7);continue;}
      }else{
        const hit=this.enemies.filter(e=>e.hp>0).map(e=>({enemy:e,t:segmentCircleEntry(previous,p,e,(e.radius||.5)+p.radius)})).filter(e=>e.t<obstacleAt).sort((a,b)=>a.t-b.t)[0]?.enemy;
        if(hit){const snapshot=[...this.enemies];this._hitEnemy(hit,p.damage,previous);if(this.frost&&hit.hp>0)hit.frozen=Math.max(hit.frozen||0,.2+this.frost*.25);let origin=hit,amount=p.damage*.55,visited=new Set([hit.id]);for(let jump=0;jump<this.chainCount;jump++){const next=snapshot.filter(e=>!visited.has(e.id)&&e.hp>0&&distance(e,origin)<4.5).sort((a,b)=>distance(a,origin)-distance(b,origin))[0];if(!next||this.status!=='playing')break;this.shots.push({id:this._uid('chain'),from:copy(origin),to:copy(next),life:.2,color:'#aab8f0'});this._hitEnemy(next,amount,origin);visited.add(next.id);origin=next;amount*=.8;}continue;}
      }if(Number.isFinite(obstacleAt)||p.remaining<=0||p.x<-.5||p.x>WORLD.x+.5||p.z<-.5||p.z>WORLD.z+.5)continue;survivors.push(p);
    }this.projectiles=this.status==='playing'?survivors.filter(p=>!p.hostile||p.epoch===undefined||p.epoch===this._bulletEpoch):[];
  }
  _addHazard(data){this.hazards.push({id:this._uid('hazard'),x:data.x,y:0,z:data.z,radius:1,duration:1.4,remaining:data.duration||1.4,damage:20,...data});}
  _insideHazard(h,p,radius=PLAYER_RADIUS){if(h.type==='beam'||h.type==='charge'){const end={x:h.x+Math.cos(h.angle)*h.length,z:h.z+Math.sin(h.angle)*h.length};return segmentDistance(h,end,p)<h.width/2+radius;}return distance(h,p)<h.radius+radius;}
  _updateHazards(dt){
    const remaining=[];for(const h of this.hazards){h.remaining-=dt;if(h.remaining>0){remaining.push(h);continue;}if(h.damage>0){if(this._insideHazard(h,this.player))this._takeDamage(h.damage,'地面打击');if(this.payload&&this._insideHazard(h,this.payload,this.payload.radius))this._damagePayload(h.damage*.7);this._emit('impact',{position:copy(h),radius:h.radius,type:h.type});}}this.hazards=remaining;
  }
  _collectFood(dt){
    if(this.status!=='playing')return;const defer=this._updating;this._updating=true;
    const radius=1.3+this.stats.pickupRadius+(this.magnetRemaining>0?8:0),collected=[];
    this.food=this.food.filter(f=>{const d=distance(f,this.player);if(d<=radius){if(d>.7){const dir=normalize(this.player.x-f.x,this.player.z-f.z);const step=Math.min(d,dt*13);f.x+=dir.x*step;f.z+=dir.z*step;}if(distance(f,this.player)<=.85){collected.push(f);return false;}}return true;});
    for(const f of collected){if(this.status!=='playing')break;this.eaten++;this.score+=f.type==='gold'?50:20;if(f.type==='heal')this.hp=Math.min(this.maxHp,this.hp+(f.value||30));else this._gainXp((f.value||12)*this.xpMultiplier);if(this.novaBurst){for(const e of [...this.enemies])if(distance(e,f)<3)this._hitEnemy(e,this.stats.attack*.7*this.novaBurst,f);}this._emit('eat',{position:copy(f),type:f.type,combo:1});}
    this._updating=defer;if(!defer)this._offerLevel();
  }
  _hitEnemy(enemy,damage,from=this.player){
    if(this.status!=='playing'||enemy.hp<=0||!this.enemies.includes(enemy))return false;enemy.hp=Math.max(0,enemy.hp-damage);this._emit('hit',{position:copy(enemy),damage});
    if(enemy.hp>0){if(enemy.type==='boss'){const phase=enemy.hp<=enemy.maxHp*.35?3:enemy.hp<=enemy.maxHp*.7?2:1;if(phase>enemy.phase){enemy.phase=phase;enemy.attackTimer=1;enemy.hazardTimer=2.3;this.wave=phase;this.waveName=`核心阶段 ${['','I','II','III'][phase]}`;this._emit('boss',{phase,name:enemy.name});this._bulletEpoch++;this.projectiles=this.projectiles.filter(p=>!p.hostile);this.hp=Math.min(this.maxHp,this.hp+12);}}return true;}
    this.enemies=this.enemies.filter(e=>e!==enemy);this.kills++;this._waveKills++;this.score+=enemy.type==='boss'?1800:enemy.type==='turret'?180:100;this.hp=Math.min(this.maxHp,this.hp+this.killHeal);this.food.push({id:this._uid('xp'),...copy(enemy),type:enemy.type==='boss'?'gold':'xp',value:enemy.xp||12});if(enemy.type!=='boss'&&this._rand()<.13)this.spawnFood({x:enemy.x+.4,z:enemy.z+.3},'heal');this._emit('kill',{position:copy(enemy),type:enemy.type,score:this.score});
    if(enemy===this.boss){this.boss=null;this.objectiveProgress=1;this._finish(true,'归零协议已解除，最后的回应抵达方舟。');}return true;
  }
  _takeDamage(amount,reason='机体损伤'){
    if(this.status!=='playing'||this.invulnerable>0||amount<=0)return false;let damage=Math.max(1,amount-this.stats.defense*.55);this.damageTaken+=damage;const absorbed=Math.min(this.shield,damage);this.shield-=absorbed;damage-=absorbed;this.hp=Math.max(0,this.hp-damage);this.invulnerable=.65;this._emit('damage',{amount:damage,absorbed,reason,position:copy(this.player)});if(this.hp<=0)this._finish(false,reason);return true;
  }
  _damagePayload(amount){if(this.status!=='playing'||!this.payload||amount<=0)return;this.payload.hp=Math.max(0,this.payload.hp-amount);this._emit('objective',{type:'payload-damage',hp:this.payload.hp,maxHp:this.payload.maxHp});if(this.payload.hp<=0)this._finish(false,'坐标信标被击毁');}
  _updateMission(dt){
    if(this.missionId==='m1'&&this.enemies.length===0){this._waveWait+=dt;if(this.wave===3){this._finish(true,'破晓码头已收复，补给航路重新连通。');return;}if(this._waveWait>=2.4){this.wave++;this.hp=Math.min(this.maxHp,this.hp+18);this.shield=Math.min(this.stats.shield,this.shield+12);this._spawnWave();}}
    if(this.missionId==='m2'){
      const p=this.payload;p.moving=distance(this.player,p)<=p.escortRadius;
      if(p.moving){const target=p.route[p.routeIndex],d=distance(p,target),step=Math.min(d,.56*dt),dir=normalize(target.x-p.x,target.z-p.z);p.x+=dir.x*step;p.z+=dir.z*step;p.travelled+=step;p.progress=clamp(p.travelled/p.totalDistance,0,1);if(d<=step+.001){p.x=target.x;p.z=target.z;p.routeIndex++;if(p.routeIndex>=p.route.length){p.progress=1;this.objectiveProgress=1;this._finish(true,'旧世界坐标已送达。下一段航线正在苏醒。');return;}}}
      this._spawnTimer-=dt;if(this._spawnTimer<=0){this._spawnTimer=12;this.wave++;if(this.enemies.length<7){this._spawnEnemy(this.wave%3===0?'charger':'scout');this._spawnEnemy('gunner');this._emit('wave',{wave:this.wave,name:'拦截小队抵达'});}}
    }
    if(this.missionId==='m3'){
      const o=this.objectives[this._captureIndex];if(o){o.contested=this.enemies.some(e=>distance(e,o)<o.radius+e.radius);o.occupied=distance(this.player,o)<=o.radius;if(o.occupied&&!o.contested)o.progress=clamp(o.progress+dt/6,0,1);if(o.progress>=1){o.complete=true;o.active=false;this._captureIndex++;this.hp=Math.min(this.maxHp,this.hp+22);this._gainXp(24);this._emit('objective',{type:'capture',id:o.id,complete:true});if(this._captureIndex===this.objectives.length){this.objectiveProgress=1;this._finish(true,'三座锚点同步完成，城市天幕重新亮起。');return;}this.objectives[this._captureIndex].active=true;this.wave=this._captureIndex+1;this._spawnEnemy('scout');this._spawnEnemy('gunner');}}
      this._spawnTimer-=dt;if(this._spawnTimer<=0){this._spawnTimer=14;if(this.enemies.length<7)this._spawnEnemy('scout');}
    }
    if(this.missionId==='m4'&&this.boss){this._bossAddsTimer-=dt;if(this._bossAddsTimer<=0){this._bossAddsTimer=19;if(this.enemies.length<5){this._spawnEnemy('scout');if(this.boss.phase>=2)this._spawnEnemy('gunner');}}}
    this._refreshObjective();const marker=Math.floor(this.objectiveProgress*10);if(marker!==this._objectiveEvent){this._objectiveEvent=marker;this._emit('objective',{type:'progress',progress:this.objectiveProgress,text:this.objectiveText});}
  }
  _refreshObjective(){
    if(this.status==='won'){this.objectiveProgress=1;this.objectiveText='作战目标完成';return;}
    if(this.missionId==='m1'){this.objectiveProgress=((this.wave-1)+this._waveKills/Math.max(1,this._waveTotal))/3;this.objectiveText=this.enemies.length?`清剿第 ${this.wave}/3 轮 · 剩余 ${this.enemies.length} 架敌机`:'区域安全 · 回收残骸，准备下一轮';}
    if(this.missionId==='m2'){this.objectiveProgress=this.payload.progress;this.objectiveText=`护送信标 ${Math.round(this.payload.progress*100)}% · ${this.payload.moving?'航线推进中':'靠近信标以推进'}`;}
    if(this.missionId==='m3'){this.objectiveProgress=this.objectives.reduce((n,o)=>n+o.progress,0)/3;const o=this.objectives[this._captureIndex];this.objectiveText=o?`同步锚点 ${o.id} · ${Math.round(o.progress*100)}%${o.contested?' · 清除区域内敌机':''}`:'锚点同步完成';}
    if(this.missionId==='m4'){this.objectiveProgress=this.boss?1-this.boss.hp/this.boss.maxHp:1;this.objectiveText=this.boss?`击破 ${this.boss.name} · 阶段 ${this.boss.phase}/3`:'核心已静默';}
    this.objectiveProgress=clamp(this.objectiveProgress,0,1);
  }
  _gainXp(amount){if(!['playing','choosing'].includes(this.status)||!Number.isFinite(amount)||amount<=0)return;this.xp+=amount;if(!this._updating)this._offerLevel();}
  _offerLevel(){
    if(this.status!=='playing'||this.xp<this.xpToNext)return;const available=UPGRADES.filter(u=>this.build.filter(id=>id===u.id).length<u.maxStacks);if(!available.length){this.xp=Math.min(this.xp,this.xpToNext-1);return;}
    this.xp-=this.xpToNext;this.level++;this.xpToNext=Math.round(this.xpToNext*1.19+7);this.status='choosing';this.boosting=false;this._move={x:0,z:0};this.choices=[];
    for(let i=0;i<3&&available.length;i++){const weights=available.map(u=>u.rarity==='SSR'?1:u.rarity==='SR'?2:3),total=weights.reduce((n,w)=>n+w,0);let r=this._rand()*total,index=0;while(index<weights.length-1&&r>=weights[index])r-=weights[index++];this.choices.push(available.splice(index,1)[0]);}
    this._emit('level',{level:this.level,choices:[...this.choices]});
  }
  chooseUpgrade(id){
    if(this.status!=='choosing'||!this.choices.some(u=>u.id===id))return false;const upgrade=UPGRADES.find(u=>u.id===id);this.build.push(id);this.choices=[];
    switch(id){case'overdrive':this.stats.attack*=1.25;break;case'vitality':this.maxHp+=30;this.stats.maxHp=this.maxHp;this.hp=Math.min(this.maxHp,this.hp+35);break;case'accelerator':this.attackInterval*=.84;break;case'multishot':this.multishot++;break;case'chain':this.chainCount++;break;case'frost':this.frost++;break;case'barrier':this.stats.shield+=20;this.shield+=20;this.shieldRegen+=1.5;break;case'precision':this.stats.crit=Math.min(.95,this.stats.crit+.12);this.stats.critDamage+=.1;break;case'magnet':this.stats.pickupRadius+=1.2;this.stats.speed*=1.04;break;case'phase':this.dashRecharge=Math.max(2,this.dashRecharge*.82);this.dashCooldown=Math.min(this.dashCooldown,this.dashRecharge);this.dashDuration+=.04;break;case'vampiric':this.killHeal+=4;break;case'resonance':this.xpMultiplier+=.25;break;case'longshot':this.attackRange+=2;this.projectileSpeed*=1.12;break;case'novaBurst':this.novaBurst++;break;case'chrono':this.timeStopRemaining=Math.max(this.timeStopRemaining,4);this.stats.skillCooldown*=.85;this.skillRemaining*=.85;break;}
    this.status='playing';this._emit('upgrade',{id,name:upgrade.name});this._offerLevel();this._flush();return true;
  }
  useSkill(){
    if(this.status!=='playing'||this.skillRemaining>0)return false;this.skillRemaining=this.stats.skillCooldown;const position=copy(this.player),attack=this.stats.attack*(this.attackBuffRemaining>0?1.35:1);
    if(this.character==='nova'){this._areaDamage(position,9,attack*6);this.projectiles=this.projectiles.filter(p=>!p.hostile||distance(p,position)>9);}
    if(this.character==='aegis'){this.shield=Math.min(this.stats.shield+60,this.shield+60);this.invulnerable=Math.max(this.invulnerable,2);this._areaDamage(position,6,attack*3);}
    if(this.character==='echo'){this.timeStopRemaining=6;this.echoRemaining=6;this._areaDamage(position,8,attack*2);}
    if(this.character==='lyra'){let from=position;for(const e of [...this.enemies].sort((a,b)=>distance(a,position)-distance(b,position)).slice(0,8)){if(distance(e,position)>16)continue;this.shots.push({id:this._uid('lyra'),from:copy(from),to:copy(e),life:.4,color:'#d1b7ed'});this._hitEnemy(e,attack*3.6,from);from=e;}}
    if(this.character==='rook'){this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.28);this.regenRemaining=6;this.shield+=12;this._areaDamage(position,5,attack*1.5);}
    if(this.character==='iris'){this.magnetRemaining=7;this.energy=this.stats.energyMax;this.dashCharges=this.maxDashCharges;this.dashCooldown=0;this._areaDamage(position,7,attack*3);this._collectFood(.5);}
    this._emit('skill',{character:this.character,position});if(!this._updating&&this.status==='playing')this._offerLevel();this._flush();return true;
  }
  useSupport(){
    if(this.status!=='playing'||this.supportRemaining>0||!this.supportIds.length)return false;this.supportRemaining=25;const position=copy(this.player);
    for(const id of this.supportIds){if(id==='nova')this.attackBuffRemaining=8;if(id==='aegis'){this.shield+=45;this.invulnerable=Math.max(this.invulnerable,1);}if(id==='echo')this.timeStopRemaining=Math.max(this.timeStopRemaining,3);if(id==='lyra')this._areaDamage(position,12,this.stats.attack*2);if(id==='rook')this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.2);if(id==='iris'){this.magnetRemaining=6;this.dashCharges=this.maxDashCharges;this.dashCooldown=0;}}
    this._areaDamage(position,6,this.stats.attack*1.5);this._emit('support',{supportIds:[...this.supportIds],position});this._flush();return true;
  }
  _areaDamage(position,radius,damage){for(const e of [...this.enemies])if(distance(e,position)<=radius){this.shots.push({id:this._uid('pulse'),from:copy(position),to:copy(e),life:.25,color:'#e9c187'});this._hitEnemy(e,damage,position);}}
  _finish(won,reason){
    if(this.status==='dead'||this.status==='won')return;this.status=won?'won':'dead';this.reason=reason;this.deathReason=won?'':reason;this.boosting=false;this.boostRequested=false;this.dashRemaining=0;this._move={x:0,z:0};this.choices=[];this._events=this._events.filter(e=>e.name!=='level');
    if(won){this.score+=1000+Math.round(this.hp*2);this.objectiveProgress=1;this.objectiveText='作战目标完成';}this._emit(won?'won':'death',{reason,score:this.score,kills:this.kills,elapsed:this.elapsed,mission:this.missionId,missionId:this.missionId});
  }
}
