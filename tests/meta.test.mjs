import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTERS, RARITY_RATES, GACHA_COST, GACHA_RULES, SUPPORT_BONUSES, MISSION_REWARDS,
  createProfile, sanitizeProfile, getStats, getSquadStats, pull, upgradeCost, levelUp,
  selectCharacter, setSquadSlot, getMissionAccess, settleRun,
} from '../dist/meta.js';

function funded() { const profile = createProfile(); profile.crystals = 100_000; return profile; }
function unlockedPilots() { const profile = funded(); for (const entry of Object.values(profile.characters)) entry.owned = true; return profile; }
function singleWithRoll(profile, rarityRoll, poolRoll = 0) { let calls = 0; return pull(profile, 1, () => calls++ % 2 ? poolRoll : rarityRoll); }
function run(profile, overrides = {}) {
  return settleRun(profile, { runId: 'run-1', missionId: 'm1', score: 300, kills: 10, elapsed: 100, hpRatio: .8, damageTaken: 20, won: false, evacuated: false, ...overrides });
}

test('new profile grants ten pulls, two pilots, a distinct squad and only the first mission', () => {
  const profile = createProfile();
  assert.equal(profile.version, 3);
  assert.equal(profile.crystals, GACHA_COST * 10);
  assert.equal(profile.materials, 200);
  assert.deepEqual(CHARACTERS.filter(c => profile.characters[c.id].owned).map(c => c.id), ['rook', 'iris']);
  assert.deepEqual(profile.squad, ['rook', 'iris', null]);
  assert.deepEqual(profile.unlockedMissions, ['m1']);
  assert.equal(profile.gacha.pitySSR, 0);
  assert.equal(RARITY_RATES.SSR + RARITY_RATES.SR + RARITY_RATES.R, 1);
});

test('base rarity intervals precisely honor 0.8 / 9.2 / 90 percent', () => {
  for (const [roll, expected] of [[0,'SSR'], [.007999,'SSR'], [.008,'SR'], [.099999,'SR'], [.1,'R'], [.999999,'R']]) {
    assert.equal(singleWithRoll(funded(), roll).draws[0].rarity, expected, `roll ${roll}`);
  }
  assert.equal(GACHA_RULES.ssrPity, 80);
  assert.equal(GACHA_RULES.beginnerPity, undefined);
});

test('fresh ten-pull guarantees SR only, never forces a beginner SSR', () => {
  const result = pull(createProfile(), 10, () => .9);
  assert.deepEqual(result.draws.map(d => d.rarity), [...Array(9).fill('R'), 'SR']);
  assert.equal(result.draws[9].guarantee, 'SR');
  assert.equal(result.profile.gacha.pitySSR, 10);
  assert.equal(result.profile.gacha.pitySR, 0);
  assert.equal(result.profile.crystals, 0);
});

test('SR pity is shared across singles and ten-pulls', () => {
  let profile = funded();
  for (let i = 0; i < 9; i++) profile = pull(profile, 1, () => .9).profile;
  const result = pull(profile, 10, () => .9);
  assert.equal(result.draws[0].rarity, 'SR');
  assert.equal(result.draws[0].guarantee, 'SR');
  assert.equal(result.profile.gacha.pitySR, 9);
  assert.equal(result.profile.gacha.pitySSR, 19);
});

test('eightieth pull forces SSR, outranks SR pity and resets both counters', () => {
  let profile = funded();
  for (let i = 0; i < 7; i++) profile = pull(profile, 10, () => .9).profile;
  for (let i = 0; i < 9; i++) profile = pull(profile, 1, () => .9).profile;
  assert.equal(profile.gacha.pitySSR, 79);
  assert.equal(profile.gacha.pitySR, 9);
  const result = pull(profile, 1, () => .9);
  assert.equal(result.draws[0].rarity, 'SSR');
  assert.equal(result.draws[0].guarantee, 'SSR');
  assert.equal(result.profile.gacha.pitySSR, 0);
  assert.equal(result.profile.gacha.pitySR, 0);
});

