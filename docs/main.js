import { SnakeGame, WORLD, MISSIONS, UPGRADES } from './engine.js?v=3.0';
import { Arena } from './scene.js?v=3.0';
import { SoundEngine } from './audio.js?v=3.0';
import { CHARACTERS, GACHA_RULES, GACHA_COST, MAX_LEVEL, SUPPORT_BONUSES, MISSION_REWARDS, createProfile, sanitizeProfile, getStats, getSquadStats, pull, selectCharacter, setSquadSlot, getMissionAccess, levelUp, upgradeCost, settleRun } from './meta.js?v=3.0';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const two = n => String(Math.floor(n)).padStart(2,'0');
const num = n => Math.round(Number(n)||0).toLocaleString('en-US');
const time = n => two(n/60)+':'+two(n%60);
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='starfall.profile.v2'; // Keep the V2 storage key for in-place migration.
const storage={get(name,fallback){try{const raw=localStorage.getItem(name);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}},set(name,value){try{localStorage.setItem(name,JSON.stringify(value));return true;}catch{return false;}}};
let profile;try{const raw=localStorage.getItem(key);profile=raw===null?createProfile():sanitizeProfile(JSON.parse(raw));}catch{profile=sanitizeProfile({});}
let saveWarning=!storage.set(key,profile);
let difficulty=storage.get('starfall.difficulty','normal');if(!['chill','normal','hard'].includes(difficulty))difficulty='normal';
let muted=storage.get('starfall.muted',false),phase='menu',screen='lobby',inspectId=profile.selected;
let missionId=profile.unlockedMissions.at(-1)||'m1',secretaryId=storage.get('starfall.secretary','iris');
let arena,game,runPilot,runId='',settled=false,starting=false,previousPhase='playing',runStarted=false;
let countdown=3,countdownTime=0,lastTime=0,hudClock=0,toastTimer,calloutTimer,summonTimer,modalType='',returnFocus=null,draws=[];
let drawHistory=storage.get('starfall.history',[]);if(!Array.isArray(drawHistory))drawHistory=[];drawHistory=drawHistory.filter(d=>d&&CHARACTERS.some(c=>c.id===d.id)).slice(0,50);
const keys=new Set(),touchPointers=new Map();
const sound=new SoundEngine();sound.setMuted(muted);
const character=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[4];
const mission=id=>MISSIONS.find(m=>m.id===id)||MISSIONS[0];
const typeNames={clear:'机动清剿',escort:'信标护送',capture:'据点同步',boss:'核心歼灭'};
const enemyNames={scout:'巡猎机',gunner:'远程射手',charger:'突袭机',turret:'固定炮台',boss:'归零核心'};
const portraitStyle=c=>'--px:'+((c.portraitIndex%3)*50)+'%;--py:'+(Math.floor(c.portraitIndex/3)*100)+'%;--pilot:'+c.color;
const stars=n=>'★'.repeat(n)+'☆'.repeat(3-n);
function setPortrait(el,c){el.style.setProperty('--px',((c.portraitIndex%3)*50)+'%');el.style.setProperty('--py',(Math.floor(c.portraitIndex/3)*100)+'%');el.setAttribute('aria-label',c.name+'立绘');}
function save(){if(!storage.set(key,profile)){saveWarning=true;toast('浏览器未允许保存，当前进度仅在此页面有效。');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function callout(title,subtitle=''){const el=$('#callout');el.replaceChildren();const b=document.createElement('b');b.textContent=title;el.append(b);const small=document.createElement('small');small.textContent=subtitle;el.append(small);el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>el.classList.remove('show'),2200);}
function applyProfile(result){if(!result.ok){toast(result.message||'操作未完成');return false;}profile=result.profile;save();refreshProfile();return true;}
function refreshSecretary(){if(!profile.characters[secretaryId]?.owned)secretaryId=profile.selected;const c=character(secretaryId);setPortrait($('#lobby-portrait'),c);$('#lobby-name').textContent=c.name;$('#lobby-title').textContent=c.title;$('#lobby-quote').textContent='「'+c.quote+'」';$('#lobby-rarity').textContent=c.rarity;$('#lobby-rarity').dataset.rarity=c.rarity;}
function refreshProfile(){
  $('#crystals').textContent=num(profile.crystals);$('#materials').textContent=num(profile.materials);refreshSecretary();
  const cleared=Object.values(profile.stageRecords).filter(r=>r.clears>0).length,next=mission(profile.unlockedMissions.at(-1));
  $('#home-progress').textContent=cleared+' / 4';$('#home-mission').textContent=next.code+' — '+next.name;$('#owned-count').textContent=two(CHARACTERS.filter(c=>profile.characters[c.id].owned).length);
  $('#ssr-pity').textContent=profile.gacha.pitySSR+' / '+GACHA_RULES.ssrPity;$('#pity-bar').style.width=(profile.gacha.pitySSR/GACHA_RULES.ssrPity*100)+'%';
  $('#rare-pity').textContent='最多 '+(GACHA_RULES.rarePity-profile.gacha.pitySR)+' 次获得 SR 或以上 · SSR 最多 '+(GACHA_RULES.ssrPity-profile.gacha.pitySSR)+' 次';
  $('#pull-one').disabled=profile.crystals<GACHA_COST;$('#pull-ten').disabled=profile.crystals<GACHA_COST*10;
  if(phase==='menu')arena?.setCharacter(character(profile.selected));
  if(screen==='campaign')renderCampaign();if(screen==='squad')renderSquad();if(screen==='roster')renderRoster();
}
function showScreen(name){
  if(phase!=='menu'||!['lobby','campaign','squad','roster','gacha'].includes(name))return;
  screen=name;$$('.screen').forEach(el=>el.hidden=el.id!==name);$$('.bottom-nav [data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===name);b.setAttribute('aria-current',b.dataset.screen===name?'page':'false');});
  const labels={lobby:['ARK 07','方舟主控'],campaign:['OPERATION','主线作战'],squad:['FORMATION','共鸣编队'],roster:['PERSONNEL','驾驶员档案'],gacha:['RECRUITMENT','回响寻访']};
  $('#screen-code').textContent=labels[name][0];$('#screen-name').textContent=labels[name][1];document.body.dataset.screen=name;
  if(name==='campaign')renderCampaign();if(name==='squad')renderSquad();if(name==='roster')renderRoster();sound.play('ui');
}
function renderCampaign(){
  $('#campaign-progress').textContent=Object.values(profile.stageRecords).filter(r=>r.clears>0).length+' / 4 CLEARED';
  $('#mission-nodes').innerHTML=MISSIONS.map(m=>{const access=getMissionAccess(profile,m.id),record=profile.stageRecords[m.id];return '<button class="mission-node '+(missionId===m.id?'active ':'')+(record.clears?'complete':'')+'" data-mission="'+m.id+'" data-locked="'+!access+'" aria-pressed="'+(missionId===m.id)+'"><span class="node-code">'+m.code+'</span><span class="node-type">'+typeNames[m.type]+'</span><b>'+m.name+'</b><small>'+(access?stars(record.bestStars):'通关上一作战后解锁')+'</small><i>'+(access?'◆':'◇')+'</i></button>';}).join('');
  const m=mission(missionId),record=profile.stageRecords[m.id],reward=MISSION_REWARDS[m.id],access=getMissionAccess(profile,m.id);
  $('#mission-detail').innerHTML='<div class="mission-code">OP / '+m.code+' <span>'+typeNames[m.type]+'</span></div><h2>'+m.name+'</h2><p class="mission-briefing">'+m.description+'</p><div class="mission-stars">'+stars(record.bestStars)+'<small>'+(record.clears?'完成 '+record.clears+' 次 · 最快 '+time(record.bestTime):'尚未完成作战')+'</small></div><div class="mission-type"><b>作战目标</b><p>'+m.briefing+'</p></div><div class="mission-enemies"><small>敌方情报</small><p>'+m.enemyTypes.map(t=>'<span>'+enemyNames[t]+'</span>').join('')+'</p></div><div class="mission-rewards"><small>通关补给</small><b>✦ '+reward.crystals+' <span>▱ '+reward.materials+'</span></b><p>'+(record.firstClearClaimed?'首通补给已领取':'首次通关额外 ✦ '+reward.firstClear)+'</p></div><p class="mission-recommendation">'+m.recommendation+'</p><div class="difficulty"><span>作战强度</span>'+[['chill','观测'],['normal','标准'],['hard','侵蚀']].map(([id,label])=>'<button data-difficulty="'+id+'" class="'+(difficulty===id?'active':'')+'" aria-pressed="'+(difficulty===id)+'">'+label+'</button>').join('')+'</div><div class="deploy-actions"><button class="outline-button" data-screen="squad">编队</button><button id="deploy-mission" class="primary" '+(!access?'disabled':'')+'>'+(access?'行动开始 →':'作战尚未解锁')+'</button></div><small class="rating-rule">三星：完成目标 / 剩余生命 ≥50% / '+reward.targetTime+' 秒内完成</small>';
}
function renderSquad(){
  $('#squad-slots').innerHTML=profile.squad.map((id,i)=>{const c=id?character(id):null,entry=id?profile.characters[id]:null;return '<button class="squad-slot '+(!c?'empty':'')+'" data-slot="'+i+'"><div class="slot-header"><span>0'+(i+1)+'</span><b>'+(i===0?'主驾驶员':'支援驾驶员')+'</b><small>EDIT ↗</small></div>'+(c?'<div class="fullbody" style="'+portraitStyle(c)+'"></div><div class="slot-caption"><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><h2>'+c.name+' <small>Lv.'+entry.level+'</small></h2><p>'+(i===0?c.skillName:SUPPORT_BONUSES[id].name)+'</p><small>'+(i===0?'直接操纵 · 主动技能 F':SUPPORT_BONUSES[id].description)+'</small></div>':'<div class="empty-slot"><b>＋</b><p>配置支援</p><small>为空时不提供支援加成</small></div>')+'</button>';}).join('');
  const s=getSquadStats(profile);$('#squad-summary').innerHTML='<small>编队最终属性</small><div>'+[['攻击',Math.round(s.attack)],['生命',Math.round(s.maxHp)],['防御',s.defense],['暴击',Math.round(s.crit*100)+'%']].map(([label,value])=>'<span class="mini-stat">'+label+'<b>'+value+'</b></span>').join('')+'</div>';
}
function editSlot(slot){
  const supportText={nova:'热熵增幅：8秒攻击提升35%',aegis:'棱晶屏障：补充护盾',echo:'时序干扰：短暂冻结',lyra:'电弧齐射：连续打击',rook:'战地重整：恢复20%生命',iris:'回收信标：吸附增强、闪避充满'};
  showModal('squad',{eyebrow:'FORMATION / 配置驾驶员',title:slot===0?'选择主驾驶员':'选择支援驾驶员',content:'<p>已在编队中的驾驶员会与此位置互换。</p><div class="squad-picker">'+CHARACTERS.filter(c=>profile.characters[c.id].owned).map(c=>'<button class="character-option" data-pick-slot="'+slot+'" data-pick-id="'+c.id+'"><div class="portrait" style="'+portraitStyle(c)+'"></div><div><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><b>'+c.name+' <small>Lv.'+profile.characters[c.id].level+'</small></b><p>'+(slot===0?c.skillDescription:SUPPORT_BONUSES[c.id].description)+'</p><small>'+(slot===0?c.passiveName:supportText[c.id])+'</small></div><span>'+(profile.squad[slot]===c.id?'当前':'选择 →')+'</span></button>').join('')+'</div>',actions:slot===0?[{label:'返回',run:hideModal}]:[{label:'卸下当前支援',run:()=>{if(applyProfile(setSquadSlot(profile,slot,null)))hideModal();}}],wide:true});
}
function renderRoster(){
  $('#character-grid').innerHTML=CHARACTERS.map(c=>{const entry=profile.characters[c.id];return '<button class="character-card '+(inspectId===c.id?'selected ':'')+(!entry.owned?'locked':'')+'" data-character="'+c.id+'" data-rarity="'+c.rarity+'" aria-pressed="'+(inspectId===c.id)+'"><div class="portrait" style="'+portraitStyle(c)+'"></div><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><div class="card-meta"><b>'+c.name+'</b><small>'+(entry.owned?'Lv.'+entry.level+' · 共鸣 '+entry.resonance:'档案未唤醒')+'</small></div></button>';}).join('');
  const c=character(inspectId),entry=profile.characters[c.id],stats=getStats(profile,c.id),cost=upgradeCost(entry.level);
  const statEntries=[['攻击',stats.attack],['生命',stats.maxHp],['防御',stats.defense],['暴击',Math.round(stats.crit*100)+'%'],['暴伤',Math.round(stats.critDamage*100)+'%'],['初始护盾',stats.shield],['技能冷却',stats.skillCooldown+'s'],['吸附范围',(stats.pickupRadius+1.3).toFixed(1)+'m']];
  $('#character-detail').innerHTML='<div class="detail-heading"><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+' / '+c.element+'</span><h2>'+c.name+'<small>'+c.title+'</small></h2><p>「'+c.quote+'」</p></div><p class="detail-copy">'+c.description+'</p><div class="resonance"><span>同步率 <b>Lv.'+entry.level+'</b> / '+MAX_LEVEL+'</span><span>共鸣 '+Array.from({length:5},(_,i)=>i<entry.resonance?'◆':'◇').join('')+'</span></div><div class="detail-stats">'+statEntries.map(([label,value])=>'<div class="stat-cell"><span>'+label+'</span><b>'+value+'</b></div>').join('')+'</div><div class="detail-skill"><small>主动技能 / F</small><h3>'+c.skillName+'</h3><p>'+c.skillDescription+'</p><small>支援被动 / '+SUPPORT_BONUSES[c.id].name+'</small><p>'+SUPPORT_BONUSES[c.id].description+'</p></div><details class="detail-story"><summary>记忆档案 / '+c.passiveName+'</summary><p>'+c.story+'</p></details><div class="detail-actions">'+(entry.owned?'<button class="primary" data-deploy="'+c.id+'" '+(profile.selected===c.id?'disabled':'')+'>'+(profile.selected===c.id?'当前主驾驶员':'任命为主驾驶员')+'</button><button class="outline-button" data-level="'+c.id+'" '+(entry.level>=MAX_LEVEL||profile.materials<cost?'disabled':'')+'>'+(entry.level>=MAX_LEVEL?'同步率已满':'同步培养 <small>▱ '+cost+'</small>')+'</button>':'<button class="primary" data-screen="gacha">回响寻访 →</button>')+'</div>';
}
function hideModal(){const old=returnFocus;$('#modal').hidden=true;modalType='';if(old?.isConnected&&old.offsetParent!==null)old.focus({preventScroll:true});}
function showModal(type,{eyebrow='',title='',content='',actions=[],close=true,wide=false}){
  if($('#modal').hidden)returnFocus=document.activeElement;modalType=type;$('#modal-eyebrow').textContent=eyebrow;$('#modal-title').innerHTML=title;$('#modal-content').innerHTML=content;$('.modal-card').classList.toggle('wide',wide);$('#modal-actions').replaceChildren();
  actions.forEach(a=>{const b=document.createElement('button');b.className=a.primary?'primary':'outline-button';b.textContent=a.label;b.addEventListener('click',a.run);$('#modal-actions').append(b);});$('#modal-close').hidden=!close;$('#modal').hidden=false;($('#modal-actions button')||$('#modal-close')).focus({preventScroll:true});
}
function showStory(){showModal('story',{eyebrow:'ARK ARCHIVE / 序章',title:'群星失声之日',content:'<div class="lore-section"><p>第七次坍缩之后，城市沉入星骸，夜空再没有一颗星。方舟 07 的接收机，却在三百年后听见了一声：「有人吗？」</p><h3>最后的链接者</h3><p>你通过驾驶员的意识回响，操纵「衔尾」浮游作战机。在遗迹的作战平面上，以主机与四枚僚翼组成编队，夺回被异构体占据的旧世界。你带回的不只是资源，也是某个人未能寄出的告别。</p><h3>归途的四段信号</h3><p>从破晓码头的封锁线，到失落航线上的坐标信标；从裂隙中枢的三座锚点，到寂星之心的归零核心。每一场作战，都会让那声呼唤更清晰。</p><h3>群星，也曾是人</h3><p>星烬在寻找信号另一端的名字；白曜在找回缺失的七分钟；雾凛想让停滞的时钟继续走。你能否带着所有人的回响，走到黎明？</p></div>',actions:[{label:'返回终端',primary:true,run:hideModal}],wide:true});}
function help(){
  if(['playing','countdown','choosing'].includes(phase))pause(false);
  showModal('help',{eyebrow:'COMBAT MANUAL / 作战手册',title:'控制机动，决定战局。',content:'<div class="guide-grid"><p><kbd>WASD</kbd> / <kbd>方向键</kbd> 平面移动<br>松开即停，可自由掉头与斜向移动<br><kbd>SPACE</kbd> 矢量闪避：2 次储备，逐次充能<br><kbd>F</kbd> 主驾驶员技能 · <kbd>Q</kbd> 编队支援</p><p><kbd>ESC</kbd> 暂停 · <kbd>C</kbd> 切换视角<br><kbd>M</kbd> 声音开关<br>默认战术视角下，方向键与屏幕方向一致<br>手机按住方向键移动，点击底部能力使用</p></div><p>武器自动锁定射程内的敌人。掩体能阻挡双方弹丸；红色预警会在短暂蓄力后命中，闪避具有短暂无敌。僚翼只是武器编队，机体不会因拾取变长，也不会撞到自己。</p><p>敌人掉落晶体提供经验，升级暂停后选择三项技术之一。清剿需要击破全部波次；护送要靠近信标；占点需站入激活的圆环并清走区内敌人；首领有三段不同攻势。</p><p>完成作战才会解锁后续关卡与首通奖励。失败也有少量补给，15 秒内主动撤离不获得奖励。已有角色与培养自动保留。</p>',actions:[{label:phase==='paused'?'继续作战':'前往作战终端',primary:true,run:()=>{hideModal();if(phase==='paused')resume();else showScreen('campaign');}}],wide:true});
}
function records(){showModal('records',{eyebrow:'OPERATION ARCHIVE / 作战记录',title:'每一步，都在接近黎明。',content:'<div class="result-summary"><span>总作战<b>'+num(profile.totalRuns)+'</b></span><span>胜利<b>'+num(profile.wins)+'</b></span><span>累计击破<b>'+num(profile.totalKills)+'</b></span></div>'+MISSIONS.map(m=>{const r=profile.stageRecords[m.id];return '<div class="history-row"><b>'+m.code+' / '+m.name+'</b><span>'+stars(r.bestStars)+'</span><span>'+(r.clears?'通关 '+r.clears+' 次 · '+time(r.bestTime):'尚未通关')+'</span></div>';}).join('')+'<p>最高作战评分 '+num(profile.bestScore)+'。旧版总记录会保留；新版章节记录独立计算。</p>',actions:[{label:'返回方舟',primary:true,run:hideModal}]});}
function settings(){showModal('settings',{eyebrow:'SYSTEM / 系统设置',title:'方舟系统',content:'<div class="settings-list"><button class="outline-button" data-setting="sound">声音：'+(muted?'关闭':'开启')+'</button><button class="outline-button" data-setting="quality">光影：'+(arena?.low?'流畅':'精致')+'</button><button class="outline-button" data-setting="fullscreen">切换全屏</button><button class="outline-button" data-setting="export">导出当前存档</button></div><p>存档保存在当前浏览器。旧版角色、星晶、培养与寻访计数已迁移；导出的文件可用于个人备份。</p>',actions:[{label:'完成',primary:true,run:hideModal}]});}
function exportSave(){const blob=new Blob([JSON.stringify({game:'星骸回响',exportedAt:new Date().toISOString(),profile,drawHistory},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='starfall-save-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('存档备份已导出');}
function clearInput(){keys.clear();touchPointers.clear();game?.setMove(0,0);$$('[data-move]').forEach(b=>b.classList.remove('pressed'));}
function syncMove(){if(phase!=='playing'){game?.setMove(0,0);return;}const dirs=new Set([...keys].map(k=>movement[k]).concat([...touchPointers.values()]));game.setMove(Number(dirs.has('right'))-Number(dirs.has('left')),Number(dirs.has('down'))-Number(dirs.has('up')));}
async function start(){
  if(starting||!arena)return;if(!getMissionAccess(profile,missionId)){toast('请先完成前一关作战');return;}starting=true;
  if(['playing','paused','choosing'].includes(phase)&&runId&&!settled)settleCurrent(false,true);
  hideModal();$('#upgrade-overlay').hidden=true;phase='starting';clearInput();try{await sound.unlock();}catch{}starting=false;
  runPilot=character(profile.selected);runId=crypto.randomUUID?crypto.randomUUID():'run-'+Date.now()+'-'+Math.random().toString(36).slice(2);settled=false;runStarted=false;
  game.reset({character:runPilot,stats:getSquadStats(profile),difficulty,mission:missionId,supportIds:profile.squad.slice(1).filter(Boolean)});
  arena.setCharacter(runPilot);arena.setMission?.(game.mission);arena.setMenu(false);document.body.classList.add('in-game');phase='countdown';countdown=3;countdownTime=0;
  $('#countdown').hidden=false;$('#countdown b').textContent='3';setPortrait($('#hud-portrait'),runPilot);$('#hud-name').textContent=runPilot.name;$('#skill-name').textContent=runPilot.skillName;
  sound.setPlaying(false);sound.setBoost(false);sound.play('countdown',3);updateHud();$('#world').focus({preventScroll:true});if(document.hidden)pause();
}
function pause(show=true){if(!['playing','countdown','choosing'].includes(phase))return;previousPhase=phase;phase='paused';game.pause();clearInput();sound.setPlaying(false);sound.setBoost(false);$('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;if(show)pauseModal();}
function pauseModal(){showModal('pause',{eyebrow:'TACTICAL PAUSE / 战术暂停',title:'信号仍在。',content:'<p>「'+(runPilot?.quote||'准备好了，就出发。')+'」</p><p>'+game.mission.name+' · 作战 '+time(game.elapsed)+' · '+escapeHTML(game.objectiveText)+'</p>',actions:[{label:'继续行动 →',primary:true,run:resume},{label:'撤离并结算',run:()=>finish(false,true)}]});}
function resume(){if(phase!=='paused')return;hideModal();phase=previousPhase;clearInput();if(phase==='choosing'){showUpgrades();return;}if(phase==='countdown')$('#countdown').hidden=false;else{game.resume();sound.setPlaying(true);}sound.unlock().then(()=>{if(phase==='playing')sound.setPlaying(true);});$('#world').focus({preventScroll:true});}
function settleCurrent(won,evacuated=false){
  if(settled||!runId)return{crystals:0,materials:0,stars:0};if(!runStarted){settled=true;return{crystals:0,materials:0,stars:0,cancelled:true};}
  const result=settleRun(profile,{runId,missionId:game.missionId,score:game.score,kills:game.kills,elapsed:game.elapsed,hpRatio:game.hp/game.maxHp,damageTaken:game.damageTaken,won,evacuated});
  if(result.ok){profile=result.profile;settled=true;save();return{...result.rewards,cancelled:evacuated&&game.elapsed<15};}if(result.error==='ALREADY_SETTLED')settled=true;return{crystals:0,materials:0,stars:0};
}
function finish(won=false,evacuated=false){
  if(phase==='results')return;game.pause();phase='results';clearInput();sound.setPlaying(false);sound.setBoost(false);$('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;
  const reward=settleCurrent(won,evacuated);refreshProfile();const next=reward.unlockedMission;
  showModal('result',{eyebrow:won?'MISSION COMPLETE / 作战完成':evacuated?'EXTRACTION / 已撤离':'LINK RECOVERED / 作战结束',title:won?game.mission.name+' · 作战成功':'回到方舟，再次出发。',content:'<div class="mission-stars result-stars">'+stars(reward.stars||0)+'</div><p>'+(reward.cancelled?'尚未开战，或主动撤离时作战不足 15 秒，本次无补给。':won?escapeHTML(game.reason||'作战目标完成，已回收当前区域的记忆信号。'):evacuated?'已保存本次获得的补给。':escapeHTML(game.reason||'机体已由方舟回收。'))+'</p><div class="result-summary"><span>作战评分<b>'+num(game.score)+'</b></span><span>击破敌机<b>'+game.kills+'</b></span><span>作战时间<b>'+time(game.elapsed)+'</b></span></div><div class="reward-row"><span>✦ 星晶 <b>+'+num(reward.crystals)+'</b></span><span>▱ 芯片 <b>+'+num(reward.materials)+'</b></span></div><p>'+(reward.firstClear?'首次通关补给已计入。 ':'')+(next?'新作战已解锁：'+mission(next).name:'')+'</p><div class="run-build">'+Object.entries(countBuild()).map(([id,n])=>'<span>'+UPGRADES.find(u=>u.id===id)?.name+' ×'+n+'</span>').join('')+'</div>',actions:[{label:next?'前往下一作战 →':'再次行动',primary:true,run:()=>{if(next){missionId=next;goHome('campaign');}else start();}},{label:'返回作战终端',run:()=>goHome('campaign')}],close:false,wide:true});
}
function goHome(destination='lobby'){hideModal();phase='menu';clearInput();document.body.classList.remove('in-game');$('#countdown').hidden=true;$('#upgrade-overlay').hidden=true;arena?.setMenu(true);sound.setPlaying(false);sound.setBoost(false);refreshProfile();showScreen(destination);$('#brand').focus({preventScroll:true});}
function countBuild(){const counts={};for(const id of game.build)counts[id]=(counts[id]||0)+1;return counts;}
function showBuild(){if(['playing','countdown','choosing'].includes(phase))pause(false);showModal('build',{eyebrow:'CURRENT BUILD / 本局构筑',title:'异构技术档案',content:'<div class="detail-stats">'+[['攻击',Math.round(game.stats.attack)],['暴击',Math.round(game.stats.crit*100)+'%'],['防御',game.stats.defense],['射程',game.attackRange+'m']].map(([k,v])=>'<div class="stat-cell"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div>'+Object.entries(countBuild()).map(([id,n])=>{const u=UPGRADES.find(u=>u.id===id);return '<div class="build-item"><b>'+u.icon+' '+u.name+' ×'+n+'</b><p>'+u.description+'</p></div>';}).join('')+(game.build.length?'':'<p>击破敌人并回收晶体，升级后选择异构技术。</p>'),actions:[{label:'继续行动',primary:true,run:()=>{hideModal();resume();}}]});}
function showUpgrades(){phase='choosing';clearInput();sound.setPlaying(false);$('#upgrade-overlay').hidden=false;$('#upgrade-cards').innerHTML=game.choices.map((u,i)=>'<button class="upgrade-card" data-upgrade="'+u.id+'" data-rarity="'+u.rarity+'"><div class="upgrade-tag">'+u.tag+' / '+u.rarity+'<kbd>'+(i+1)+'</kbd></div><div class="upgrade-icon">'+u.icon+'</div><h3>'+u.name+'</h3><p>'+u.description+'</p><div class="upgrade-stack">当前 '+game.build.filter(id=>id===u.id).length+' / '+u.maxStacks+' 层<span>装备技术 →</span></div></button>').join('');$('#upgrade-cards button')?.focus({preventScroll:true});}
function choose(id){if(phase!=='choosing'||!game.chooseUpgrade(id))return;if(game.status==='choosing'){showUpgrades();return;}$('#upgrade-overlay').hidden=true;phase='playing';sound.setPlaying(true);sound.unlock();updateHud();$('#world').focus({preventScroll:true});}
function onEvent(name,data){
  if(['eat','damage','kill','skill','won','dash','support','impact','hit'].includes(name))arena?.effect(name,data);
  if(name==='eat')sound.play(data.type==='gold'?'golden':'eat',1);
  else if(name==='damage'){sound.play('pause');$('#damage-flash').classList.add('hit');setTimeout(()=>$('#damage-flash').classList.remove('hit'),180);}
  else if(name==='level'&&!['won','dead'].includes(game.status)){sound.play('level',game.level);showUpgrades();}
  else if(name==='upgrade')callout(UPGRADES.find(u=>u.id===data.id)?.name||'技术接入','本局强化已生效');
  else if(name==='skill'){sound.play('golden',3);if(!['results','choosing'].includes(phase))callout(runPilot?.skillName||'技能释放',runPilot?.quote||'');}
  else if(name==='support'){sound.play('golden',2);if(!['results','choosing'].includes(phase))callout('共鸣支援',game.supportIds.map(id=>character(id).name).join(' × '));}
  else if(name==='wave'&&phase==='playing')callout(data.name||'增援抵达',game.objectiveText);
  else if(name==='boss'){sound.play('level',4);if(phase==='playing')callout('归零协议 · 阶段 '+data.phase,'留意地面预警与弹幕间隙');}
  else if(name==='death'){sound.play('death');finish(false);}
  else if(name==='won'){sound.play('level',5);finish(true);}
  else if(name==='dash')sound.play('boost');else if(name==='start')sound.play('start');
}
function updateHud(){
  if(!game)return;$('#hp-text').textContent=Math.ceil(game.hp)+' / '+Math.ceil(game.maxHp);$('#hp-bar').style.width=Math.max(0,game.hp/game.maxHp*100)+'%';$('#shield').textContent=Math.ceil(game.shield);$('#invulnerable').textContent=game.invulnerable>0?' / 保护中':'';
  $('#score').textContent=String(game.score).padStart(6,'0');$('#kills').textContent=two(game.kills);$('#time').textContent=time(game.elapsed);$('#level').textContent=game.level;$('#xp-text').textContent=Math.floor(game.xp)+' / '+Math.ceil(game.xpToNext);$('#xp-bar').style.width=Math.min(100,game.xp/game.xpToNext*100)+'%';
  $('#wave-code').textContent='OPERATION '+game.mission.code+' / '+typeNames[game.mission.type];$('#wave-name').textContent=game.mission.name;$('#objective').textContent=game.objectiveText;$('#objective-bar').style.width=Math.min(100,game.objectiveProgress*100)+'%';$('#build-count').textContent=game.build.length;
  $('#dash-cooldown').textContent='◆'.repeat(game.dashCharges)+'◇'.repeat(2-game.dashCharges)+(game.dashCharges<2?' '+game.dashCooldown.toFixed(1)+'s':'');$('#dash').disabled=phase!=='playing'||game.dashCharges<1;
  $('#skill-cooldown').textContent=game.skillRemaining>0?Math.ceil(game.skillRemaining)+'s':'就绪';$('#skill').disabled=phase!=='playing'||game.skillRemaining>0;
  $('#support-cooldown').textContent=game.supportIds.length?(game.supportRemaining>0?Math.ceil(game.supportRemaining)+'s':'就绪'):'未配置';$('#support').disabled=phase!=='playing'||game.supportRemaining>0||!game.supportIds.length;
  $('#boss-hud').hidden=!game.boss;if(game.boss){$('#boss-bar').style.width=Math.max(0,game.boss.hp/game.boss.maxHp*100)+'%';$('#boss-hp').textContent='PHASE '+game.boss.phase+' / '+Math.ceil(game.boss.hp);}
}
function recruit(count){
  if(phase!=='menu'||!$('#summon-overlay').hidden)return;const result=pull(profile,count);if(!result.ok){toast(result.message);return;}profile=result.profile;draws=result.draws;save();refreshProfile();
  drawHistory=[...draws.map(d=>({id:d.id,duplicate:d.duplicate,guarantee:d.guarantee})).reverse(),...drawHistory].slice(0,50);storage.set('starfall.history',drawHistory);$('#summon-overlay').hidden=false;$('#summon-stage').hidden=false;$('#summon-results').hidden=true;$('#summon-overlay').dataset.rarity=draws.some(d=>d.rarity==='SSR')?'SSR':draws.some(d=>d.rarity==='SR')?'SR':'R';sound.unlock().then(()=>sound.play('level',draws.some(d=>d.rarity==='SSR')?5:2));$('#skip-summon').focus();clearTimeout(summonTimer);summonTimer=setTimeout(revealDraws,matchMedia('(prefers-reduced-motion: reduce)').matches?100:1800);
}
function revealDraws(){clearTimeout(summonTimer);$('#summon-stage').hidden=true;$('#summon-results').hidden=false;$('#draw-cards').innerHTML=draws.map((d,i)=>'<article class="draw-card" data-rarity="'+d.rarity+'" style="--delay:'+i*.06+'s"><div class="portrait" style="'+portraitStyle(d.character)+'"></div><span class="rarity" data-rarity="'+d.rarity+'">'+d.rarity+'</span><div class="draw-name">'+d.character.name+'<small>'+d.character.title+'</small></div><div class="draw-status">'+(!d.duplicate?'<b>NEW / 已唤醒</b>':d.resonanceGain?'共鸣 +'+d.resonanceGain+' · 芯片 +'+d.materials:'重复回响 · 芯片 +'+d.materials)+'</div>'+(d.guarantee?'<span class="guarantee-label">保底生效</span>':'')+'</article>').join('');$('#draw-close').focus({preventScroll:true});}
function closeDraws(){clearTimeout(summonTimer);$('#summon-overlay').hidden=true;$('#pull-one').focus({preventScroll:true});}
function rates(){showModal('rates',{eyebrow:'RECRUITMENT RULES / 概率公开',title:'回响寻访规则',content:'<p><b>基础概率：SSR 0.8% · SR 9.2% · R 90%</b></p><p>'+GACHA_RULES.description+'</p><p>同一稀有度的两名驾驶员等概率。每次 160 星晶，十次 1,600 星晶；十连与单抽的实际规则完全相同。新档初始 1,600 星晶与 200 芯片。无付费入口。</p><p>每次通关获得 60 / 80 / 100 / 140 星晶；每关首通额外 160 星晶。失败只有少量补给，主动撤离不足 15 秒没有奖励。保底计数不会因切换页面或刷新清除。</p><p>重复角色每两份提升一阶共鸣，最多五阶；重复回响同时返还芯片。全部数据存于当前浏览器。</p>',actions:[{label:'已了解',primary:true,run:hideModal}]});}
function history(){showModal('history',{eyebrow:'RECRUITMENT HISTORY / 最近 50 次',title:'回响记录',content:drawHistory.length?drawHistory.map(d=>{const c=character(d.id);return '<div class="history-row"><span class="rarity" data-rarity="'+c.rarity+'">'+c.rarity+'</span><b>'+c.name+'</b><span>'+(d.duplicate?'重复回响':'首次唤醒')+(d.guarantee?' · 保底':'')+'</span></div>';}).join(''):'<p>接收到新回响后，记录会显示在这里。</p>',actions:[{label:'返回寻访',primary:true,run:hideModal}]});}
function skill(){if(phase==='playing')game.useSkill();}
function dash(){if(phase==='playing')game.dash();}
function support(){if(phase==='playing')game.useSupport();}
function cycleCamera(){if(!arena)return;$('#camera').textContent='C · '+arena.cycleCamera()+'视角';toast('视角已切换 · WASD 沿战场 X / Z 方向移动');}
function setSoundUI(){const b=$('#sound');b.querySelector('use').setAttribute('href',muted?'#i-mute':'#i-sound');b.setAttribute('aria-label',muted?'开启声音':'静音');b.setAttribute('aria-pressed',String(muted));}
async function toggleSound(){muted=!muted;if(!muted)await sound.unlock();sound.setMuted(muted);storage.set('starfall.muted',muted);setSoundUI();}
function toggleQuality(){if(!arena)return;arena.setQuality(!arena.low);storage.set('starfall.lowQuality',arena.low);$('#quality').textContent=arena.low?'光影：流畅':'光影：精致';}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('请使用浏览器菜单进入全屏');}catch{toast('全屏未能开启，请使用浏览器菜单');}}
function frame(now){
  const dt=Math.min(lastTime?(now-lastTime)/1000:.016,.1);lastTime=now;
  if(phase==='countdown'){countdownTime+=dt;if(countdownTime>=.85){countdownTime-=.85;countdown--;if(countdown>0){$('#countdown b').textContent=countdown;sound.play('countdown',countdown);}else{phase='playing';runStarted=true;$('#countdown').hidden=true;game.start();sound.setPlaying(true);}}}
  if(phase==='playing')game.update(dt);hudClock+=dt;if(hudClock>.07){hudClock=0;updateHud();}
  if(arena){try{arena.render(dt,game);}catch(e){console.error(e);pause();toast('图形场景遇到错误，请刷新后重新进入。');return;}}requestAnimationFrame(frame);
}
try{game=new SnakeGame({onEvent});arena=new Arena($('#world'),{onFailure:message=>{pause();toast(message);}});arena.setMenu(true);arena.setQuality(storage.get('starfall.lowQuality',false));$('#quality').textContent=arena.low?'光影：流畅':'光影：精致';refreshProfile();setSoundUI();requestAnimationFrame(frame);$('#loading').hidden=true;if(saveWarning)toast('浏览器不支持本地保存，进度只在当前页面有效。');}
catch(e){console.error('Initialization failed',e);$('#loading').innerHTML='<h2>图形引擎未能启动</h2><p>请使用支持 WebGL 2 的浏览器并开启硬件加速。</p><button class="primary" onclick="location.reload()">重新连接</button>';}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.screen){showScreen(b.dataset.screen);return;}
  if(b.dataset.mission){missionId=b.dataset.mission;renderCampaign();sound.play('ui');return;}
  if(b.dataset.difficulty){difficulty=b.dataset.difficulty;storage.set('starfall.difficulty',difficulty);renderCampaign();return;}
  if(b.id==='deploy-mission'){start();return;}
  if(b.dataset.character){inspectId=b.dataset.character;renderRoster();return;}
  if(b.dataset.deploy){if(applyProfile(selectCharacter(profile,b.dataset.deploy)))toast(character(profile.selected).name+'已任命为主驾驶员');return;}
  if(b.dataset.level){const result=levelUp(profile,b.dataset.level);if(applyProfile(result)){sound.play('level',result.level);toast('同步率提升至 Lv.'+result.level);}return;}
  if(b.dataset.slot!==undefined){editSlot(Number(b.dataset.slot));return;}
  if(b.dataset.pickSlot!==undefined){if(applyProfile(setSquadSlot(profile,Number(b.dataset.pickSlot),b.dataset.pickId)))hideModal();return;}
  if(b.dataset.upgrade){choose(b.dataset.upgrade);return;}
  if(b.dataset.setting){const action=b.dataset.setting;if(action==='sound')toggleSound().then(settings);if(action==='quality'){toggleQuality();settings();}if(action==='fullscreen')fullscreen();if(action==='export')exportSave();}
});
$('#brand').addEventListener('click',()=>{if(phase==='menu')showScreen('lobby');else if(phase==='results')goHome();else pause();});
$('#change-secretary').addEventListener('click',()=>{const owned=CHARACTERS.filter(c=>profile.characters[c.id].owned);secretaryId=owned[(owned.findIndex(c=>c.id===secretaryId)+1)%owned.length].id;storage.set('starfall.secretary',secretaryId);refreshSecretary();});
$('#help').addEventListener('click',help);$('#story').addEventListener('click',showStory);$('#records').addEventListener('click',records);$('#settings').addEventListener('click',settings);
$('#pull-one').addEventListener('click',()=>recruit(1));$('#pull-ten').addEventListener('click',()=>recruit(10));$('#rates').addEventListener('click',rates);$('#history').addEventListener('click',history);
$('#skip-summon').addEventListener('click',revealDraws);$('#draw-close').addEventListener('click',closeDraws);$('#draw-roster').addEventListener('click',()=>{closeDraws();inspectId=draws.find(d=>!d.duplicate)?.id||draws[0]?.id||profile.selected;showScreen('roster');});
$('#pause').addEventListener('click',()=>pause());$('#skill').addEventListener('click',skill);$('#dash').addEventListener('click',dash);$('#support').addEventListener('click',support);$('#build-open').addEventListener('click',showBuild);$('#camera').addEventListener('click',cycleCamera);$('#fullscreen').addEventListener('click',fullscreen);
$('#sound').addEventListener('click',toggleSound);$('#quality').addEventListener('click',toggleQuality);$('#modal-close').addEventListener('click',()=>{hideModal();if(phase==='paused')resume();});
function trapFocus(e,container){const all=[...container.querySelectorAll('button:not(:disabled):not([hidden]),summary')].filter(b=>b.offsetParent!==null),first=all[0],last=all.at(-1);if(!first)return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
const movement={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(),interactive=e.target.closest?.('button,a,input,select,textarea,summary');
  if(e.repeat&&(k==='enter'||e.code==='Space')){e.preventDefault();return;}
  if(e.repeat&&['p','escape'].includes(k)){e.preventDefault();return;}
  if(!$('#summon-overlay').hidden){if(k==='tab')trapFocus(e,$('#summon-overlay'));if(k==='escape'){e.preventDefault();if(!$('#summon-stage').hidden)revealDraws();else closeDraws();}return;}
  if(!$('#modal').hidden){if(k==='tab')trapFocus(e,$('#modal'));if((k==='escape'||(k==='p'&&modalType==='pause'))&&modalType!=='result'){e.preventDefault();hideModal();if(phase==='paused')resume();}return;}
  if(phase==='choosing'){if(k==='tab')trapFocus(e,$('#upgrade-overlay'));if(['1','2','3'].includes(k)){e.preventDefault();const u=game.choices[Number(k)-1];if(u)choose(u.id);}if(k==='escape')pause();return;}
  if(e.repeat&&['enter','m','f','q','c','escape','p'].includes(k))return;
  if(k==='m'){toggleSound();return;}if(k==='escape'||k==='p'){e.preventDefault();if(phase==='paused')resume();else if(phase==='menu')showScreen('lobby');else pause();return;}
  if(k==='enter'&&!interactive&&phase==='menu'){e.preventDefault();if(screen==='campaign')start();else showScreen('campaign');return;}
  if(phase!=='playing')return;if(k==='c'){cycleCamera();return;}if(k==='f'){e.preventDefault();skill();return;}if(k==='q'){e.preventDefault();support();return;}
  if(movement[k]){e.preventDefault();keys.add(k);syncMove();}if(e.code==='Space'){e.preventDefault();dash();}
});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(movement[k]){keys.delete(k);syncMove();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTime=0;});window.addEventListener('blur',()=>{clearInput();pause();});window.addEventListener('pagehide',e=>{if(e.persisted)pause();else{sound.dispose();arena?.dispose?.();}});
$$('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(phase!=='playing')return;b.setPointerCapture?.(e.pointerId);touchPointers.set(e.pointerId,b.dataset.move);b.classList.add('pressed');syncMove();});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{touchPointers.delete(e.pointerId);b.classList.remove('pressed');syncMove();});});
$('#world').addEventListener('contextmenu',e=>e.preventDefault());
