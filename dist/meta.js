/** Local, non-monetized character recruitment and progression. */
export const RARITY_RATES = Object.freeze({ SSR: .008, SR: .092, R: .9 });
export const GACHA_COST = 160;
export const MAX_LEVEL = 20;
export const MAX_RESONANCE = 5;
export const GACHA_RULES = Object.freeze({
  starterCrystals: 1600,
  starterMaterials: 200,
  rarePity: 10,
  ssrPity: 80,
  resonanceCopiesPerRank: 2,
  description: '基础概率 SSR 0.8% / SR 9.2% / R 90%。无软保底：连续 10 抽内至少 SR，连续 80 抽内至少 SSR；单抽与十连共享并继承计数。获得 SSR 重置两种计数，获得 SR 只重置 SR 计数。新手十连遵循相同规则，不额外保证 SSR。重复回响每 2 份提升 1 阶共鸣，最多 5 阶，并返还共鸣芯片。',
});

export const CHARACTERS = Object.freeze([
  {
    id: 'nova', name: '星烬', title: '坠星的引信', rarity: 'SSR', element: '热熵', color: '#ed986d', portraitIndex: 0,
    description: '以高火力和暴击压制敌群。她把无法归航的星光，装进了最后一枚弹匣。',
    story: '坍缩之夜，星烬为最后一艘撤离舰点亮了返航信标，自己的名字却从方舟的乘员名单中消失了。如今被唤醒的她，只记得一段不断重播的告别。她深入星骸，想找到那个曾在信号另一端回答她的人。',
    quote: '别回头。接下来的夜空，由我点亮。',
    skillName: '超新星坍缩', skillDescription: '引爆战术火力场，清扫身边的敌群与弹幕。',
    passiveName: '余烬瞄准', passiveDescription: '基础攻击与暴击率较高，适合爆发与连锁构筑。',
    base: { maxHp: 120, attack: 34, defense: 5, crit: .18, critDamage: 1.8, speed: 3, energyMax: 100, energyRegen: 16, skillCooldown: 18, pickupRadius: .55, shield: 12 },
  },
  {
    id: 'aegis', name: '白曜', title: '黎明的守门人', rarity: 'SSR', element: '棱晶', color: '#b0cce5', portraitIndex: 1,
    description: '高生命、防御与护盾的稳健驾驶员。白色装甲下，藏着一份从不撤回的守护约定。',
    story: '白曜曾是方舟外环的守卫，在坍缩中独自撑起避难区的最后一道屏障。她的记忆缺失了整整七分钟，护盾日志却记录着数千次微弱的心跳。她相信那些声音仍在遗迹的某一层，等待有人接他们回家。',
    quote: '你只管向前，剩下的交给我。',
    skillName: '绝对棱域', skillDescription: '展开护盾屏障，为危险穿梭和接敌争取安全窗口。',
    passiveName: '不落之壁', passiveDescription: '更高的防御与初始护盾，容错最强。',
    base: { maxHp: 165, attack: 25, defense: 14, crit: .08, critDamage: 1.6, speed: 2.9, energyMax: 110, energyRegen: 15, skillCooldown: 19, pickupRadius: .55, shield: 55 },
  },
  {
    id: 'echo', name: '雾凛', title: '迟到一秒的未来', rarity: 'SR', element: '时序', color: '#b5a4e7', portraitIndex: 2,
    description: '让敌群慢下来，把时间变成自己的优势。她总在你开口前，听见那句尚未发生的求救。',
    story: '雾凛来自一座被折叠在同一秒中的观测站，方舟将她的回响唤醒时，她已经听过同一场告别无数次。她保存着一只永远慢一秒的怀表。只有接近寂星之心时，停滞的指针才会轻轻跳动。',
    quote: '这一次，我们有足够的时间。',
    skillName: '零时回廊', skillDescription: '冻结敌人的进攻节奏，为绕行、占点与反击争取时间。',
    passiveName: '时间余量', passiveDescription: '技能冷却更短，闪避充能更快。',
    base: { maxHp: 118, attack: 26, defense: 7, crit: .13, critDamage: 1.7, speed: 2.9, energyMax: 105, energyRegen: 19, skillCooldown: 14, pickupRadius: .65, shield: 18 },
  },
  {
    id: 'lyra', name: '弦月', title: '深空协奏者', rarity: 'SR', element: '电弧', color: '#82c8d8', portraitIndex: 3,
    description: '用连续电弧连接战场上的敌人。她的每次出击，都是一段只写给星海的旋律。',
    story: '弦月曾负责把幸存者的声音编入方舟记忆库，却在坍缩后失去了自己的歌声。她从星骸间的电弧里辨认出熟悉的节拍，将每段残响编成新的航行坐标。她想让失散的人们，再听见彼此一次。',
    quote: '听见了吗？这是我们反击的前奏。',
    skillName: '群星连奏', skillDescription: '释放连锁攻击，让分散的敌群同时承受打击。',
    passiveName: '共振节拍', passiveDescription: '暴击率较高，适合多重射击与连锁构筑。',
    base: { maxHp: 116, attack: 29, defense: 6, crit: .17, critDamage: 1.75, speed: 3.05, energyMax: 100, energyRegen: 17, skillCooldown: 17, pickupRadius: .65, shield: 12 },
  },
  {
    id: 'rook', name: '砾石', title: '不退场的前锋', rarity: 'R', element: '重装', color: '#d6b081', portraitIndex: 4,
    description: '耐久可靠、易于驾驶的初始伙伴。与其等待天赋觉醒，他更相信每一次平凡的坚持。',
    story: '砾石是方舟最普通的维修员，直到坍缩切断了外环的撤离通道。他用一台报废衔尾机拖回了满载记忆备份的运输舱，也把自己的左臂留在了裂隙里。他说修得好的东西，就没有放弃的理由。',
    quote: '再难的路，也能一步一步走过去。',
    skillName: '战地重整', skillDescription: '恢复生命，帮助你撑过危险阶段。',
    passiveName: '坚实底盘', passiveDescription: '生命与防御优于一般驾驶员，适合第一次深潜。',
    base: { maxHp: 150, attack: 23, defense: 11, crit: .07, critDamage: 1.6, speed: 2.9, energyMax: 100, energyRegen: 16, skillCooldown: 20, pickupRadius: .55, shield: 20 },
  },
  {
    id: 'iris', name: '鸢尾', title: '追逐宝藏的风', rarity: 'R', element: '探知', color: '#9bc8a8', portraitIndex: 5,
    description: '擅长收集与机动的初始伙伴。她说宇宙里没有无用的碎片，只有尚未被发现的奇迹。',
    story: '鸢尾在方舟的失物仓长大，替归航者整理那些找不到主人的记忆碎片。一次寻访中，她发现许多陌生回响都记得同一座不曾存在的花园。她相信那不是故障，而是旧世界留给幸存者的一条回家路。',
    quote: '那边还有一颗！走嘛，跟上我！',
    skillName: '星尘牵引', skillDescription: '把附近的能量收入囊中，快速推进本局成长。',
    passiveName: '寻宝直觉', passiveDescription: '拾取范围更大、冲刺续航更长，适合收集与经济构筑。',
    base: { maxHp: 115, attack: 24, defense: 5, crit: .1, critDamage: 1.65, speed: 3.1, energyMax: 120, energyRegen: 20, skillCooldown: 16, pickupRadius: 1.35, shield: 10 },
  },
].map(character => Object.freeze({ ...character, base: Object.freeze(character.base) })));