test('natural SSR resets both counters, SR only resets its own; no soft pity', () => {
  const profile = funded(); profile.gacha.pitySSR = 78; profile.gacha.pitySR = 3;
  const normal = singleWithRoll(profile, .008);
  assert.equal(normal.draws[0].rarity, 'SR');
  assert.equal(normal.profile.gacha.pitySSR, 79);
  assert.equal(normal.profile.gacha.pitySR, 0);
  const rare = singleWithRoll(profile, .007999);
  assert.equal(rare.draws[0].rarity, 'SSR');
  assert.equal(rare.profile.gacha.pitySSR, 0);
  assert.equal(rare.profile.gacha.pitySR, 0);
  assert.equal(singleWithRoll(profile, .5).draws[0].rarity, 'R');
});

test('pulls are immutable and reject invalid counts, random sources and insufficient funds', () => {
  const profile = createProfile(), snapshot = JSON.stringify(profile);
  assert.equal(pull(profile, 10, () => .9).ok, true);
  assert.equal(JSON.stringify(profile), snapshot);
  for (const quantity of [0,-1,2,1.5,NaN,Infinity,'10']) assert.equal(pull(profile, quantity).error, 'INVALID_COUNT');
  assert.equal(pull(profile, 1, null).error, 'INVALID_RANDOM');
  profile.crystals = 159;
  assert.equal(pull(profile, 1).error, 'INSUFFICIENT_CRYSTALS');
  assert.equal(profile.crystals, 159);
});

test('duplicates grant materials and real resonance growth capped at five', () => {
  let profile = funded(); const originalAttack = getStats(profile, 'rook').attack;
  for (let i = 0; i < 12; i++) {
    profile.gacha.pitySR = 0;
    const result = singleWithRoll(profile, .8, 0);
    assert.equal(result.draws[0].id, 'rook'); assert.equal(result.draws[0].duplicate, true);
    assert.equal(result.draws[0].materials, 20); profile = result.profile;
  }
  assert.equal(profile.characters.rook.duplicates, 12);
  assert.equal(profile.characters.rook.resonance, 5);
  assert.equal(profile.characters.rook.resonanceXp, 0);
  assert.equal(profile.materials, 200 + 12 * 20);
  assert.ok(getStats(profile, 'rook').attack > originalAttack);
});

test('first acquisition unlocks a pilot without duplicating or silently adding them to squad', () => {
  const result = singleWithRoll(funded(), 0, 0);
  assert.equal(result.draws[0].id, 'nova'); assert.equal(result.draws[0].duplicate, false);
  assert.equal(result.profile.characters.nova.owned, true);
  assert.equal(result.profile.characters.nova.duplicates, 0);
  assert.deepEqual(result.profile.squad, ['rook', 'iris', null]);
});

test('leveling charges displayed cost and changes stats; locked and max-level pilots are rejected', () => {
  const profile = createProfile(), before = getStats(profile), upgraded = levelUp(profile, 'rook');
  assert.equal(upgraded.cost, upgradeCost(1));
  assert.equal(upgraded.profile.materials, 200 - upgradeCost(1));
  assert.equal(upgraded.profile.characters.rook.level, 2);
  assert.ok(upgraded.stats.attack > before.attack); assert.ok(upgraded.stats.maxHp > before.maxHp);
  assert.equal(profile.characters.rook.level, 1);
  assert.equal(levelUp(profile, 'nova').error, 'CHARACTER_LOCKED');
  profile.materials = 0; assert.equal(levelUp(profile, 'rook').error, 'INSUFFICIENT_MATERIALS');
  profile.characters.rook.level = 20; assert.equal(levelUp(profile, 'rook').error, 'MAX_LEVEL');
  assert.equal(upgradeCost(20), 0);
});

test('selecting a deployed support swaps with lead and retains one copy of each', () => {
  const profile = createProfile(), result = selectCharacter(profile, 'iris');
  assert.equal(result.profile.selected, 'iris');
  assert.deepEqual(result.profile.squad, ['iris', 'rook', null]);
  assert.deepEqual(profile.squad, ['rook', 'iris', null]);
  assert.equal(result.stats.defense, getStats(result.profile, 'iris').defense + 4);
  assert.equal(selectCharacter(profile, 'nova').error, 'CHARACTER_LOCKED');
});

