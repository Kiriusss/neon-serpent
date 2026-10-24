import { SnakeGame, WORLD, UPGRADES } from './engine.js';
import { Arena } from './scene.js';
import { SoundEngine } from './audio.js';
import { CHARACTERS, GACHA_RULES, GACHA_COST, MAX_LEVEL, createProfile, sanitizeProfile, getStats, pull, selectCharacter, levelUp, upgradeCost, settleRun } from './meta.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const two = n => String(Math.floor(n)).padStart(2, '0');
const num = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = 'starfall.profile.v2';
const storage = {get(name,fallback){try{const raw=localStorage.getItem(name);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}},set(name,value){try{localStorage.setItem(name,JSON.stringify(value));return true;}catch{return false;}}};
let profile;
try{const raw=localStorage.getItem(key);profile=raw===null?createProfile():sanitizeProfile(JSON.parse(raw));}catch{profile=sanitizeProfile({});}
let saveWarning = !storage.set(key,profile);
let difficulty=storage.get('starfall.difficulty','normal');
if(!['chill','normal','hard'].includes(difficulty))difficulty='normal';
let muted=storage.get('starfall.muted',false),phase='menu',screen='lobby',inspectId=profile.selected;
let arena,game,runPilot,runId='',settled=false,starting=false,previousPhase='playing',runStarted=false;
let countdown=3,countdownTime=0,lastTime=0,hudClock=0,lastBuild='',lastBoost=false;
let toastTimer,calloutTimer,summonTimer,modalType='',returnFocus=null,draws=[],drawHistory=storage.get('starfall.history',[]);
if(!Array.isArray(drawHistory))drawHistory=[];
const sound=new SoundEngine();sound.setMuted(muted);
const character = id => CHARACTERS.find(c=>c.id===id)||CHARACTERS[4];
const portraitStyle = c => '--px:'+((c.portraitIndex%3)*50)+'%;--py:'+(Math.floor(c.portraitIndex/3)*100)+'%;--pilot:'+c.color;
function setPortrait(el,c){el.style.setProperty('--px',((c.portraitIndex%3)*50)+'%');el.style.setProperty('--py',(Math.floor(c.portraitIndex/3)*100)+'%');el.setAttribute('aria-label',c.name+'立绘');}
function save(){if(!storage.set(key,profile)){saveWarning=true;toast('浏览器未允许保存数据，本次进度仅在当前页面有效。');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function callout(title,subtitle=''){const node=$('#callout');node.replaceChildren();const b=document.createElement('b');b.textContent=title;node.append(b);if(subtitle){const small=document.createElement('small');small.textContent=subtitle;node.append(small);}node.classList.remove('show');void node.offsetWidth;node.classList.add('show');clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>node.classList.remove('show'),2300);}
function applyProfile(result){if(!result.ok){toast(result.message||'操作未完成');return false;}profile=result.profile;save();refreshProfile();return true;}

function refreshProfile(){
  const c=character(profile.selected),entry=profile.characters[c.id];
  $('#crystals').textContent=num(profile.crystals);$('#materials').textContent=num(profile.materials);
  setPortrait($('#lobby-portrait'),c);$('#lobby-name').textContent=c.name;$('#lobby-title').textContent=c.title;$('#lobby-quote').textContent='「'+c.quote+'」';
  $('#lobby-rarity').textContent=c.rarity+' / '+c.element+' · 同步率 '+entry.level;$('#lobby-rarity').dataset.rarity=c.rarity;
  $('#best-score').textContent='最高记录 '+num(profile.bestScore);
  $('#ssr-pity').textContent=profile.gacha.pitySSR+' / 50';$('#pity-bar').style.width=(profile.gacha.pitySSR/50*100)+'%';
  $('#beginner-note').textContent=profile.gacha.beginnerClaimed?'已完成新手保障 · 距 SR 及以上最多 '+(10-profile.gacha.pitySR)+' 抽':'新手保障：最多再 '+Math.max(1,10-profile.gacha.total)+' 抽获得 SSR';
  $('#pull-one').disabled=profile.crystals<GACHA_COST;$('#pull-ten').disabled=profile.crystals<GACHA_COST*10;
  $$('[data-difficulty]').forEach(b=>{b.classList.toggle('active',b.dataset.difficulty===difficulty);b.setAttribute('aria-pressed',String(b.dataset.difficulty===difficulty));});
  if(phase==='menu'){arena?.setCharacter(c);if(game)game.reset({character:c,stats:getStats(profile),difficulty});}
  if(screen==='roster')renderRoster();
}
function showScreen(name){
  if(phase!=='menu'||!['lobby','roster','gacha'].includes(name))return;
  screen=name;$$('.screen').forEach(el=>{el.hidden=el.id!==name;});
  $$('[data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===name);b.setAttribute('aria-current',b.dataset.screen===name?'page':'false');});
  document.body.dataset.screen=name;if(name==='roster')renderRoster();sound.play('ui');
}
function renderRoster(){
  $('#character-grid').innerHTML=CHARACTERS.map(c=>{
    const owned=profile.characters[c.id],selected=inspectId===c.id;
    return '<button class="character-card '+(selected?'selected ':'')+(!owned.owned?'locked ':'')+(profile.selected===c.id?'deployed':'')+'" data-character="'+c.id+'" data-rarity="'+c.rarity+'" aria-pressed="'+selected+'"><div class="portrait" style="'+portraitStyle(c)+'"></div><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><div class="card-meta"><b>'+c.name+'</b><small>'+(owned.owned?'同步率 '+owned.level+' · 共鸣 '+owned.resonance:'未唤醒')+'</small></div>'+'</button>';
  }).join('');
  const c=character(inspectId),entry=profile.characters[c.id],stats=getStats(profile,c.id),cost=upgradeCost(entry.level);
  const statEntries=[['攻击',stats.attack],['生命',stats.maxHp],['防御',stats.defense],['暴击',Math.round(stats.crit*100)+'%'],['暴伤',Math.round(stats.critDamage*100)+'%'],['初始护盾',stats.shield],['技能冷却',stats.skillCooldown+'s'],['能量恢复',stats.energyRegen+'/s']];
  $('#character-detail').innerHTML='<div class="detail-heading"><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+' · '+c.element+'</span><h2>'+c.name+'<small>'+c.title+'</small></h2><p>「'+c.quote+'」</p></div><div class="detail-copy">'+c.description+'</div><div class="resonance"><span>同步率 <b>Lv.'+entry.level+'</b> / '+MAX_LEVEL+'</span><span>共鸣 '+Array.from({length:5},(_,i)=>i<entry.resonance?'◆':'◇').join('')+'</span></div><div class="detail-stats">'+statEntries.map(([label,value])=>'<div class="stat-cell"><span>'+label+'</span><b>'+value+'</b></div>').join('')+'</div><div class="detail-skill"><small>主动技能 / F</small><h3>'+c.skillName+'</h3><p>'+c.skillDescription+'</p><small>驾驶员特性 / '+c.passiveName+'</small><p>'+c.passiveDescription+'</p></div><details class="detail-story"><summary>驾驶员往事 · 记忆档案</summary><p>'+c.story+'</p></details><div class="detail-actions">'+(entry.owned?'<button class="primary" data-deploy="'+c.id+'" '+(profile.selected===c.id?'disabled':'')+'>'+(profile.selected===c.id?'当前出战驾驶员':'建立链接 · 出战')+'</button><button class="outline-button" data-level="'+c.id+'" '+(entry.level>=MAX_LEVEL||profile.materials<cost?'disabled':'')+'>'+(entry.level>=MAX_LEVEL?'同步率已满':'培养同步率 <small>▱ '+cost+'</small>')+'</button>':'<button class="primary" data-recruit="true">前往回响寻访 →</button>')+'</div>';
}
function hideModal(){const oldFocus=returnFocus;$('#modal').hidden=true;modalType='';if(oldFocus?.isConnected&&oldFocus.offsetParent!==null)oldFocus.focus({preventScroll:true});}
function showModal(type,{eyebrow='',title='',content='',actions=[],close=true,wide=false}){
  if($('#modal').hidden)returnFocus=document.activeElement;
  modalType=type;$('#modal-eyebrow').textContent=eyebrow;$('#modal-title').innerHTML=title;$('#modal-content').innerHTML=content;
  $('.modal-card').classList.toggle('wide',wide);$('#modal-actions').replaceChildren();
  actions.forEach(a=>{const button=document.createElement('button');button.className=a.primary?'primary':'outline-button';button.textContent=a.label;button.addEventListener('click',a.run);$('#modal-actions').append(button);});
  $('#modal-close').hidden=!close;$('#modal').hidden=false;$('#modal-actions button')?.focus({preventScroll:true});
}
function showStory(){
  showModal('story',{eyebrow:'WORLD ARCHIVE / 方舟档案 0001',title:'群星失声之日',content:'<div class="lore-section"><p>第七次坍缩发生时，星舰、城市与人的记忆一同坠入了折叠空间。幸存的方舟 07，至今仍在接收一段来自宇宙深处的求救信号。</p><h3>你与衔尾机</h3><p>你是方舟的「链接者」。通过驾驶员的意识回响，操纵可以不断延展的衔尾机，在三维遗迹间寻找航路。机身留下的每一道轨迹，都是记忆重新连接的证据。</p><h3>记忆不该被遗忘</h3><p>散落的星骸保存着文明最后的声音。回收它们，可以唤醒新的驾驶员；融合遗迹中的异构技术，则让你在每次深潜中获得不同的能力。</p><h3>寂星之心</h3><p>信号来自第五区段，一个仍在跳动的核心。它究竟是文明的最后守望者，还是吞噬一切回忆的源头？穿越破碎航道、失重庭院、回声熔炉和零界深井，答案就在尽头。</p></div>',actions:[{label:'我听见了。返回方舟',primary:true,run:hideModal}],wide:true});
}
function help(){
  if(['playing','countdown','choosing'].includes(phase))pause(false);
  showModal('help',{eyebrow:'PILOT MANUAL / 驾驶指南',title:'向六个方向，<br><span>寻找你的生路。</span>',content:'<div class="guide-grid"><p><kbd>W</kbd><kbd>S</kbd> 向远 / 向近（Z 轴）<br><kbd>A</kbd><kbd>D</kbd> 向左 / 向右（X 轴）<br><kbd>Q</kbd><kbd>E</kbd> 上升 / 下降（Y 轴）</p><p><kbd>SPACE</kbd> 按住相位加速，穿过自身<br><kbd>F</kbd> 驾驶员主动技能<br><kbd>C</kbd> 切换镜头 · 鼠标右拖旋转<br><kbd>ESC</kbd> 暂停 · <kbd>M</kbd> 声音</p></div><p>移动方向沿世界坐标，不随镜头旋转。头部高度线、当前层网格和左侧层级标记可帮助判断空间位置。手机提供六向按钮。</p><p>攻击会自动锁定范围内敌人。收集星骸和击破敌人获取经验；升级暂停后，从三项异构技术中选择一项。过关恢复部分生命，击破第五区段的寂星之心完成深潜。</p><p>碰撞会扣除护盾或生命。边界会将你传送到对侧并造成伤害，相位不能免除边界和残骸伤害。每局结算获得星晶与共鸣芯片，用于寻访和培养。</p>',actions:[{label:phase==='paused'?'返回战斗':'开始深潜',primary:true,run:()=>{hideModal();if(phase==='paused')resume();else start();}},{label:'关闭指南',run:()=>{hideModal();if(phase==='paused')pauseModal();}}],wide:true});
}
async function start(){
  if(starting||!arena)return;starting=true;
  if(['playing','paused','choosing'].includes(phase)&&runId&&!settled)settleCurrent(false,true);
  hideModal();$('#upgrade-overlay').hidden=true;phase='starting';
  try{await sound.unlock();}catch{}
  starting=false;
  runPilot=character(profile.selected);runId=crypto.randomUUID?crypto.randomUUID():'run-'+Date.now()+'-'+Math.random().toString(36).slice(2);settled=false;runStarted=false;
  game.reset({character:runPilot,stats:getStats(profile),difficulty});
  arena.setCharacter(runPilot);arena.setMenu(false);document.body.classList.add('in-game');
  phase='countdown';countdown=3;countdownTime=0;lastBuild=null;lastBoost=false;
  $('#countdown').hidden=false;$('#countdown b').textContent='3';
  setPortrait($('#hud-portrait'),runPilot);$('#hud-name').textContent=runPilot.name;$('#hud-rarity').textContent=runPilot.rarity+' · 同步率 '+profile.characters[runPilot.id].level;$('#hud-class').textContent=runPilot.title;$('#skill-name').textContent=runPilot.skillName;
  sound.setPlaying(false);sound.setBoost(false);sound.play('countdown',3);updateHud();$('#world').focus({preventScroll:true});
}
function pause(show=true){
  if(!['playing','countdown','choosing'].includes(phase))return;
  previousPhase=phase;phase='paused';game.pause();game.setBoost(false);sound.setPlaying(false);sound.setBoost(false);
  $('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;
  if(show)pauseModal();
}
function pauseModal(){
  showModal('pause',{eyebrow:'LINK STANDBY / 战术暂停',title:'信号仍在。<br><span>我们等你归来。</span>',content:'<p>「'+(runPilot?.quote||'准备好了，就出发。')+'」</p>',actions:[{label:'继续深潜 →',primary:true,run:resume},{label:'撤离并结算',run:()=>finish(false,true)}]});
}
function resume(){
  if(phase!=='paused')return;hideModal();phase=previousPhase;
  if(phase==='choosing'){showUpgrades();return;}
  if(phase==='countdown')$('#countdown').hidden=false;else {game.resume();sound.setPlaying(true);}
  sound.unlock().then(()=>{if(phase==='playing')sound.setPlaying(true);});$('#world').focus({preventScroll:true});
}
function settleCurrent(won,evacuated=false){
  if(settled||!runId)return {crystals:0,materials:0};
  if(!runStarted||(evacuated&&game.elapsed<10)){settled=true;return {crystals:0,materials:0,cancelled:true};}
  const result=settleRun(profile,{runId,score:game.score,kills:game.kills,wave:game.wave,won});
  if(result.ok){profile=result.profile;settled=true;save();return result.rewards;}
  if(result.error==='ALREADY_SETTLED')settled=true;
  return {crystals:0,materials:0};
}
function finish(won=false,evacuated=false){
  if(phase==='results')return;
  game.pause();game.setBoost(false);phase='results';
  sound.setPlaying(false);sound.setBoost(false);$('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;
  const reward=settleCurrent(won,evacuated),buildCounts=countBuild();
  refreshProfile();
  showModal('result',{eyebrow:won?'SIGNAL RESTORED / 寂星之心已被击破':evacuated?'SAFE EXTRACTION / 方舟回收信号':'LINK RECOVERED / 深潜结束',title:won?'群星，再次有了回声。':'回到方舟。<br><span>下一次，我们走得更远。</span>',content:'<p>'+(reward.cancelled?'尚未开战或提前撤离不足 10 秒，本次没有探索奖励。':won?'核心寂静了片刻。然后，你听见无数个声音说：「欢迎回家。」':evacuated?'已保存本次收获。驾驶员与机体正在归航。':escapeHTML(game.reason))+'</p><div class="result-number">'+num(game.score)+'</div><div class="result-summary"><span>探索区段<b>'+game.wave+' / 5</b></span><span>击破异构体<b>'+game.kills+'</b></span><span>深潜时长<b>'+two(game.elapsed/60)+':'+two(game.elapsed%60)+'</b></span></div><div class="reward-row"><span>✦ 星晶 <b>+'+num(reward.crystals)+'</b></span><span>▱ 共鸣芯片 <b>+'+num(reward.materials)+'</b></span></div><div class="run-build">'+Object.entries(buildCounts).map(([id,count])=>'<span>'+UPGRADES.find(u=>u.id===id)?.name+' ×'+count+'</span>').join('')+'</div>',actions:[{label:'再次深潜',primary:true,run:start},{label:'返回方舟 · 培养与寻访',run:goHome}],close:false,wide:true});
}
function goHome(){
  hideModal();phase='menu';document.body.classList.remove('in-game');$('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;
  arena?.setMenu(true);sound.setPlaying(false);sound.setBoost(false);refreshProfile();showScreen('lobby');$('#start').focus({preventScroll:true});
}
function countBuild(){const counts={};for(const id of game.build)counts[id]=(counts[id]||0)+1;return counts;}
function showUpgrades(){
  phase='choosing';sound.setPlaying(false);sound.setBoost(false);$('#upgrade-overlay').hidden=false;
  $('#upgrade-cards').innerHTML=game.choices.map((u,i)=>'<button class="upgrade-card" data-upgrade="'+u.id+'" data-rarity="'+u.rarity+'"><div class="upgrade-tag">'+u.rarity+' / '+u.tag+'<kbd>'+(i+1)+'</kbd></div><div class="upgrade-icon">'+u.icon+'</div><h3>'+u.name+'</h3><p>'+u.description+'</p><div class="upgrade-stack">当前 '+game.build.filter(id=>id===u.id).length+' / '+u.maxStacks+' 层<span>选择融合 →</span></div></button>').join('');
  $('#upgrade-cards button')?.focus({preventScroll:true});
}
function choose(id){
  if(phase!=='choosing')return;
  if(!game.chooseUpgrade(id))return;
  if(game.status==='choosing'){showUpgrades();return;}
  $('#upgrade-overlay').hidden=true;phase='playing';sound.setPlaying(true);sound.unlock();updateHud();$('#world').focus({preventScroll:true});
}
function onEvent(name,data){
  if(['eat','damage','kill','skill','won'].includes(name))arena?.effect(name,data);
  if(name==='eat'){sound.play(data.type==='gold'?'golden':'eat',data.combo||1);if(data.heightCombo)callout('跨层回收 +'+data.gain,'空间连携 / 额外 50% 积分');}
  else if(name==='damage'){sound.play('pause');$('#damage-flash').classList.add('hit');setTimeout(()=>$('#damage-flash').classList.remove('hit'),220);}
  else if(name==='level'){if(!['won','dead'].includes(game.status)){sound.play('level',game.level);showUpgrades();}}
  else if(name==='upgrade'){callout(UPGRADES.find(u=>u.id===data.id)?.name||'技术融合','本局强化已生效');}
  else if(name==='skill'){sound.play('golden',3);if(!['results','choosing'].includes(phase))callout(data.name,runPilot?.quote||'');}
  else if(name==='wave'){callout('区段 '+two(data.wave)+' / '+data.name,data.wave===5?'最终信号已定位 / 寂星之心苏醒':'清除异构体，继续向遗迹深处');}
  else if(name==='boss'){sound.play('level',4);}
  else if(name==='death'){sound.play('death');finish(false);}
  else if(name==='won'){sound.play('level',5);finish(true);}
  else if(['boost','start','turn'].includes(name))sound.play(name);
}
function updateHud(){
  if(!game)return;
  const head=game.snake[0],energy=game.energy/Math.max(1,game.stats.energyMax);
  $('#hp-text').textContent=Math.ceil(game.hp)+' / '+Math.ceil(game.maxHp);$('#hp-bar').style.width=(Math.max(0,game.hp/game.maxHp)*100)+'%';
  $('#shield').textContent=Math.ceil(game.shield);$('#invulnerable').textContent=game.invulnerable>0?'保护中':'';
  $('#score').textContent=String(game.score).padStart(6,'0');$('#kills').textContent=two(game.kills);$('#length').textContent=two(game.snake.length);$('#time').textContent=two(game.elapsed/60)+':'+two(game.elapsed%60);
  $('#level').textContent=game.level;$('#xp-text').textContent=game.xp+' / '+game.xpToNext;$('#xp-bar').style.width=(Math.min(1,game.xp/game.xpToNext)*100)+'%';
  $('#coord-x').textContent=two(head.x);$('#coord-y').textContent=two(head.y);$('#coord-z').textContent=two(head.z);$('#height-label').textContent='L'+(head.y+1)+' / '+WORLD.y;
  $('#height-levels').innerHTML=Array.from({length:WORLD.y},(_,i)=>'<i class="'+(i===head.y?'active':'')+'"></i>').join('');
  $('#wave-code').textContent='SECTOR '+two(game.wave)+' / 05';$('#wave-name').textContent=game.waveName;
  $('#objective').textContent=game.timeStopRemaining>0?'时序冻结 · '+Math.ceil(game.timeStopRemaining)+' 秒':game.boosting?'相位展开 · 仍需避开残骸和边界':'异构体剩余 '+game.enemies.length+' · 自动攻击附近目标';
  $('#energy-text').textContent=Math.round(energy*100)+'%';$('#energy-bar').style.width=(energy*100)+'%';
  $('#skill-cooldown').textContent=game.skillRemaining>0?Math.ceil(game.skillRemaining)+'s':'就绪';$('#skill').disabled=phase!=='playing'||game.skillRemaining>0;
  $('#stat-attack').textContent=Math.round(game.stats.attack);$('#stat-crit').textContent=Math.round(game.stats.crit*100)+'%';$('#stat-defense').textContent=Math.round(game.stats.defense);
  const build=game.build.join(',');if(build!==lastBuild||$('#build-list').dataset.ready!=='true'){
    lastBuild=build;$('#build-list').dataset.ready='true';$('#build-count').textContent=game.build.length;
    $('#build-list').innerHTML=game.build.length?Object.entries(countBuild()).map(([id,count])=>{const u=UPGRADES.find(u=>u.id===id);return '<div class="build-item" title="'+u.description+'"><span>'+u.icon+'</span><b>'+u.name+'</b><small>×'+count+'</small></div>';}).join(''):'<p>收集星骸，升级后选择异构技术。</p>';
  }
  $('#boss-hud').hidden=!game.boss;if(game.boss){$('#boss-bar').style.width=Math.max(0,game.boss.hp/game.boss.maxHp*100)+'%';$('#boss-hp').textContent=Math.ceil(game.boss.hp)+' / '+game.boss.maxHp;}
  if(lastBoost!==game.boosting){lastBoost=game.boosting;sound.setBoost(lastBoost);}
}
function recruit(count){
  if(phase!=='menu'||!$('#summon-overlay').hidden)return;
  const result=pull(profile,count);if(!result.ok){toast(result.message);return;}
  profile=result.profile;draws=result.draws;save();refreshProfile();
  drawHistory=[...draws.map(d=>({id:d.id,duplicate:d.duplicate,guarantee:d.guarantee})).reverse(),...drawHistory].slice(0,50);storage.set('starfall.history',drawHistory);
  $('#summon-overlay').hidden=false;$('#summon-stage').hidden=false;$('#summon-results').hidden=true;
  $('#summon-overlay').dataset.rarity=draws.some(d=>d.rarity==='SSR')?'SSR':draws.some(d=>d.rarity==='SR')?'SR':'R';
  sound.unlock().then(()=>sound.play('level',draws.some(d=>d.rarity==='SSR')?5:2));
  $('#skip-summon').focus();clearTimeout(summonTimer);summonTimer=setTimeout(revealDraws,matchMedia('(prefers-reduced-motion: reduce)').matches?100:1900);
}
function revealDraws(){
  clearTimeout(summonTimer);$('#summon-stage').hidden=true;$('#summon-results').hidden=false;
  $('#draw-cards').innerHTML=draws.map((d,i)=>'<article class="draw-card" data-rarity="'+d.rarity+'" style="--delay:'+i*.06+'s"><div class="portrait" style="'+portraitStyle(d.character)+'"></div><span class="rarity" data-rarity="'+d.rarity+'">'+d.rarity+'</span><div class="draw-name">'+d.character.name+'<small>'+d.character.title+'</small></div><div class="draw-status">'+(!d.duplicate?'<b>NEW / 已唤醒</b>':d.resonanceGain?'共鸣 +'+d.resonanceGain+' · 芯片 +'+d.materials:'重复回响 · 芯片 +'+d.materials)+'</div>'+(d.guarantee?'<span class="guarantee-label">保底生效</span>':'')+'</article>').join('');
  $('#draw-close').focus({preventScroll:true});
}
function closeDraws(){clearTimeout(summonTimer);$('#summon-overlay').hidden=true;$('#pull-one').focus({preventScroll:true});}
function rates(){showModal('rates',{eyebrow:'SIGNAL PROTOCOL / 寻访规则',title:'每一次信号，<br><span>都有清晰的回响。</span>',content:'<p>基础概率：<b>SSR 3% · SR 17% · R 80%</b>。同稀有度两名驾驶员等概率获得。</p><p>'+GACHA_RULES.description+'</p><p>每次寻访消耗 160 星晶，十次 1,600 星晶。新档案获得 3,200 星晶与 200 共鸣芯片。每局探索结算可获得更多；游戏没有付费入口。</p><p>重复角色每两份升一阶共鸣（最多五阶）；重复 R / SR / SSR 额外返还共鸣芯片。同步率最高 20 级；养成与共鸣会直接提升生命、攻击、防御等数值。</p><p>数据保存在当前浏览器。建议在固定浏览器中游玩，清理站点数据会清除进度。</p>',actions:[{label:'了解规则',primary:true,run:hideModal}]});}
function history(){showModal('history',{eyebrow:'RESONANCE LOG / 最近 50 次寻访',title:'每一次重逢。',content:drawHistory.length?drawHistory.map(d=>{const c=character(d.id);return '<div class="history-row"><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><b>'+c.name+'</b><span>'+(d.duplicate?'重复回响':'首次唤醒')+(d.guarantee?' · 保底':'')+'</span></div>';}).join(''):'<p>还没有收到新的信号。完成寻访后，记录会出现在这里。</p>',actions:[{label:'返回寻访',primary:true,run:hideModal}]});}
function skill(){if(phase!=='playing')return;if(!game.useSkill())toast('技能冷却中：'+Math.ceil(game.skillRemaining)+' 秒');}
function cycleCamera(){if(!arena)return;$('#camera').textContent='C · '+arena.cycleCamera()+'视角';toast('视角已切换 · 方向键仍沿世界坐标');}
function setSoundUI(){const b=$('#sound');b.querySelector('use').setAttribute('href',muted?'#i-mute':'#i-sound');b.setAttribute('aria-label',muted?'开启声音':'静音');b.setAttribute('aria-pressed',String(muted));}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('请使用浏览器菜单进入全屏');}catch{toast('全屏未能开启，请使用浏览器菜单');}}
function frame(now){
  const dt=Math.min(lastTime?(now-lastTime)/1000:.016,.1);lastTime=now;
  if(phase==='countdown'){countdownTime+=dt;if(countdownTime>=.85){countdownTime-=.85;countdown--;if(countdown>0){$('#countdown b').textContent=countdown;sound.play('countdown',countdown);}else{phase='playing';runStarted=true;$('#countdown').hidden=true;game.start();sound.setPlaying(true);}}}
  if(phase==='playing')game.update(dt);
  hudClock+=dt;if(hudClock>.07){hudClock=0;updateHud();}
  if(arena){try{arena.render(dt,game);}catch(e){console.error(e);pause();toast('图形场景遇到错误，请刷新后重新进入。');return;}}
  requestAnimationFrame(frame);
}
try{
  game=new SnakeGame({onEvent});arena=new Arena($('#world'),{onFailure:message=>{pause();toast(message);}});
  arena.setQuality(storage.get('starfall.lowQuality',false));$('#quality').textContent=arena.low?'光影：流畅':'光影：精致';
  refreshProfile();setSoundUI();requestAnimationFrame(frame);$('#loading').hidden=true;
  if(saveWarning)toast('浏览器不支持本地存档，进度只在当前页面有效。');
}catch(e){console.error('Initialization failed',e);$('#loading').innerHTML='<h2>图形引擎未能启动</h2><p>请使用支持 WebGL 2 的浏览器并开启硬件加速。</p><button class="primary" onclick="location.reload()">重新连接</button>';$('#start').disabled=true;}

$('#start').addEventListener('click',start);$('#help').addEventListener('click',help);$('#story').addEventListener('click',showStory);
$('#brand').addEventListener('click',()=>{if(phase==='menu')showScreen('lobby');else if(phase==='results')goHome();else pause();});
$('#change-pilot').addEventListener('click',()=>{inspectId=profile.selected;showScreen('roster');});
$$('[data-screen]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
$$('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.difficulty;storage.set('starfall.difficulty',difficulty);refreshProfile();sound.play('ui');}));
$('#character-grid').addEventListener('click',e=>{const b=e.target.closest('[data-character]');if(b){inspectId=b.dataset.character;renderRoster();sound.play('ui');}});
$('#character-detail').addEventListener('click',e=>{
  const deploy=e.target.closest('[data-deploy]'),level=e.target.closest('[data-level]');
  if(deploy){if(applyProfile(selectCharacter(profile,deploy.dataset.deploy)))toast(character(profile.selected).name+'已建立神经链接');}
  if(level){const result=levelUp(profile,level.dataset.level);if(applyProfile(result)){sound.play('level',result.level);toast('同步率提升至 Lv.'+result.level+' · 战斗属性已增强');}}
  if(e.target.closest('[data-recruit]'))showScreen('gacha');
});
$('#pull-one').addEventListener('click',()=>recruit(1));$('#pull-ten').addEventListener('click',()=>recruit(10));$('#rates').addEventListener('click',rates);$('#history').addEventListener('click',history);
$('#skip-summon').addEventListener('click',revealDraws);$('#draw-close').addEventListener('click',closeDraws);$('#draw-roster').addEventListener('click',()=>{closeDraws();inspectId=draws.find(d=>!d.duplicate)?.id||draws[0]?.id||profile.selected;showScreen('roster');});
$('#upgrade-cards').addEventListener('click',e=>{const b=e.target.closest('[data-upgrade]');if(b)choose(b.dataset.upgrade);});
$('#pause').addEventListener('click',()=>pause());$('#skill').addEventListener('click',skill);$('#camera').addEventListener('click',cycleCamera);$('#fullscreen').addEventListener('click',fullscreen);
$('#modal-close').addEventListener('click',()=>{hideModal();if(phase==='paused')resume();});
$('#sound').addEventListener('click',async()=>{muted=!muted;if(!muted)await sound.unlock();sound.setMuted(muted);storage.set('starfall.muted',muted);setSoundUI();});
$('#quality').addEventListener('click',()=>{if(!arena)return;arena.setQuality(!arena.low);storage.set('starfall.lowQuality',arena.low);$('#quality').textContent=arena.low?'光影：流畅':'光影：精致';toast(arena.low?'流畅模式 · 保留空间辅助标记':'精致模式 · 实体阴影与局部光效');});
function trapFocus(e,container){const all=[...container.querySelectorAll('button:not(:disabled):not([hidden]),summary')].filter(b=>b.offsetParent!==null);const first=all[0],last=all.at(-1);if(!first)return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(),interactive=e.target.closest?.('button,a,input,select,textarea,summary');
  if(e.repeat&&(k==='enter'||e.code==='Space')){e.preventDefault();return;}
  if(!$('#summon-overlay').hidden){if(k==='tab')trapFocus(e,$('#summon-overlay'));if(k==='escape'){e.preventDefault();if(!$('#summon-stage').hidden)revealDraws();else closeDraws();}return;}
  if(!$('#modal').hidden){if(k==='tab'){trapFocus(e,$('#modal'));return;}if(k==='escape'&&modalType!=='result'){e.preventDefault();hideModal();if(phase==='paused')resume();}return;}
  if(phase==='choosing'){if(k==='tab')trapFocus(e,$('#upgrade-overlay'));if(['1','2','3'].includes(k)){e.preventDefault();const u=game.choices[Number(k)-1];if(u)choose(u.id);}if(k==='escape')pause();return;}
  if(e.repeat&&['enter','m','f','c','escape','p'].includes(k))return;
  if(k==='m'){$('#sound').click();return;}
  if(k==='escape'||k==='p'){e.preventDefault();if(phase==='paused')resume();else pause();return;}
  if(k==='enter'&&!interactive&&phase==='menu'){e.preventDefault();start();return;}
  if(phase!=='playing')return;
  if(k==='c'){cycleCamera();return;}if(k==='f'){e.preventDefault();skill();return;}
  const mapping={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right',q:'rise',e:'fall'};
  if(mapping[k]){e.preventDefault();if(!e.repeat)game.turn(mapping[k]);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)game.setBoost(true);}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')game?.setBoost(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTime=0;});
window.addEventListener('blur',()=>pause());
window.addEventListener('pagehide',e=>{if(e.persisted)pause();else sound.dispose();});
$$('[data-turn]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();if(phase==='playing')game.turn(b.dataset.turn);}));
$('#touch-phase').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);if(phase==='playing')game.setBoost(true);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#touch-phase').addEventListener(event,()=>game?.setBoost(false));
let drag=null,swipe=null;
$('#world').addEventListener('contextmenu',e=>e.preventDefault());
$('#world').addEventListener('pointerdown',e=>{if(e.button===2||e.altKey){drag={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}else if(e.pointerType==='touch'){swipe={x:e.clientX,y:e.clientY};}});
$('#world').addEventListener('pointermove',e=>{if(drag&&arena){arena.orbit(e.clientX-drag.x,e.clientY-drag.y);drag={x:e.clientX,y:e.clientY};$('#camera').textContent='C · 自由视角';}else if(swipe&&phase==='playing'){const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))>28){game.turn(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');swipe={x:e.clientX,y:e.clientY};}}});
for(const event of ['pointerup','pointercancel'])window.addEventListener(event,()=>{drag=null;swipe=null;});