/** Only deployed support slots grant these bonuses; the lead uses its own stats. */
export const SUPPORT_BONUSES = Object.freeze(Object.fromEntries(Object.entries({
  nova: { name: '余烬火控', description: '主驾驶员攻击 +8%', bonuses: { attackMultiplier: 1.08 } },
  aegis: { name: '棱晶掩护', description: '主驾驶员生命 +12%，初始护盾 +12', bonuses: { maxHpMultiplier: 1.12, shield: 12 } },
  echo: { name: '时序校准', description: '主驾驶员技能冷却 -8%', bonuses: { cooldownMultiplier: .92 } },
  lyra: { name: '协奏锁定', description: '主驾驶员暴击率 +4%', bonuses: { crit: .04 } },
  rook: { name: '应急装甲', description: '主驾驶员防御 +4', bonuses: { defense: 4 } },
  iris: { name: '战场搜集', description: '主驾驶员拾取范围 +0.4，闪避充能速度提高', bonuses: { pickupRadius: .4, energyRegen: 2 } },
}).map(([id, value]) => [id, Object.freeze({ ...value, bonuses: Object.freeze(value.bonuses) })])));

export const MISSION_REWARDS = Object.freeze(Object.fromEntries([
  ['m1', 60, 50, 150], ['m2', 80, 65, 180], ['m3', 100, 80, 180], ['m4', 140, 110, 210],
].map(([id, crystals, materials, targetTime]) => [id, Object.freeze({ crystals, materials, targetTime, firstClear: 160 })])));