test('squad supports swap, clear and reject invalid/locked assignments without duplicate pilots', () => {
  let profile = unlockedPilots();
  profile = setSquadSlot(profile, 2, 'nova').profile;
  profile = setSquadSlot(profile, 1, 'nova').profile;
  assert.deepEqual(profile.squad, ['rook', 'nova', 'iris']);
  profile = setSquadSlot(profile, 1, 'rook').profile;
  assert.deepEqual(profile.squad, ['nova', 'rook', 'iris']);
  assert.equal(profile.selected, 'nova');
  profile = setSquadSlot(profile, 2, null).profile;
  assert.deepEqual(profile.squad, ['nova', 'rook', null]);
  assert.equal(setSquadSlot(profile, 0, null).error, 'LEAD_REQUIRED');
  assert.equal(setSquadSlot(profile, 2, 'nova').error, 'LEAD_REQUIRED');
  for (const slot of [-1, 3, .5, '1', null]) assert.equal(setSquadSlot(profile, slot, 'iris').error, 'INVALID_SLOT');
  assert.equal(setSquadSlot(createProfile(), 1, 'echo').error, 'CHARACTER_LOCKED');
});

test('all six support passives affect the advertised combat numbers exactly once', () => {
  const baseProfile = unlockedPilots(); baseProfile.squad = ['rook', null, null];
  const base = getStats(baseProfile);
  assert.deepEqual(getSquadStats(baseProfile), base);
  for (const id of ['nova', 'aegis', 'echo', 'lyra', 'iris']) {
    const profile = setSquadSlot(baseProfile, 1, id).profile, stats = getSquadStats(profile);
    assert.ok(SUPPORT_BONUSES[id].description);
    if (id === 'nova') assert.equal(stats.attack, Number((base.attack * 1.08).toFixed(2)));
    if (id === 'aegis') { assert.equal(stats.maxHp, Math.round(base.maxHp * 1.12)); assert.equal(stats.shield, base.shield + 12); }
    if (id === 'echo') assert.equal(stats.skillCooldown, Number((base.skillCooldown * .92).toFixed(2)));
    if (id === 'lyra') assert.equal(stats.crit, Number((base.crit + .04).toFixed(3)));
    if (id === 'iris') { assert.equal(stats.pickupRadius, .95); assert.equal(stats.energyRegen, base.energyRegen + 2); }
  }
  const rookSupport = selectCharacter(createProfile(), 'iris').profile;
  assert.equal(getSquadStats(rookSupport).defense, getStats(rookSupport).defense + 4);
  const combined = setSquadSlot(setSquadSlot(baseProfile, 1, 'nova').profile, 2, 'aegis').profile;
  assert.ok(getSquadStats(combined).attack > base.attack); assert.ok(getSquadStats(combined).maxHp > base.maxHp);
});

test('four sequential victories unlock missions, grant first clears and record stars', () => {
  let profile = createProfile();
  for (let index = 1; index <= 4; index++) {
    const missionId = `m${index}`;
    assert.equal(getMissionAccess(profile, missionId), true);
    const result = run(profile, { runId: `win-${index}`, missionId, won: true, elapsed: MISSION_REWARDS[missionId].targetTime, hpRatio: .5 });
    assert.equal(result.ok, true); assert.equal(result.rewards.firstClear, true);
    assert.equal(result.rewards.crystals, MISSION_REWARDS[missionId].crystals + 160);
    assert.equal(result.rewards.materials, MISSION_REWARDS[missionId].materials);
    assert.equal(result.rewards.stars, 3);
    assert.equal(result.rewards.unlockedMission, index < 4 ? `m${index + 1}` : null);
    assert.equal(result.profile.stageRecords[missionId].clears, 1);
    profile = result.profile;
  }
  assert.deepEqual(profile.unlockedMissions, ['m1', 'm2', 'm3', 'm4']);
  assert.equal(profile.wins, 4);
});

