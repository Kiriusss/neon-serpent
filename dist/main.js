import { SnakeGame } from './engine.js';
import { Arena } from './scene.js';
import { SoundEngine } from './audio.js';

const $=(s)=>document.querySelector(s),$$=(s)=>[...document.querySelectorAll(s)];
const fmt=(n)=>String(n).padStart(6,'0'),two=(n)=>String(n).padStart(2,'0');
const storage={get(k,fallback){try{const v=localStorage.getItem('neon-serpent:'+k);return v===null?fallback:JSON.parse(v);}catch{return fallback;}},set(k,v){try{localStorage.setItem('neon-serpent:'+k,JSON.stringify(v));}catch{}}};
const sound=new SoundEngine();
let phase='menu',previousPhase='playing',selectedMode=storage.get('mode','classic'),selectedDifficulty=storage.get('difficulty','normal');
if(!['classic','infinity'].includes(selectedMode))selectedMode='classic';if(!['chill','normal','hard'].includes(selectedDifficulty))selectedDifficulty='normal';
let muted=storage.get('muted',false),arena,game,count=3,countTime=0,lastTime=0,hudTime=0,maxCombo=0,starting=false;
let toastTimer,feedbackTimer,modalType='',returnFocus=null,newRecord=false,lastBoost=false;
const savedRecords=storage.get('records',{});const records=savedRecords&&typeof savedRecords==='object'&&!Array.isArray(savedRecords)?savedRecords:{};const recordKey=()=>selectedMode+':'+selectedDifficulty;
const record=()=>Number(records[recordKey()])||0;
sound.setMuted(muted);

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
function feedback(title,subtitle=''){const element=$('#feedback');element.replaceChildren();element.append(document.createTextNode(title));if(subtitle){const small=document.createElement('small');small.textContent=subtitle;element.append(small);}element.classList.remove('pop');void element.offsetWidth;element.classList.add('pop');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>element.classList.remove('pop'),1500);}
function setSoundUI(){const button=$('#sound');button.querySelector('use').setAttribute('href',muted?'#i-muted':'#i-volume');button.setAttribute('aria-label',muted?'开启声音':'静音');button.setAttribute('aria-pressed',String(muted));button.title=muted?'开启声音 (M)':'静音 (M)';}
function updateSelection(){
  $$('.mode').forEach(b=>{const on=b.dataset.mode===selectedMode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $$('[data-difficulty]').forEach(b=>{const on=b.dataset.difficulty===selectedDifficulty;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('#difficulty-note').textContent={chill:'慢一点，也很酷',normal:'找到你的心跳',hard:'把反应交给本能'}[selectedDifficulty];
  $('#home-best').textContent=fmt(record());$('#best').textContent=record();
  $('#mode-label').textContent=selectedMode==='classic'?'经典竞速':'无尽穿梭';$('#arena-mode').textContent='SECTOR 07 / '+(selectedMode==='classic'?'CLASSIC':'INFINITY');
}
function hideModal(){const focus=returnFocus;$('#modal').hidden=true;modalType='';if(focus?.isConnected)focus.focus({preventScroll:true});}
function showModal(type,{eyebrow,title,content,actions,close=true}){
  if($('#modal').hidden)returnFocus=document.activeElement;
  modalType=type;$('#modal-eyebrow').textContent=eyebrow;$('#modal-title').innerHTML=title;$('#modal-content').innerHTML=content;$('#modal-actions').replaceChildren();
  for(const action of actions){const b=document.createElement('button');b.className=action.primary?'launch':'secondary-button';b.textContent=action.label;b.addEventListener('click',action.run);$('#modal-actions').append(b);}
  $('#modal-close').hidden=!close;$('#modal').hidden=false;$('#modal-actions button')?.focus({preventScroll:true});
}
function showHelp(){
  if(phase==='playing'||phase==='countdown')pause();
  showModal('help',{eyebrow:'FIELD MANUAL / 操作指南',title:'跟随本能。<br><span>掌控每一次转向。</span>',content:`<div class="guide-row"><span><kbd>W A S D</kbd><br><br><kbd>↑ ← ↓ →</kbd></span><p>移动方向。无法直接掉头。<br>转弯可以提前输入。</p></div><div class="guide-row"><span><kbd>SPACE</kbd></span><p>按住相位冲刺。加速、穿过自己的蛇身，吞噬得分翻倍。消耗能量，松开恢复。<strong>经典模式仍会撞墙。</strong></p></div><div class="guide-row"><span><kbd>C</kbd> <kbd>ESC</kbd></span><p>切换俯视 / 立体视角 · 暂停<br><kbd>R</kbd> 重新开始 · <kbd>M</kbd> 声音</p></div><p class="guide-note">粉色能量 +100 · 金色核心 +250<br>蓝色晶体让世界减速 5 秒。7 秒内连续吞噬，倍率最高 ×8。<br>手机可滑动屏幕或使用方向按钮。</p>`,actions:[{label:'明白了，开始连接',primary:true,run:()=>{hideModal();if(phase==='paused')resume();else start();}}]});
}
async function start(){
  if(starting||!arena)return;starting=true;
  try{await sound.unlock();}catch{}finally{starting=false;}
  hideModal();document.body.classList.add('in-game');document.body.classList.remove('boosting');arena.setMenu(false);
  game.reset({mode:selectedMode,difficulty:selectedDifficulty});phase='countdown';count=3;countTime=0;maxCombo=0;lastBoost=false;newRecord=false;
  $('#countdown').hidden=false;$('#countdown b').textContent='3';$('#status-label').textContent='保持饥饿。保持移动。';sound.setPlaying(false);sound.setBoost(false);sound.play('countdown',3);
  updateSelection();updateHud();$('#world').focus({preventScroll:true});
}
function pause(){
  if(!['playing','countdown'].includes(phase))return;
  previousPhase=phase;phase='paused';game.pause();game.setBoost(false);sound.setBoost(false);sound.setPlaying(false);sound.play('pause');$('#countdown').hidden=true;
  showModal('pause',{eyebrow:'NEURAL LINK / PAUSED',title:'暂停一下，<br><span>世界等你。</span>',content:'<p>深呼吸。准备好后，继续你的霓虹之旅。</p>',actions:[{label:'继续连接 →',primary:true,run:resume},{label:'重新开始',run:start},{label:'返回主界面',run:goHome}]});
}
function resume(){if(phase!=='paused')return;hideModal();phase=previousPhase;game.resume();if(phase==='countdown')$('#countdown').hidden=false;else sound.setPlaying(true);sound.unlock().then(()=>{if(phase==='playing')sound.setPlaying(true);});sound.play('resume');}
function goHome(){hideModal();phase='menu';document.body.classList.remove('in-game','boosting');$('#countdown').hidden=true;arena.setMenu(true);game.reset({mode:selectedMode,difficulty:selectedDifficulty});sound.setPlaying(false);sound.setBoost(false);updateSelection();$('#start').focus({preventScroll:true});}
function gameOver(won=false){
  phase='dead';sound.setPlaying(false);sound.setBoost(false);document.body.classList.remove('boosting');
  const oldBest=record();newRecord=game.score>oldBest;if(newRecord){records[recordKey()]=game.score;storage.set('records',records);}updateSelection();
  const reason=won?'竞技场已被你的光芒填满。':game.deathReason;
  showModal('dead',{eyebrow:won?'SECTOR COMPLETE / 完全占领':'CONNECTION LOST / 本次旅程结束',title:won?'你，定义了极限。':'断开连接。<br><span>再来，超越自己。</span>',content:`<p>${reason}</p><div class="result-score">${fmt(game.score)}</div><div class="new-best">${newRecord?'✦ NEW PERSONAL BEST · 新纪录已保存':'YOUR RUN / '+(selectedMode==='classic'?'经典竞速':'无尽穿梭')}</div><div class="result-grid"><span>存活时间<b>${two(Math.floor(game.elapsed/60))}:${two(Math.floor(game.elapsed%60))}</b></span><span>吞噬能量<b>${two(game.eaten)}</b></span><span>最高连击<b>×${maxCombo}</b></span></div>`,actions:[{label:'再来一次 ↗',primary:true,run:start},{label:'返回主界面',run:goHome}],close:false});
}
function onEvent(name,data){
  if(name==='eat'){
    arena?.eat(data);sound.play(data.type==='normal'?'eat':'golden',data.combo);maxCombo=Math.max(maxCombo,data.combo);
    const title=data.type==='chrono'?'时间，为你慢下来。':data.boosting?'PHASE EAT +'+data.gain:data.combo>=3?'COMBO ×'+data.combo:'+'+data.gain;
    const subtitle=data.type==='gold'?'GOLDEN CORE · 黄金核心':data.type==='chrono'?'TIME DILATION · 5 SECONDS':data.boosting?'相位吞噬 / 双倍得分':data.combo>=3?'持续吞噬 / 倍率叠加':'ENERGY ABSORBED';feedback(title,subtitle);
    $('#flash').style.opacity='.45';setTimeout(()=>$('#flash').style.opacity='0',70);
  }else if(name==='death'){arena?.death(data);sound.play('death');gameOver();}
  else if(name==='won'){sound.play('level',5);gameOver(true);}
  else if(name==='level'){sound.play('level',data.level);feedback('EVOLUTION '+two(data.level),'进化完成 / 速度提升');}
  else if(name==='warp'){sound.play('ui');arena?.shock(data.x-11.5,data.z-11.5,0x758bff);}
  else sound.play(name);
}
function updateHud(){
  $('#score').textContent=fmt(game.score);$('#length').textContent=two(game.snake.length);$('#level').textContent=two(game.level);$('#time').textContent=two(Math.floor(game.elapsed/60))+':'+two(Math.floor(game.elapsed%60));
  $('#energy-value').textContent=Math.round(game.energy)+'%';$('#energy-bar').style.transform=`scaleX(${game.energy/100})`;
  $('#combo').textContent='×'+game.combo;$('#combo-wrap').classList.toggle('active',game.combo>0);$('#combo-bar').style.transform=`scaleX(${game.comboTime/7})`;
  document.body.classList.toggle('boosting',game.boosting);
  $('#status-label').textContent=game.boosting?'相位展开 / 蛇身碰撞已解除':game.slowTime>0?'时间膨胀 / '+Math.ceil(game.slowTime)+' 秒':selectedMode==='infinity'?'穿过边界，继续向前。':'保持饥饿。保持移动。';
  if(lastBoost!==game.boosting){lastBoost=game.boosting;sound.setBoost(lastBoost);}
}
function tick(now){
  const dt=Math.min(lastTime?(now-lastTime)/1000:.016,.1);lastTime=now;
  if(phase==='countdown'){
    countTime+=dt;if(countTime>=.8){countTime-=.8;count--;if(count>0){$('#countdown b').textContent=count;sound.play('countdown',count);}else{phase='playing';$('#countdown').hidden=true;game.start();sound.setPlaying(true);feedback('STAY HUNGRY.','保持饥饿 / 保持移动');}}
  }
  if(phase==='playing')game.update(dt);
  hudTime+=dt;if(hudTime>.05){hudTime=0;updateHud();}
  arena.render(dt,game);requestAnimationFrame(tick);
}

try{
  game=new SnakeGame({onEvent});game.reset({mode:selectedMode,difficulty:selectedDifficulty});
  arena=new Arena($('#world'),{onFailure(message){pause();toast(message);}});
  if(storage.get('lowQuality',false))arena.setQuality(true);
  $('#quality').textContent=arena.low?'流畅画质':'极光画质';
  updateSelection();setSoundUI();requestAnimationFrame(tick);$('#loading').classList.add('fade');setTimeout(()=>$('#loading').hidden=true,600);
}catch(error){
  console.error('Renderer initialization failed:',error);$('#loading').innerHTML='<span class="loading-icon">◇</span><b>图形引擎未能启动</b><p>请使用支持 WebGL 2 的浏览器，并开启硬件加速。</p><button class="secondary-button" id="reload">重新连接</button>';$('#reload').addEventListener('click',()=>location.reload());$('#start').disabled=true;
}

$('#start').addEventListener('click',start);$('#help').addEventListener('click',showHelp);$('#pause-button').addEventListener('click',pause);
$('.brand').addEventListener('click',(e)=>{e.preventDefault();if(arena)goHome();});
$$('.mode').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.mode;storage.set('mode',selectedMode);game?.reset({mode:selectedMode,difficulty:selectedDifficulty});updateSelection();sound.play('ui');}));
$$('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{selectedDifficulty=b.dataset.difficulty;storage.set('difficulty',selectedDifficulty);game?.reset({mode:selectedMode,difficulty:selectedDifficulty});updateSelection();sound.play('ui');}));
$('#sound').addEventListener('click',async()=>{muted=!muted;if(!muted)await sound.unlock();sound.setMuted(muted);storage.set('muted',muted);setSoundUI();toast(muted?'声音已关闭':'声音已开启 · 戴上耳机，进入状态');});
$('#quality').addEventListener('click',()=>{if(!arena)return;arena.setQuality(!arena.low);storage.set('lowQuality',arena.low);$('#quality').textContent=arena.low?'流畅画质':'极光画质';toast(arena.low?'流畅模式 · 已关闭泛光':'极光模式 · 光芒全开');});
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('当前浏览器不支持全屏，请使用浏览器菜单');}catch{toast('全屏未能开启，请使用浏览器菜单');}}
$('#fullscreen').addEventListener('click',toggleFullscreen);
$('#modal-close').addEventListener('click',()=>{if(phase==='paused')resume();else hideModal();});