const byId = new Map(CHARACTERS.map(character => [character.id, character]));
const missionIds = Object.keys(MISSION_REWARDS);
const pools = Object.fromEntries(['SSR', 'SR', 'R'].map(rarity => [rarity, CHARACTERS.filter(character => character.rarity === rarity)]));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const validRunId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,96}$/.test(value);
const decimal = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;

function unlockedFromRecords(records) {
  const unlocked = ['m1'];
  for (let index = 0; index < missionIds.length - 1; index++) {
    if (records[missionIds[index]].clears === 0) break;
    unlocked.push(missionIds[index + 1]);
  }
  return unlocked;
}

function defaultProfile(starter = false) {
  return {
    version: 3,
    starterGranted: true,
    crystals: starter ? GACHA_RULES.starterCrystals : 0,
    materials: starter ? GACHA_RULES.starterMaterials : 0,
    selected: 'rook',
    squad: ['rook', 'iris', null],
    characters: Object.fromEntries(CHARACTERS.map(character => [character.id, {
      owned: character.rarity === 'R', level: 1, resonance: 0, resonanceXp: 0, duplicates: 0,
    }])),
    // Kept only as legacy metadata. It never changes rarity or pity rules.
    gacha: { total: 0, pitySR: 0, pitySSR: 0, beginnerClaimed: !starter },
    stageRecords: Object.fromEntries(missionIds.map(id => [id, { clears: 0, bestStars: 0, bestTime: null, firstClearClaimed: false }])),
    unlockedMissions: ['m1'],
    settledRuns: [], bestScore: 0, totalRuns: 0, totalKills: 0, wins: 0,
  };
}

/** Call only when no prior profile exists. Saved profiles are never topped up. */
export function createProfile() { return defaultProfile(true); }