test('failure gives a small capped reward and never unlocks the next mission', () => {
  const profile = createProfile();
  const short = run(profile, { kills: 0, score: 0 });
  assert.equal(short.rewards.crystals, 20); assert.equal(short.rewards.stars, 0);
  assert.equal(short.rewards.firstClear, false);
  assert.deepEqual(short.profile.unlockedMissions, ['m1']);
  assert.equal(short.profile.stageRecords.m1.bestTime, null);
  assert.equal(run(profile, { kills: 5 }).rewards.crystals, 22);
  assert.equal(run(profile, { kills: 1000 }).rewards.crystals, 60);
  assert.equal(getMissionAccess(profile, 'm2'), false);
  assert.equal(run(profile, { missionId: 'm2', won: true }).error, 'MISSION_LOCKED');
});

test('early evacuation gives no reward, stays settled and cannot fake a victory', () => {
  const profile = createProfile();
  const early = run(profile, { elapsed: 14.99, evacuated: true, won: true, kills: 100 });
  assert.equal(early.ok, true); assert.equal(early.result.abandoned, true); assert.equal(early.result.won, false);
  assert.deepEqual(early.rewards, { crystals: 0, materials: 0, firstClear: false, stars: 0, unlockedMission: null });
  assert.equal(early.profile.crystals, profile.crystals); assert.equal(early.profile.materials, profile.materials);
  assert.equal(early.profile.wins, 0);
  assert.equal(run(early.profile, { won: true }).error, 'ALREADY_SETTLED');
  assert.equal(run(profile, { elapsed: 15, evacuated: true, kills: 0 }).rewards.crystals, 20);
});

test('first-clear bonus applies once and records retain best stars/time across replays and failures', () => {
  let result = run(createProfile(), { won: true, elapsed: 140, hpRatio: .5 });
  const first = result.profile;
  result = run(first, { runId: 'replay', won: true, elapsed: 170, hpRatio: .2 });
  assert.equal(result.rewards.firstClear, false); assert.equal(result.rewards.crystals, 60); assert.equal(result.rewards.stars, 1);
  assert.equal(result.profile.stageRecords.m1.bestStars, 3); assert.equal(result.profile.stageRecords.m1.bestTime, 140);
  assert.equal(result.profile.stageRecords.m1.clears, 2);
  assert.equal(result.rewards.unlockedMission, null);
  result = run(result.profile, { runId: 'fast', won: true, elapsed: 110, hpRatio: .2 });
  assert.equal(result.rewards.stars, 2); assert.equal(result.profile.stageRecords.m1.bestTime, 110);
  result = run(result.profile, { runId: 'failure', elapsed: 50, hpRatio: 0 });
  assert.equal(result.profile.stageRecords.m1.bestTime, 110);
});

test('settlement is immutable and idempotent across reloads even if duplicate payload changes', () => {
  const profile = createProfile(), snapshot = JSON.stringify(profile);
  const result = run(profile, { won: true });
  const saved = sanitizeProfile(JSON.parse(JSON.stringify(result.profile)));
  assert.deepEqual(saved, result.profile);
  assert.equal(run(saved, { missionId: 'm2', kills: 999, won: true }).error, 'ALREADY_SETTLED');
  assert.equal(saved.bestScore, 300); assert.equal(saved.totalRuns, 1); assert.equal(saved.totalKills, 10);
  assert.equal(JSON.stringify(profile), snapshot);
});

test('V2 migration keeps funds, all owned pilots, growth, pity and historical stats without a new gift', () => {
  const old = funded(); old.version = 2; delete old.squad; delete old.stageRecords; delete old.unlockedMissions;
  old.crystals = 98765; old.materials = 2345; old.selected = 'nova';
  old.characters.nova = { owned: true, level: 17, resonance: 3, resonanceXp: 1 };
  old.gacha = { total: 49, pitySSR: 49, pitySR: 9, beginnerClaimed: false };
  old.bestScore = 9876; old.totalRuns = 7; old.totalKills = 456; old.wins = 5; old.settledRuns = ['old-round'];
  const profile = sanitizeProfile(old);
  assert.equal(profile.version, 3); assert.equal(profile.crystals, 98765); assert.equal(profile.materials, 2345);
  assert.equal(profile.characters.nova.owned, true); assert.equal(profile.characters.nova.level, 17);
  assert.equal(profile.characters.nova.resonance, 3); assert.equal(profile.characters.nova.resonanceXp, 1);
  assert.equal(profile.gacha.pitySSR, 49); assert.equal(profile.gacha.pitySR, 9);
  assert.equal(profile.bestScore, 9876); assert.equal(profile.totalRuns, 7); assert.equal(profile.totalKills, 456); assert.equal(profile.wins, 5);
  assert.deepEqual(profile.unlockedMissions, ['m1']); assert.deepEqual(profile.squad, ['nova', 'iris', null]);
  const next = singleWithRoll(profile, .9);
  assert.equal(next.draws[0].rarity, 'SR'); assert.equal(next.profile.gacha.pitySSR, 50);
  assert.equal(run(profile, { runId: 'old-round' }).error, 'ALREADY_SETTLED');
});

