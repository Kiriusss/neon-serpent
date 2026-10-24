import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, RARITY_RATES, GACHA_COST, createProfile, sanitizeProfile, getStats, pull, upgradeCost, levelUp, selectCharacter, settleRun } from '../dist/meta.js';

function funded() { const profile = createProfile(); profile.crystals = 100_000; return profile; }
function singleWithRoll(profile, rarityRoll, poolRoll = 0) { let calls = 0; return pull(profile, 1, () => calls++ % 2 ? poolRoll : rarityRoll); }

test('new profile grants exactly twenty pulls and two usable starter pilots', () => {
  const profile = createProfile();
  assert.equal(profile.crystals, GACHA_COST * 20);
  assert.equal(profile.materials, 200);
  assert.deepEqual(CHARACTERS.filter(c => profile.characters[c.id].owned).map(c => c.id), ['rook', 'iris']);
  assert.equal(profile.selected, 'rook');
  assert.equal(profile.gacha.beginnerClaimed, false);
  assert.equal(RARITY_RATES.SSR + RARITY_RATES.SR + RARITY_RATES.R, 1);
});

test('base rarity intervals honor the advertised 3 / 17 / 80 percent boundaries', () => {
  const profile = funded();
  for (const [roll, expected] of [[0,'SSR'], [.029999,'SSR'], [.03,'SR'], [.199999,'SR'], [.2,'R'], [.999999,'R']]) {
    assert.equal(singleWithRoll(profile, roll).draws[0].rarity, expected);
  }
});

test('ten-pull beginner guarantee survives nine separate single pulls', () => {
  let profile = funded();
  for (let i = 0; i < 9; i++) { const result = pull(profile, 1, () => .9); assert.equal(result.draws[0].rarity, 'R'); profile = result.profile; }
  const last = pull(profile, 1, () => .9);
  assert.equal(last.draws[0].rarity, 'SSR');
  assert.equal(last.draws[0].guarantee, 'beginner');
  assert.equal(last.profile.gacha.beginnerClaimed, true);
  assert.equal(last.profile.gacha.pitySR, 0);
  assert.equal(last.profile.gacha.pitySSR, 0);
});

test('an early SSR fulfills beginner promise without granting an extra forced SSR', () => {
  let profile = singleWithRoll(funded(), 0).profile;
  for (let i = 0; i < 9; i++) profile = pull(profile, 1, () => .9).profile;
  assert.equal(profile.gacha.total, 10);
  assert.equal(profile.gacha.pitySSR, 9);
  assert.equal(profile.gacha.beginnerClaimed, true);
});

test('SR guarantee persists across batches and resets after an SR or SSR', () => {
  let profile = funded(); profile.gacha.beginnerClaimed = true;
  for (let i = 0; i < 9; i++) profile = pull(profile, 1, () => .9).profile;
  const result = pull(profile, 10, () => .9);
  assert.equal(result.draws[0].rarity, 'SR');
  assert.equal(result.draws[0].guarantee, 'SR');
  assert.equal(result.profile.gacha.pitySR, 9);
  assert.equal(result.profile.gacha.pitySSR, 19);
});

test('fiftieth pull forces SSR, takes priority over SR pity, then restarts both counters', () => {
  let profile = funded(); profile.gacha.beginnerClaimed = true;
  for (let i = 0; i < 4; i++) profile = pull(profile, 10, () => .9).profile;
  const result = pull(profile, 10, () => .9);
  assert.equal(result.draws[9].rarity, 'SSR');
  assert.equal(result.draws[9].guarantee, 'SSR');
  assert.equal(result.profile.gacha.pitySSR, 0);
  assert.equal(result.profile.gacha.pitySR, 0);
});

test('pulls are immutable and reject insufficient funds or invalid quantities atomically', () => {
  const profile = createProfile(), snapshot = JSON.stringify(profile);
  const first = pull(profile, 10, () => .9);
  assert.equal(first.ok, true);
  assert.equal(profile.crystals, 3200);
  assert.equal(JSON.stringify(profile), snapshot);
  for (const quantity of [0,-1,2,1.5,NaN,Infinity,'10']) assert.equal(pull(profile, quantity).error, 'INVALID_COUNT');
  profile.crystals = 159;
  assert.equal(pull(profile,1).error,'INSUFFICIENT_CRYSTALS');
  assert.equal(profile.crystals,159);
});

test('duplicates award materials, progress resonance every two copies, and cap at rank five', () => {
  let profile = funded(); profile.gacha.beginnerClaimed = true;
  const originalAttack = getStats(profile,'rook').attack;
  for (let i = 0; i < 12; i++) {
    profile.gacha.pitySR = 0; // isolate duplicate processing from the pity tests above
    const result = singleWithRoll(profile,.8,0);
    assert.equal(result.draws[0].id,'rook'); assert.equal(result.draws[0].duplicate,true);
    assert.equal(result.draws[0].materials,20); profile=result.profile;
  }
  assert.equal(profile.characters.rook.duplicates,12);
  assert.equal(profile.characters.rook.resonance,5);
  assert.equal(profile.characters.rook.resonanceXp,0);
  assert.equal(profile.materials,200+12*20);
  assert.ok(getStats(profile,'rook').attack > originalAttack);
});