document.addEventListener('keydown',(e)=>{
  const key=e.key.toLowerCase();
  if(key==='tab'&&!$('#modal').hidden){const buttons=[...$('#modal').querySelectorAll('button:not([hidden])')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
  if(key==='escape'||key==='p'){e.preventDefault();if(modalType==='help'&&phase==='menu')hideModal();else if(phase==='paused')resume();else pause();return;}
  if(e.repeat&&['enter','m','c','f','r'].includes(key))return;
  if(key==='m'){$('#sound').click();return;}if(key==='f'){toggleFullscreen();return;}
  if(key==='enter'){
    if(e.target.closest?.('button,a,input,select,textarea'))return;
    if(modalType==='help')return;
    if(phase==='menu'||phase==='dead'){e.preventDefault();start();}else if(phase==='paused'){e.preventDefault();resume();}return;
  }
  if(phase==='menu'||phase==='dead'||phase==='paused')return;
  if(key==='c'&&arena){arena.topView=!arena.topView;toast(arena.topView?'战术俯视 · 每一步都清晰':'沉浸视角 · 回到霓虹之中');return;}
  if(key==='r'){e.preventDefault();start();return;}
  const map={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  if(map[key]){e.preventDefault();if(!e.repeat)game.turn(map[key]);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat&&phase==='playing')game.setBoost(true);}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')game?.setBoost(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTime=0;});
window.addEventListener('blur',()=>pause());
window.addEventListener('pointermove',e=>{if(arena)arena.pointer.set((e.clientX/innerWidth-.5)*2,(e.clientY/innerHeight-.5)*2);});
$$('[data-turn]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();game?.turn(b.dataset.turn);}));
$('#touch-boost').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);if(phase==='playing')game.setBoost(true);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('#touch-boost').addEventListener(name,()=>game?.setBoost(false));
let swipe=null;$('#world').addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY};});
$('#world').addEventListener('pointermove',e=>{if(!swipe||e.pointerType==='mouse'||phase!=='playing')return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))>22){game.turn(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');swipe={x:e.clientX,y:e.clientY};}});
for(const name of ['pointerup','pointercancel'])window.addEventListener(name,()=>{swipe=null;});
window.addEventListener('pagehide',e=>{if(e.persisted)pause();else sound.dispose();});