test('legacy beginnerClaimed false no longer forces SSR on the tenth pull', () => {
  const profile = funded(); profile.version = 2; profile.gacha = { total: 9, pitySR: 9, pitySSR: 9, beginnerClaimed: false };
  const result = singleWithRoll(profile, .9);
  assert.equal(result.draws[0].rarity, 'SR'); assert.equal(result.profile.gacha.pitySSR, 10);
});

test('malformed saves get no starter grant, while absent saves do', () => {
  for (const raw of [{}, 'bad', [], 42, false]) {
    const profile = sanitizeProfile(raw);
    assert.equal(profile.crystals, 0); assert.equal(profile.materials, 0);
    assert.deepEqual(profile.unlockedMissions, ['m1']);
  }
  assert.equal(sanitizeProfile(null).crystals, 1600); assert.equal(sanitizeProfile(undefined).crystals, 1600);
  const profile = sanitizeProfile({ crystals: -10, materials: NaN, selected: 'not-a-pilot', squad: ['nova', 'rook', 'rook'], characters: { rook: { owned: true, level: Infinity, duplicates: -9 } }, gacha: { total: 15, pitySR: 800, pitySSR: -2 } });
  assert.equal(profile.crystals, 0); assert.equal(profile.materials, 0); assert.equal(profile.selected, 'rook');
  assert.deepEqual(profile.squad, ['rook', null, null]);
  assert.equal(profile.gacha.pitySR, 9); assert.equal(profile.gacha.pitySSR, 0);
  for (const value of Object.values(getSquadStats(profile))) assert.ok(Number.isFinite(value) && value >= 0);
});

test('mission access derives from sequential cleared records, never arbitrary unlock flags', () => {
  const profile = createProfile(); profile.unlockedMissions = ['m1', 'm2', 'm3', 'm4'];
  profile.stageRecords.m4 = { clears: 1, bestStars: 3, bestTime: 20, firstClearClaimed: true };
  const normalized = sanitizeProfile(profile);
  assert.deepEqual(normalized.unlockedMissions, ['m1']);
  assert.equal(getMissionAccess(normalized, 'bad-id'), false);
  assert.equal(getMissionAccess(normalized, 'm4'), false);
  profile.stageRecords.m1 = { clears: 1, bestStars: 99, bestTime: NaN, firstClearClaimed: false };
  const known = sanitizeProfile(profile);
  assert.deepEqual(known.unlockedMissions, ['m1', 'm2']);
  assert.equal(known.stageRecords.m1.bestStars, 3); assert.equal(known.stageRecords.m1.bestTime, null);
  assert.equal(known.stageRecords.m1.firstClearClaimed, true);
});

test('invalid run IDs and missions are rejected and numerical inputs stay finite', () => {
  for (const runId of ['', null, 12, '<script>']) assert.equal(run(createProfile(), { runId }).error, 'INVALID_RUN');
  assert.equal(run(createProfile(), { missionId: undefined }).error, 'INVALID_MISSION');
  assert.equal(run(createProfile(), { missionId: '__proto__' }).error, 'INVALID_MISSION');
  const result = run(createProfile(), { runId: 'sanitized', score: NaN, kills: -100, elapsed: Infinity, hpRatio: NaN, damageTaken: -10, won: 'true' });
  assert.equal(result.ok, true); assert.equal(result.result.won, false); assert.equal(result.result.kills, 0); assert.equal(result.result.score, 0);
  assert.equal(result.rewards.crystals, 20);
  for (const key of ['score', 'kills', 'elapsed', 'hpRatio', 'damageTaken']) assert.ok(Number.isFinite(result.result[key]));
});
