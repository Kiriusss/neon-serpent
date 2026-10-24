/** Local, non-monetized character recruitment and progression. */
export const RARITY_RATES = Object.freeze({ SSR: .03, SR: .17, R: .8 });
export const GACHA_COST = 160;
export const MAX_LEVEL = 20;
export const MAX_RESONANCE = 5;
export const GACHA_RULES = Object.freeze({
  starterCrystals: 3200,
  starterMaterials: 200,
  rarePity: 10,
  ssrPity: 50,
  beginnerPity: 10,
  resonanceCopiesPerRank: 2,
  description: '基础概率 SSR 3% / SR 17% / R 80%；连续 10 抽内至少 SR，连续 50 抽内至少 SSR。首次 10 抽内至少 1 名 SSR，提前抽中即完成新手保底。保底跨单抽、十连继承，出 SSR 重置两种计数。重复回响每 2 份提升 1 阶共鸣，最多 5 阶，并返还共鸣芯片。',
});

export const CHARACTERS = Object.freeze([
  {
    id: 'nova', name: '星烬', title: '坠星的引信', rarity: 'SSR', element: '热熵', color: '#ed986d', portraitIndex: 0,
    description: '以高火力和暴击压制敌群。她把无法归航的星光，装进了最后一枚弹匣。',
    story: '坍缩之夜，星烬为最后一艘撤离舰点亮了返航信标，自己的名字却从方舟的乘员名单中消失了。如今被唤醒的她，只记得一段不断重播的告别。她深入星骸，想找到那个曾在信号另一端回答她的人。',
    quote: '别回头。接下来的夜空，由我点亮。',
    skillName: '超新星坍缩', skillDescription: '释放高伤害范围爆发，清扫周围的三维空间。',
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
    skillName: '零时回廊', skillDescription: '冻结敌人的进攻节奏，获得重新规划空间路线的机会。',
    passiveName: '时间余量', passiveDescription: '技能冷却更短，能量恢复更快。',
    base: { maxHp: 118, attack: 26, defense: 7, crit: .13, critDamage: 1.7, speed: 2.9, energyMax: 105, energyRegen: 19, skillCooldown: 14, pickupRadius: .65, shield: 18 },
  },
  {
    id: 'lyra', name: '弦月', title: '深空协奏者', rarity: 'SR', element: '电弧', color: '#82c8d8', portraitIndex: 3,
    description: '用连续电弧连接分散在空间中的敌人。她的每次出击，都是一段只写给星海的旋律。',
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

const byId = new Map(CHARACTERS.map(character => [character.id, character]));
const pools = Object.fromEntries(['SSR', 'SR', 'R'].map(rarity => [rarity, CHARACTERS.filter(character => character.rarity === rarity)]));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const validRunId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,96}$/.test(value);

function defaultProfile(starter = false) {
  return {
    version: 2,
    starterGranted: true,
    crystals: starter ? GACHA_RULES.starterCrystals : 0,
    materials: starter ? GACHA_RULES.starterMaterials : 0,
    selected: 'rook',
    characters: Object.fromEntries(CHARACTERS.map(character => [character.id, {
      owned: character.rarity === 'R', level: 1, resonance: 0, resonanceXp: 0, duplicates: 0,
    }])),
    gacha: { total: 0, pitySR: 0, pitySSR: 0, beginnerClaimed: !starter },
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
  if (isObject(raw.gacha)) {
    profile.gacha.total = integer(raw.gacha.total, 0, 1_000_000_000);
    profile.gacha.pitySR = integer(raw.gacha.pitySR, 0, GACHA_RULES.rarePity - 1);
    profile.gacha.pitySSR = integer(raw.gacha.pitySSR, 0, GACHA_RULES.ssrPity - 1);
    profile.gacha.beginnerClaimed = raw.gacha.beginnerClaimed !== false;
    if (profile.gacha.total >= GACHA_RULES.beginnerPity) profile.gacha.beginnerClaimed = true;
  }
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
    if (!tracker.beginnerClaimed && tracker.total + 1 >= GACHA_RULES.beginnerPity) { rarity = 'SSR'; guarantee = 'beginner'; }
    else if (tracker.pitySSR + 1 >= GACHA_RULES.ssrPity) { rarity = 'SSR'; guarantee = 'SSR'; }
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
    if (rarity === 'SSR') tracker.beginnerClaimed = true;
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
  const profile = sanitizeProfile(raw);
  if (!byId.has(id) || !profile.characters[id]?.owned) return failure(profile, 'CHARACTER_LOCKED', '这名驾驶员尚未加入队伍。');
  profile.selected = id;
  return { ok: true, profile, character: byId.get(id), stats: getStats(profile, id) };
}

/** A round ID can receive rewards once for the lifetime of this local save. */
export function settleRun(raw, result = {}) {
  const profile = sanitizeProfile(raw);
  if (!isObject(result) || !validRunId(result.runId)) return failure(profile, 'INVALID_RUN', '本次深潜编号无效，未发放奖励。');
  if (profile.settledRuns.includes(result.runId)) return failure(profile, 'ALREADY_SETTLED', '这次深潜已经结算。');
  const score = integer(result.score, 0, 1_000_000), kills = integer(result.kills, 0, 1000);
  const wave = Math.max(1, integer(result.wave, 1, 5)), won = result.won === true;
  const rewards = {
    crystals: Math.min(4000, 160 + kills * 8 + (wave - 1) * 60 + Math.floor(score / 500) * 10 + (won ? 500 : 0)),
    materials: Math.min(1600, 30 + kills * 3 + wave * 15 + (won ? 120 : 0)),
  };
  profile.crystals = Math.min(1_000_000_000, profile.crystals + rewards.crystals);
  profile.materials = Math.min(1_000_000_000, profile.materials + rewards.materials);
  profile.bestScore = Math.max(profile.bestScore, score);
  profile.totalRuns++;
  profile.totalKills += kills;
  if (won) profile.wins++;
  profile.settledRuns.push(result.runId);
  return { ok: true, profile, rewards, result: { runId: result.runId, score, kills, wave, won } };
}
