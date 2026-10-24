export const SIZE = 24;
export const DIRECTIONS = { up: [0,-1], down:[0,1], left:[-1,0], right:[1,0] };
export class SnakeGame {
  constructor({ random = Math.random, onEvent = () => {} } = {}) {
    this.random = random; this.onEvent = onEvent; this.reset();
  }
  reset({ mode = 'classic', difficulty = 'normal' } = {}) {
    this.mode = mode; this.difficulty = difficulty; this.status = 'ready';
    this.snake = Array.from({length:7}, (_,i)=>({x:12-i,z:12}));
    this.previous = this.snake.map(p=>({...p})); this.direction='right'; this.queue=[];
    this.food=[]; this.score=0; this.eaten=0; this.combo=0; this.comboTime=0;
    this.energy=100; this.boosting=false; this.boostRequested=false; this.elapsed=0;
    this.accumulator=0; this.slowTime=0; this.level=1; this.deathReason='';
    this.spawnFood({x:16,z:12}); this.spawnFood(); this.spawnFood();
  }
  start() { if(this.status==='ready') {this.status='playing'; this.onEvent('start',{});} }
  pause() { if(this.status==='playing') {this.status='paused'; this.boostRequested=false; this.boosting=false;} }
  resume() {if(this.status==='paused')this.status='playing';}
  turn(direction) {
    if(!DIRECTIONS[direction] || this.status!=='playing' || this.queue.length>=2)return false;
    const last=this.queue.at(-1)||this.direction, a=DIRECTIONS[last], b=DIRECTIONS[direction];
    if(last===direction || (a[0]+b[0]===0 && a[1]+b[1]===0)) return false;
    this.queue.push(direction); return true;
  }
  get speed() {
    const base={chill:4.5,normal:6,hard:8}[this.difficulty]||6;
    return (base+Math.min(5,(this.level-1)*0.55))*(this.boosting?1.8:1)*(this.slowTime>0?0.62:1);
  }
  get progress() {return Math.min(1,this.accumulator*this.speed);}
  setBoost(on) {this.boostRequested=!!on;}
  spawnFood(preferred) {
    const free=[];
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      if(!this.snake.some(s=>s.x===x&&s.z===z)&&!this.food.some(f=>f.x===x&&f.z===z))free.push({x,z});
    }
    if(!free.length)return false;
    const p=preferred&&free.some(f=>f.x===preferred.x&&f.z===preferred.z)?preferred:free[Math.floor(this.random()*free.length)];
    const type=this.eaten>0&&this.eaten%6===0&&!this.food.some(f=>f.type==='chrono')?'chrono':this.random()<.18?'gold':'normal';
    this.food.push({...p,type,id:`${this.eaten}-${this.elapsed}-${this.random()}`}); return true;
  }
  update(dt) {
    if(this.status!=='playing')return;
    dt=Math.min(Math.max(dt,0),.1); this.elapsed+=dt;
    this.comboTime=Math.max(0,this.comboTime-dt); if(this.comboTime===0)this.combo=0;
    this.slowTime=Math.max(0,this.slowTime-dt);
    const was=this.boosting;
    this.boosting=this.boostRequested&&this.energy>2;
    this.energy=Math.max(0,Math.min(100,this.energy+(this.boosting?-38:14)*dt));
    if(this.energy<=2){this.boosting=false;this.boostRequested=false;}
    if(this.boosting&&!was)this.onEvent('boost',{});
    this.accumulator+=dt;
    let steps=0;
    while(this.accumulator>=1/this.speed&&this.status==='playing'&&steps++<5) {
      this.accumulator-=1/this.speed; this.step();
    }
  }
  step() {
    if(this.status!=='playing')return;
    if(this.queue.length){this.direction=this.queue.shift();this.onEvent('turn',{});}
    this.previous=this.snake.map(p=>({...p}));
    const [dx,dz]=DIRECTIONS[this.direction]; let x=this.snake[0].x+dx,z=this.snake[0].z+dz;
    if(x<0||x>=SIZE||z<0||z>=SIZE) {
      if(this.mode==='infinity'){x=(x+SIZE)%SIZE;z=(z+SIZE)%SIZE;this.onEvent('warp',{x,z});}
      else {this.die('撞上了能量边界');return;}
    }
    const index=this.food.findIndex(f=>f.x===x&&f.z===z), eating=index!==-1;
    const body=eating?this.snake:this.snake.slice(0,-1);
    if(!this.boosting&&body.some(s=>s.x===x&&s.z===z)){this.die('与自己的轨迹相撞');return;}
    this.snake.unshift({x,z});
    if(!eating)this.snake.pop();
    else {
      const food=this.food.splice(index,1)[0];
      this.eaten++;this.combo=this.comboTime>0?Math.min(this.combo+1,8):1;this.comboTime=7;
      const gain=(food.type==='gold'?250:100)*this.combo*(this.boosting?2:1);
      this.score+=gain; this.energy=Math.min(100,this.energy+16);
      if(food.type==='chrono')this.slowTime=5;
      const oldLevel=this.level;this.level=1+Math.floor(this.eaten/5);
      this.onEvent('eat',{...food,gain,combo:this.combo,boosting:this.boosting});
      if(this.level!==oldLevel)this.onEvent('level',{level:this.level});
      if(new Set(this.snake.map(p=>p.x+','+p.z)).size===SIZE*SIZE){this.status='won';this.onEvent('won',{});return;}
      this.spawnFood();
    }
  }
  die(reason) {this.deathReason=reason;this.status='dead';this.boosting=false;this.boostRequested=false;this.onEvent('death',{reason,position:{...this.snake[0]}});}
}