/** Null means no save. Malformed or legacy objects migrate without another gift. */
export function sanitizeProfile(raw) {
  if (raw === null || raw === undefined) return createProfile();
  const profile = defaultProfile(false);
  if (!isObject(raw)) return profile;
  profile.crystals = integer(raw.crystals, 0, 1_000_000_000);
  profile.materials = integer(raw.materials, 0, 1_000_000_000);
  const collection = isObject(raw.characters) ? raw.characters : {};
  for (const character of CHARACTERS) {
    const entry = isObject(collection[character.id]) ? collection[character.id] : {};
    const current = profile.characters[character.id];
    current.owned = character.rarity === 'R' || entry.owned === true;
    current.level = Math.max(1, integer(entry.level, 1, MAX_LEVEL));
    current.duplicates = integer(entry.duplicates, 0, 1_000_000);
    // Preserve old resonance-based saves, then maintain a single source of truth.
    if (!own(entry, 'duplicates')) current.duplicates = integer(entry.resonance, 0, MAX_RESONANCE) * 2 + integer(entry.resonanceXp, 0, 1);
    current.resonance = Math.min(MAX_RESONANCE, Math.floor(current.duplicates / 2));
    current.resonanceXp = current.resonance === MAX_RESONANCE ? 0 : current.duplicates % 2;
    if (!current.owned) { current.level = 1; current.duplicates = 0; current.resonance = 0; current.resonanceXp = 0; }
  }
  if (typeof raw.selected === 'string' && profile.characters[raw.selected]?.owned) profile.selected = raw.selected;
  // selected is the authoritative lead for legacy saves. Invalid/duplicate supports are dropped.
  profile.squad = [profile.selected, null, null];
  if (Array.isArray(raw.squad)) {
    for (let slot = 1; slot < 3; slot++) {
      const id = raw.squad[slot];
      if (byId.has(id) && profile.characters[id].owned && !profile.squad.includes(id)) profile.squad[slot] = id;
    }
  } else profile.squad[1] = profile.selected === 'iris' ? 'rook' : 'iris';
  if (isObject(raw.gacha)) {
    profile.gacha.total = integer(raw.gacha.total, 0, 1_000_000_000);
    profile.gacha.pitySR = integer(raw.gacha.pitySR, 0, GACHA_RULES.rarePity - 1);
    profile.gacha.pitySSR = integer(raw.gacha.pitySSR, 0, GACHA_RULES.ssrPity - 1);
    profile.gacha.beginnerClaimed = raw.gacha.beginnerClaimed !== false;
    if (profile.gacha.total >= GACHA_RULES.rarePity) profile.gacha.beginnerClaimed = true;
  }
  const records = isObject(raw.stageRecords) ? raw.stageRecords : {};
  for (const id of missionIds) {
    const entry = isObject(records[id]) ? records[id] : {};
    const record = profile.stageRecords[id];
    record.clears = integer(entry.clears, 0, 1_000_000_000);
    record.bestStars = record.clears > 0 ? Math.max(1, integer(entry.bestStars, 1, 3)) : 0;
    record.bestTime = record.clears > 0 && typeof entry.bestTime === 'number' && Number.isFinite(entry.bestTime) && entry.bestTime >= 0 ? Math.min(86_400, entry.bestTime) : null;
    // A legacy record with victories must not receive another first-clear grant.
    record.firstClearClaimed = entry.firstClearClaimed === true || record.clears > 0;
  }
  profile.unlockedMissions = unlockedFromRecords(profile.stageRecords);
  profile.settledRuns = Array.isArray(raw.settledRuns) ? [...new Set(raw.settledRuns.filter(validRunId))] : [];
  profile.bestScore = integer(raw.bestScore, 0, 1_000_000_000);
  profile.totalRuns = Math.max(profile.settledRuns.length, integer(raw.totalRuns, 0, 1_000_000_000));
  profile.totalKills = integer(raw.totalKills, 0, 1_000_000_000);
  profile.wins = Math.min(profile.totalRuns, integer(raw.wins, 0, 1_000_000_000));
  return profile;
}

function failure(profile, error, message) { return { ok: false, profile, error, message }; }

/** Permanent growth: +5% HP / attack per level, +6% per resonance rank. */
export function getStats(raw, id) {
  const profile = sanitizeProfile(raw);
  const selected = byId.has(id) ? id : profile.selected;
  const character = byId.get(selected), entry = profile.characters[selected];
  const level = entry.owned ? entry.level : 1, resonance = entry.owned ? entry.resonance : 0;
  const growth = 1 + (level - 1) * .05 + resonance * .06, base = character.base;
  return {
    maxHp: Math.round(base.maxHp * growth),
    attack: round(base.attack * growth),
    defense: round(base.defense + (level - 1) * .7 + resonance * 1.2),
    crit: round(Math.min(.5, base.crit + resonance * .012), 3),
    critDamage: round(base.critDamage + resonance * .04),
    speed: base.speed,
    energyMax: base.energyMax + resonance * 4,
    energyRegen: round(base.energyRegen + resonance * .8),
    skillCooldown: round(Math.max(8, base.skillCooldown * (1 - resonance * .025))),
    pickupRadius: base.pickupRadius,
    shield: Math.round(base.shield * growth),
  };
}

/** Combat-ready lead stats with both distinct, owned support passives applied once. */
export function getSquadStats(raw) {
  const profile = sanitizeProfile(raw), stats = getStats(profile, profile.selected);
  for (const id of profile.squad.slice(1).filter(Boolean)) {
    const bonus = SUPPORT_BONUSES[id].bonuses;
    if (bonus.attackMultiplier) stats.attack *= bonus.attackMultiplier;
    if (bonus.maxHpMultiplier) stats.maxHp *= bonus.maxHpMultiplier;
    if (bonus.cooldownMultiplier) stats.skillCooldown *= bonus.cooldownMultiplier;
    for (const key of ['shield', 'crit', 'defense', 'pickupRadius', 'energyRegen']) stats[key] += bonus[key] || 0;
  }
  stats.maxHp = Math.round(stats.maxHp);
  stats.crit = round(Math.min(.75, stats.crit), 3);
  for (const key of ['attack', 'skillCooldown', 'defense', 'pickupRadius', 'energyRegen']) stats[key] = round(stats[key]);
  return stats;
}