test('first acquisition unlocks a new pilot without counting it as a duplicate', () => {
  const result = singleWithRoll(funded(),0,0);
  assert.equal(result.draws[0].id,'nova');
  assert.equal(result.draws[0].duplicate,false);
  assert.equal(result.profile.characters.nova.owned,true);
  assert.equal(result.profile.characters.nova.duplicates,0);
});

test('leveling spends the displayed cost, changes combat stats, and refuses locked or capped pilots', () => {
  const profile = createProfile(), before = getStats(profile);
  const upgraded = levelUp(profile,'rook');
  assert.equal(upgraded.cost,upgradeCost(1));
  assert.equal(upgraded.profile.materials,200-upgradeCost(1));
  assert.equal(upgraded.profile.characters.rook.level,2);
  assert.ok(upgraded.stats.attack > before.attack);
  assert.ok(upgraded.stats.maxHp > before.maxHp);
  assert.equal(profile.characters.rook.level,1);
  assert.equal(levelUp(profile,'nova').error,'CHARACTER_LOCKED');
  profile.materials=0;assert.equal(levelUp(profile,'rook').error,'INSUFFICIENT_MATERIALS');
  profile.characters.rook.level=20;assert.equal(levelUp(profile,'rook').error,'MAX_LEVEL');
  assert.equal(upgradeCost(20),0);
});

test('selection requires an owned pilot and starter pilots have distinct real combat stats', () => {
  const profile = createProfile();
  assert.equal(selectCharacter(profile,'nova').ok,false);
  const result=selectCharacter(profile,'iris');
  assert.equal(result.profile.selected,'iris');assert.equal(profile.selected,'rook');
  assert.ok(result.stats.pickupRadius > getStats(profile,'rook').pickupRadius);
  assert.ok(result.stats.energyMax > getStats(profile,'rook').energyMax);
  assert.ok(result.stats.maxHp < getStats(profile,'rook').maxHp);
});

test('run settlement grants at least one pull, scales with progress, and cannot repeat a run ID', () => {
  const profile=createProfile();
  const short=settleRun(profile,{runId:'run-1',score:0,kills:0,wave:1,won:false});
  assert.equal(short.ok,true);assert.equal(short.rewards.crystals,160);
  const repeated=settleRun(short.profile,{runId:'run-1',score:100000,kills:100,wave:5,won:true});
  assert.equal(repeated.error,'ALREADY_SETTLED');assert.equal(repeated.profile.crystals,short.profile.crystals);
  const victory=settleRun(short.profile,{runId:'run-2',score:5000,kills:30,wave:5,won:true});
  assert.ok(victory.rewards.crystals>short.rewards.crystals);assert.ok(victory.rewards.materials>short.rewards.materials);
  assert.equal(victory.profile.wins,1);assert.equal(victory.profile.totalRuns,2);assert.equal(victory.profile.bestScore,5000);
  assert.equal(profile.totalRuns,0);
});

test('malformed and legacy saves do not mint another starter grant or expose invalid stats', () => {
  for(const raw of [{},'bad',[],42]) {
    const profile=sanitizeProfile(raw);assert.equal(profile.crystals,0);assert.equal(profile.materials,0);assert.equal(profile.gacha.beginnerClaimed,true);
  }
  const profile=sanitizeProfile({crystals:-10,materials:NaN,selected:'not-a-pilot',characters:{rook:{owned:true,level:Infinity,duplicates:-9}},gacha:{total:15,pitySR:800,pitySSR:-2,beginnerClaimed:false}});
  assert.equal(profile.crystals,0);assert.equal(profile.materials,0);assert.equal(profile.selected,'rook');
  assert.equal(profile.gacha.pitySR,9);assert.equal(profile.gacha.pitySSR,0);assert.equal(profile.gacha.beginnerClaimed,true);
  for(const value of Object.values(getStats(profile)))assert.ok(Number.isFinite(value)&&value>=0);
});

test('existing currency, roster, pity and duplicate history survive sanitization and JSON round-trip', () => {
  let profile=pull(funded(),10,()=>.9).profile;
  profile=levelUp(profile,'rook').profile;
  profile=settleRun(profile,{runId:'persisted:1',score:100,kills:2,wave:1}).profile;
  const saved=sanitizeProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(saved,profile);
  assert.equal(settleRun(saved,{runId:'persisted:1'}).error,'ALREADY_SETTLED');
});

test('invalid run values remain finite and negative or missing run identifiers are rejected', () => {
  for(const runId of ['',null,12,'<script>'])assert.equal(settleRun(createProfile(),{runId}).error,'INVALID_RUN');
  const result=settleRun(createProfile(),{runId:'sanitized',score:NaN,kills:-100,wave:Infinity,won:'true'});
  assert.equal(result.ok,true);assert.equal(result.result.won,false);assert.equal(result.result.kills,0);assert.equal(result.result.score,0);
  assert.equal(result.rewards.crystals,160);assert.ok(Number.isFinite(result.profile.materials));
});