function randomUnit(random) {
  const result = random();
  return typeof result === 'number' && Number.isFinite(result) ? Math.max(0, Math.min(1 - Number.EPSILON, result)) : .5;
}

export function pull(raw, count, random = Math.random) {
  const profile = sanitizeProfile(raw);
  if (![1, 10].includes(count)) return failure(profile, 'INVALID_COUNT', '每次回响寻访可进行单抽或十连。');
  if (typeof random !== 'function') return failure(profile, 'INVALID_RANDOM', '回响寻访暂时不可用。');
  const cost = GACHA_COST * count;
  if (profile.crystals < cost) return failure(profile, 'INSUFFICIENT_CRYSTALS', `需要 ${cost} 星晶，当前 ${profile.crystals}。完成深潜可以获得星晶。`);
  profile.crystals -= cost;
  const draws = [];
  for (let index = 0; index < count; index++) {
    const tracker = profile.gacha, roll = randomUnit(random);
    let rarity = roll < RARITY_RATES.SSR ? 'SSR' : roll < RARITY_RATES.SSR + RARITY_RATES.SR ? 'SR' : 'R';
    let guarantee = null;
    if (tracker.pitySSR + 1 >= GACHA_RULES.ssrPity) { rarity = 'SSR'; guarantee = 'SSR'; }
    else if (rarity === 'R' && tracker.pitySR + 1 >= GACHA_RULES.rarePity) { rarity = 'SR'; guarantee = 'SR'; }
    const character = pools[rarity][Math.floor(randomUnit(random) * pools[rarity].length)];
    const entry = profile.characters[character.id], duplicate = entry.owned, before = entry.resonance;
    let materials = 0;
    if (duplicate) {
      entry.duplicates++;
      entry.resonance = Math.min(MAX_RESONANCE, Math.floor(entry.duplicates / 2));
      entry.resonanceXp = entry.resonance === MAX_RESONANCE ? 0 : entry.duplicates % 2;
      materials = { R: 20, SR: 50, SSR: 100 }[rarity];
      profile.materials += materials;
    } else entry.owned = true;
    tracker.total++;
    tracker.pitySSR = rarity === 'SSR' ? 0 : tracker.pitySSR + 1;
    tracker.pitySR = rarity === 'SSR' || rarity === 'SR' ? 0 : tracker.pitySR + 1;
    if (rarity === 'SSR' || tracker.total >= GACHA_RULES.rarePity) tracker.beginnerClaimed = true;
    draws.push({ id: character.id, character, rarity, duplicate, materials, resonanceGain: entry.resonance - before, resonance: entry.resonance, resonanceXp: entry.resonanceXp, guarantee });
  }
  return { ok: true, profile, draws, cost };
}

export function upgradeCost(level) {
  const value = Math.max(1, integer(level, 1, MAX_LEVEL));
  return value >= MAX_LEVEL ? 0 : 35 + (value - 1) * 15;
}

export function levelUp(raw, id) {
  const profile = sanitizeProfile(raw), entry = profile.characters[id];
  if (!byId.has(id) || !entry?.owned) return failure(profile, 'CHARACTER_LOCKED', '先唤醒这名驾驶员，再提升同步率。');
  if (entry.level >= MAX_LEVEL) return failure(profile, 'MAX_LEVEL', '已达到同步等级上限 Lv.20。');
  const cost = upgradeCost(entry.level);
  if (profile.materials < cost) return failure(profile, 'INSUFFICIENT_MATERIALS', `需要 ${cost} 共鸣芯片，当前 ${profile.materials}。`);
  profile.materials -= cost;
  entry.level++;
  return { ok: true, profile, id, level: entry.level, cost, stats: getStats(profile, id) };
}

export function selectCharacter(raw, id) {
  return setSquadSlot(raw, 0, id);
}

/** Assigning a deployed pilot swaps slots. Support slots may be cleared. */
export function setSquadSlot(raw, slot, id) {
  const profile = sanitizeProfile(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return failure(profile, 'INVALID_SLOT', '编队只有 1 个主驾驶位和 2 个支援位。');
  if (id === null && slot === 0) return failure(profile, 'LEAD_REQUIRED', '主驾驶位必须保留一名驾驶员。');
  if (id !== null && (!byId.has(id) || !profile.characters[id]?.owned)) return failure(profile, 'CHARACTER_LOCKED', '这名驾驶员尚未加入队伍。');
  const previousSlot = id === null ? -1 : profile.squad.indexOf(id);
  if (previousSlot !== -1 && previousSlot !== slot) {
    // Swapping a lead into an empty support would leave no pilot in command.
    if (previousSlot === 0 && profile.squad[slot] === null) return failure(profile, 'LEAD_REQUIRED', '请先选择新的主驾驶员，再将当前主驾驶员编入空支援位。');
    profile.squad[previousSlot] = profile.squad[slot];
  }
  profile.squad[slot] = id;
  profile.selected = profile.squad[0];
  return { ok: true, profile, character: byId.get(profile.selected), slot, stats: getSquadStats(profile) };
}

export function getMissionAccess(raw, missionId) {
  return missionIds.includes(missionId) && sanitizeProfile(raw).unlockedMissions.includes(missionId);
}

/** A round ID can receive rewards once for the lifetime of this local save. */
export function settleRun(raw, result = {}) {
  const profile = sanitizeProfile(raw);
  if (!isObject(result) || !validRunId(result.runId)) return failure(profile, 'INVALID_RUN', '本次深潜编号无效，未发放奖励。');
  if (profile.settledRuns.includes(result.runId)) return failure(profile, 'ALREADY_SETTLED', '这次深潜已经结算。');
  if (!missionIds.includes(result.missionId)) return failure(profile, 'INVALID_MISSION', '未找到这次行动对应的关卡。');
  if (!profile.unlockedMissions.includes(result.missionId)) return failure(profile, 'MISSION_LOCKED', '该关卡尚未解锁，请先完成前置行动。');
  const score = integer(result.score, 0, 1_000_000), kills = integer(result.kills, 0, 1000);
  const elapsed = decimal(result.elapsed, 0, 86_400), hpRatio = decimal(result.hpRatio, 0, 1);
  const damageTaken = decimal(result.damageTaken, 0, 1_000_000);
  const evacuated = result.evacuated === true;
  const won = result.won === true && !evacuated;
  const abandoned = evacuated && elapsed < 15;
  const mission = MISSION_REWARDS[result.missionId], record = profile.stageRecords[result.missionId];
  const firstClear = won && !record.firstClearClaimed;
  const stars = won ? 1 + Number(hpRatio >= .5) + Number(elapsed <= mission.targetTime) : 0;
  const rewards = { crystals: 0, materials: 0, firstClear, stars, unlockedMission: null };
  if (won) {
    rewards.crystals = mission.crystals + (firstClear ? mission.firstClear : 0);
    rewards.materials = mission.materials;
    record.clears++;
    record.bestStars = Math.max(record.bestStars, stars);
    record.bestTime = record.bestTime === null ? elapsed : Math.min(record.bestTime, elapsed);
    record.firstClearClaimed = true;
    const unlocked = unlockedFromRecords(profile.stageRecords);
    rewards.unlockedMission = unlocked.find(id => !profile.unlockedMissions.includes(id)) || null;
    profile.unlockedMissions = unlocked;
  } else if (!abandoned) {
    rewards.crystals = Math.min(60, 20 + Math.floor(kills * .5));
    rewards.materials = Math.min(35, 10 + kills);
  }
  profile.crystals = Math.min(1_000_000_000, profile.crystals + rewards.crystals);
  profile.materials = Math.min(1_000_000_000, profile.materials + rewards.materials);
  if (!abandoned) profile.bestScore = Math.max(profile.bestScore, score);
  profile.totalRuns++;
  profile.totalKills = Math.min(1_000_000_000, profile.totalKills + kills);
  if (won) profile.wins++;
  profile.settledRuns.push(result.runId);
  return { ok: true, profile, rewards, result: { runId: result.runId, missionId: result.missionId, score, kills, elapsed, hpRatio, damageTaken, won, evacuated, abandoned } };
}
