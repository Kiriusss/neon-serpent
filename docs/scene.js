import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD } from './engine.js?v=3.0';

// All gameplay coordinates are on X/Z; object heights are purely visual.
const W = WORLD.x, D = WORLD.z, TAU = Math.PI * 2, clamp = THREE.MathUtils.clamp;
const toWorld = (p, height = .62) => new THREE.Vector3((p?.x ?? W / 2) - W / 2, height, (p?.z ?? D / 2) - D / 2);
const THEMES = {
  m1: { floor: 0x3d505b, slab: 0x253a46, edge: 0x75919b, sky: 0x182b39, fog: 0x203746, key: 0xffe1b1, accent: 0xcba46e, water: 0x182f40 },
  m2: { floor: 0x344552, slab: 0x22333d, edge: 0x658895, sky: 0x13232e, fog: 0x1c3543, key: 0xd9eaf6, accent: 0x79bdbd, water: 0x132d39 },
  m3: { floor: 0x3a414e, slab: 0x282c39, edge: 0x8a8da3, sky: 0x1d2130, fog: 0x292b3d, key: 0xe5e7ff, accent: 0xa9a3d2, water: 0x1a2331 },
  m4: { floor: 0x343c47, slab: 0x222934, edge: 0x8f969c, sky: 0x171f2c, fog: 0x242c3c, key: 0xf7ddbf, accent: 0xd0a97d, water: 0x171f2c },
};
function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .32, ...options }); }
function basic(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1, toneMapped: false }); }
function mesh(geometry, mat, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geometry, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; }
function box(w, h, d, mat, x = 0, y = 0, z = 0, bevel = .04) { return mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 4, h / 4, d / 4)), mat, x, y, z); }
function line(points, color, opacity = 1) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, toneMapped: false })); }
function ring(radius, width, color, opacity = 1, segments = 64) { const o = mesh(new THREE.RingGeometry(Math.max(0, radius - width), radius, segments), basic(color, opacity)); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o; }
function prism(points, height, mat) {
  const s = new THREE.Shape(); s.moveTo(...points[0]); for (const p of points.slice(1)) s.lineTo(...p); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1, steps: 1 }); g.rotateX(Math.PI / 2); g.translate(0, height / 2, 0); return mesh(g, mat);
}
function textLabel(text, color = '#bed0d8', scale = 1) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const ctx = c.getContext('2d'); ctx.font = '600 28px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(4 * scale, scale, 1); return s;
}
function disposeNode(node) {
  const gs = new Set(), ms = new Set(), ts = new Set(); node.traverse(o => { if (o.isInstancedMesh || o.isLight) o.dispose?.(); if (o.geometry) gs.add(o.geometry); for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) { ms.add(m); if (m.map) ts.add(m.map); } }); node.traverse(o => { for (const m of o.userData.ownedMaterials || []) ms.add(m); }); for (const g of gs) g.dispose(); for (const m of ms) m.dispose(); for (const t of ts) t.dispose();
}

/** Physical lighting and local effects, without bloom or camera shake. */
export class Arena {
  constructor(canvas, { onFailure = () => {} } = {}) {
    this.canvas = canvas; this.onFailure = onFailure; this.t = 0; this.menu = true; this.low = false; this.dead = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.pointer = new THREE.Vector2();
    this.cameraIndex = 0; this.cameraLabel = '战术'; this.azimuth = this.targetAzimuth = 0; this.elevation = this.targetElevation = 1.02;
    this.characterColor = new THREE.Color(0x80cfdd); this.missionId = ''; this.dummy = new THREE.Object3D(); this.lastHead = new THREE.Vector3();
    this.foodMeshes = new Map(); this.enemyMeshes = new Map(); this.obstacleMeshes = new Map(); this.hazardMeshes = new Map(); this.objectiveMeshes = new Map(); this.effectTimer = 0; this.dashTrailTimer = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.06; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x203746, 56, 112); this.camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 180);
    this.ambient = new THREE.HemisphereLight(0xd1e3ee, 0x344454, 2); this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xffe1b1, 3.2); this.keyLight.position.set(-18, 28, 13); this.keyLight.castShadow = true; this.keyLight.shadow.mapSize.set(2048, 2048); Object.assign(this.keyLight.shadow.camera, { left: -26, right: 26, top: 24, bottom: -24, near: 1, far: 85 }); this.keyLight.shadow.bias = -.0002; this.keyLight.shadow.normalBias = .018; this.keyLight.shadow.radius = 2; this.scene.add(this.keyLight);
    this.rimLight = new THREE.DirectionalLight(0x8fb7d1, 1.3); this.rimLight.position.set(18, 12, -14); this.scene.add(this.rimLight); this.skillLight = new THREE.PointLight(0x93dced, 0, 7, 2); this.scene.add(this.skillLight);
    this.battle = new THREE.Group(); this.scene.add(this.battle); this.createPlayer(); this.createProjectiles(); this.createEffects(); this.createPayload(); this.setMission('m1');
    this.fitCorners = []; for (const x of [-W / 2 - .65, W / 2 + .65]) for (const y of [-.65, 2.8]) for (const z of [-D / 2 - .65, D / 2 + .65]) this.fitCorners.push(new THREE.Vector3(x, y, z));
    this.resizeHandler = () => this.resize(); window.addEventListener('resize', this.resizeHandler); this.contextLost = e => { e.preventDefault(); this.onFailure('图形设备暂时中断，请刷新页面恢复。'); }; canvas.addEventListener('webglcontextlost', this.contextLost); this.resize();
  }
  setMission(mission) {
    const id = typeof mission === 'string' ? mission : mission?.id || mission?.missionId || 'm1'; this.mission = typeof mission === 'object' ? mission : { id }; if (this.missionId === id) return; this.missionId = id;
    if (this.stage) { this.scene.remove(this.stage); disposeNode(this.stage); } this.stage = new THREE.Group(); this.scene.add(this.stage); this.theme = THEMES[id] || THEMES.m1; this.renderer.setClearColor(this.theme.sky); this.scene.fog.color.set(this.theme.fog); this.keyLight.color.set(this.theme.key); this.createStage(); this.routeKey = ''; this.clearDynamic();
  }
  createStage() {
    const t = this.theme, slab = material(t.slab, { roughness: .78 }), edge = material(t.edge, { roughness: .47, metalness: .52 }); this.stage.add(box(W + .8, .65, D + .8, slab, 0, -.43, 0, .12));
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(W / 8 - .035, .07, D / 6 - .035), material(t.floor, { roughness: .86, metalness: .12 }), 48); panels.receiveShadow = true; const color = new THREE.Color(t.floor); let n = 0;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 6; z++) { this.dummy.position.set((x + .5) * W / 8 - W / 2, -.065, (z + .5) * D / 6 - D / 2); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); panels.setMatrixAt(n, this.dummy.matrix); panels.setColorAt(n++, color.clone().multiplyScalar(.92 + ((x * 7 + z * 3) % 5) * .025)); } this.stage.add(panels);
    const strip = material(0x9faeaf, { roughness: .8 });
    for (const s of [-1, 1]) { this.stage.add(box(W + .4, .11, .15, edge, 0, -.02, s * (D / 2 + .08), .025), box(.15, .11, D + .4, edge, s * (W / 2 + .08), -.02, 0, .025)); for (let i = -W / 2 + 1.1; i < W / 2; i += 2) { const mark = box(.7, .018, .18, strip, i, -.005, s * (D / 2 - .42), .006); mark.castShadow = false; this.stage.add(mark); } for (let i = -D / 2 + 1.1; i < D / 2; i += 2) { const mark = box(.18, .018, .7, strip, s * (W / 2 - .42), -.005, i, .006); mark.castShadow = false; this.stage.add(mark); } }
    const accent = material(t.accent, { roughness: .5, metalness: .4 }); for (const x of [-1, 1]) for (const z of [-1, 1]) this.stage.add(box(1.35, .23, .8, edge, x * (W / 2 - .3), .06, z * (D / 2 + .25), .08), box(.65, .04, .16, accent, x * (W / 2 - .3), .195, z * (D / 2 + .25), .01));
    const outer = mesh(new THREE.PlaneGeometry(160, 160), material(t.water, { roughness: .26, metalness: .55 }), 0, -1.6, 0); outer.rotation.x = -Math.PI / 2; this.stage.add(outer); this.decor = new THREE.Group(); this.stage.add(this.decor);
    if (this.missionId === 'm1') this.buildHarbor(); else if (this.missionId === 'm2') this.buildTransit(); else if (this.missionId === 'm3') this.buildCitadel(); else this.buildHeart(); this.routeGroup = new THREE.Group(); this.stage.add(this.routeGroup);
  }
  buildHarbor() {
    const paint = material(0x9b866b, { roughness: .78 }), steel = material(0x334d5a), dark = material(0x2a3c47), runway = [];
    for (const x of [-W / 2 + 2, W / 2 - 2]) for (let z = -D / 2 + 2; z < D / 2 - 1; z += 2.8) runway.push([x, -.014, z], [x, -.014, z + 1.4]); this.decor.add(line(runway, 0xc4b493, .34));
    for (const side of [-1, 1]) { const x = side * (W / 2 + 5.5), z = -D / 2 - 4; this.decor.add(box(.75, 6.8, .75, steel, x, 1.7, z, .04), box(7.4, .65, .75, paint, x - side * 1.7, 5.1, z, .06)); this.decor.add(line([[x - side * 4.5, 4.9, z], [x - side * 4.5, 1.5, z]], 0x79919a, .7)); for (let i = 0; i < 3; i++) this.decor.add(box(3.1, 1.25, 2, i % 2 ? paint : dark, side * (W / 2 + 4), -.1, 3 + i * 2.4)); }
    const wake = []; for (let i = 0; i < 12; i++) { const z = (i - 6) * 4; wake.push([-42, -1.56, z], [-W / 2 - 7, -1.56, z], [W / 2 + 7, -1.56, z + 1], [42, -1.56, z + 1]); } this.decor.add(line(wake, 0x426477, .2)); this.stageTag('ARK 07 / DAWN DOCK', '#aab7bb');
  }
  buildTransit() {
    const road = []; for (let z = -D / 2 + 1; z < D / 2; z += 2.3) for (const x of [-W / 2 + 1.4, W / 2 - 1.4]) road.push([x, -.012, z], [x, -.012, z + 1.1]); this.decor.add(line(road, 0x7faaaa, .45));
    const steel = material(0x536873), stone = material(0x253b46); for (const x of [-W / 2 - 3.7, W / 2 + 3.7]) { for (let z = -14; z < 16; z += 6) this.decor.add(box(1.3, 3.9, 1.6, stone, x, .1, z, .14), box(1.5, .16, 1.8, steel, x, 2.15, z, .03)); this.decor.add(box(.55, .5, D + 13, steel, x, 1.45, 0, .04)); } this.stageTag('TRANSIT CORRIDOR / 02', '#90bbc3');
  }
  buildCitadel() {
    const metal = material(0x434656, { metalness: .6 }), top = material(0x9c9db5, { metalness: .65, roughness: .4 }), light = material(0xa7aed4, { emissive: 0x586694, emissiveIntensity: .32 });
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const x = side * (W / 2 + 4), z = (i - 1) * 8, h = 2.1 + i * .7; this.decor.add(box(2, h, 2, metal, x, h / 2 - .8, z, .12), box(2.15, .2, 2.15, top, x, h - .7, z, .03), box(.07, h * .55, .09, light, x - side * 1.04, h / 2 - .3, z)); }
    const traces = []; for (const s of [-1, 1]) { traces.push([-W / 2 + 3, -.012, s * 9], [-8, -.012, s * 9], [-8, -.012, s * 9], [-6, -.012, s * 7], [W / 2 - 3, -.012, s * 9], [8, -.012, s * 9], [8, -.012, s * 9], [6, -.012, s * 7]); } this.decor.add(line(traces, 0xa3a6c4, .26)); this.stageTag('NEXUS / TRIANGULATION', '#b5b4cb');
  }
  buildHeart() {
    for (const radius of [3.6, 7.1, 10.5]) { const r = ring(radius, .045, 0xb9a387, .24, 96); r.position.y = -.012; this.decor.add(r); }
    const metal = material(0x454a55, { metalness: .5 }), accent = material(0xc3ab8b, { metalness: .58, roughness: .43 }); for (let i = 0; i < 8; i++) { const a = i * TAU / 8, x = Math.sin(a) * (W / 2 + 5), z = Math.cos(a) * (D / 2 + 5), h = 2 + (i % 3) * .9; const col = box(1.1, h, 1.1, metal, x, h / 2 - 1, z, .04); col.rotation.z = Math.sin(a) * .13; this.decor.add(col, box(.12, h * .45, .12, accent, x, h / 2 - .3, z + .56)); }
    const sigil = []; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; sigil.push([Math.sin(a) * 9.5, -.01, Math.cos(a) * 9.5], [Math.sin(a) * 10.2, -.01, Math.cos(a) * 10.2]); } this.decor.add(line(sigil, 0xcab092, .36)); this.stageTag('THE SILENT HEART / 04', '#c3b09a');
  }
  stageTag(text, color) { const tag = textLabel(text, color, .58); tag.position.set(0, .2, D / 2 + 1.4); this.decor.add(tag); }
  createPlayer() {
    this.head = new THREE.Group(); this.battle.add(this.head); this.playerModel = new THREE.Group(); this.head.add(this.playerModel);
    this.bodyMaterial = material(0xdbe6e8, { roughness: .36, metalness: .58 }); this.trimMaterial = material(0x78bfce, { roughness: .35, metalness: .55 }); this.darkMaterial = material(0x243b4b, { roughness: .33, metalness: .66 }); this.eyeMaterial = material(0x9bedee, { emissive: 0x43b9cd, emissiveIntensity: .45, roughness: .22 });
    this.playerModel.add(prism([[0, 1.04], [.4, .38], [.34, -.72], [-.34, -.72], [-.4, .38]], .35, this.bodyMaterial), box(.32, .18, .76, this.darkMaterial, 0, .23, .1, .08), box(.16, .035, .4, this.eyeMaterial, 0, .34, .17, .015));
    for (const side of [-1, 1]) { const wing = prism([[side * .25, .24], [side * .95, -.08], [side * .9, -.72], [side * .38, -.5]], .16, this.bodyMaterial); wing.position.y = -.03; this.playerModel.add(wing, box(.13, .1, .52, this.trimMaterial, side * .64, .08, -.35, .025), box(.14, .14, .56, this.darkMaterial, side * .47, -.05, .4, .025), box(.13, .12, .14, this.eyeMaterial, side * .49, -.04, .72, .02)); const engine = box(.2, .12, .2, this.eyeMaterial, side * .49, -.03, -.78, .03); engine.userData.thruster = true; this.playerModel.add(engine); }
    const emblem = prism([[0, .08], [.11, -.08], [-.11, -.08]], .02, material(0xeac489, { roughness: .4 })); emblem.position.set(0, .21, .7); this.playerModel.add(emblem);
    this.playerRing = ring(.98, .045, 0xb9eef1, .72); this.playerRing.position.y = .025; this.battle.add(this.playerRing); this.shieldRing = ring(1.12, .025, 0x90c7df, .33); this.shieldRing.position.y = .03; this.battle.add(this.shieldRing); this.drones = [];
    for (let i = 0; i < 4; i++) { const d = new THREE.Group(); d.add(prism([[0, .44], [.2, .06], [.15, -.32], [-.15, -.32], [-.2, .06]], .18, this.bodyMaterial), box(.065, .035, .35, this.trimMaterial, 0, .13, .02, .012)); for (const side of [-1, 1]) d.add(box(.2, .07, .25, this.darkMaterial, side * .19, -.01, -.14, .025)); this.battle.add(d); this.drones.push(d); }
  }
  createProjectiles() {
    this.projectileCapacity = 512; this.bulletCores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), basic(0xffffff), this.projectileCapacity); this.bulletTails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(0xffffff, .62), this.projectileCapacity);
    for (const m of [this.bulletCores, this.bulletTails]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.battle.add(m); }
    this.shotGeometry = new THREE.BufferGeometry(); this.shotGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(128 * 6), 3)); this.shotGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(128 * 6), 3)); this.shotGeometry.setDrawRange(0, 0); this.shotLines = new THREE.LineSegments(this.shotGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .85, depthWrite: false, toneMapped: false })); this.shotLines.frustumCulled = false; this.battle.add(this.shotLines);
  }
  createPayload() {
    this.payloadMesh = new THREE.Group(); this.payloadMesh.visible = false; this.battle.add(this.payloadMesh); const armor = material(0xd7ded6, { roughness: .42, metalness: .46 }), blue = material(0x67b8c6), dark = material(0x334b59);
    this.payloadMesh.add(box(1.3, .6, 1.75, armor, 0, .15, 0, .15), box(.68, .5, .7, dark, 0, .6, -.1, .1), box(.42, .08, .42, material(0xb7e7ea, { emissive: 0x469cac, emissiveIntensity: .36 }), 0, .88, -.1, .03));
    for (const side of [-1, 1]) for (const z of [-.58, .58]) this.payloadMesh.add(box(.45, .23, .55, blue, side * .83, -.1, z, .09)); const bar = this.healthBar(1.85, 0x93d6ce, 1.3); this.payloadModel = new THREE.Group(); for (const part of [...this.payloadMesh.children]) this.payloadModel.add(part); this.payloadMesh.add(this.payloadModel, bar); this.payloadMesh.userData.hpBar = bar; const tag = textLabel('ARK / 07', '#b9e3e3', .35); tag.position.set(0, 1.65, 0); this.payloadMesh.add(tag); this.escortRing = ring(3.6, .035, 0x83bec3, .35); this.escortRing.position.y = .018; this.escortRing.visible = false; this.battle.add(this.escortRing);
  }
  createEffects() {
    this.particles = Array.from({ length: 180 }, () => ({ life: 0, maxLife: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), color: new THREE.Color(), size: .1 })); this.particleCursor = 0; this.particleMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), basic(0xffffff), this.particles.length); this.particleMesh.frustumCulled = false; this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.battle.add(this.particleMesh); this.ripples = []; this.ghosts = [];
    for (let i = 0; i < 8; i++) { const ghost = prism([[0, .95], [.78, -.55], [0, -.3], [-.78, -.55]], .08, basic(0x7fcbd9, .18)); ghost.visible = false; ghost.castShadow = false; this.battle.add(ghost); this.ghosts.push({ mesh: ghost, life: 0 }); } this.ghostCursor = 0;
  }
  healthBar(width, color, height) {
    const g = new THREE.Group(); g.position.y = height; const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x182531, depthWrite: false, depthTest: false, toneMapped: false })); back.scale.set(width, .105, 1); back.renderOrder = 5; g.add(back); const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthWrite: false, depthTest: false, toneMapped: false })); fill.scale.set(width - .06, .055, 1); fill.position.z = .01; fill.renderOrder = 6; g.add(fill); g.userData.fill = fill; g.userData.width = width - .06; return g;
  }
  updateBar(bar, ratio) { ratio = clamp(ratio || 0, 0, 1); const w = bar.userData.width; bar.userData.fill.scale.x = w * ratio; bar.userData.fill.position.x = -(1 - ratio) * w / 2; }
  makeFood(food) {
    const g = new THREE.Group(), heal = food.type === 'heal', gold = food.type === 'gold', chrono = food.type === 'chrono', color = heal ? 0x90d7b7 : gold ? 0xe8be74 : chrono ? 0xada5df : 0x7cb6c9;
    const mat = material(color, { metalness: .45, roughness: .36, emissive: color, emissiveIntensity: .1 }); if (heal) g.add(box(.45, .1, .15, mat), box(.15, .1, .45, mat)); else g.add(mesh(new THREE.OctahedronGeometry(gold ? .28 : .2, 0), mat)); const base = ring(gold ? .4 : .32, .025, color, .5, 24); base.position.y = -.37; g.add(base); this.battle.add(g); return g;
  }
  makeEnemy(enemy) {
    const g = new THREE.Group(), model = new THREE.Group(); g.add(model); const boss = enemy.type === 'boss', turret = enemy.type === 'turret', charger = enemy.type === 'charger';
    const armor = material(boss ? 0x525363 : charger ? 0xaf705d : 0xa16768, { roughness: .48, metalness: .48 }), dark = material(0x303d4a, { roughness: .43, metalness: .58 }), pale = material(boss ? 0xbfc2cb : 0xc49e90, { roughness: .42, metalness: .48 }), eye = material(0xf5b09a, { emissive: 0xd15a42, emissiveIntensity: .42, roughness: .3 });
    if (boss) { model.add(mesh(new THREE.CylinderGeometry(1.15, 1.5, .8, 8), dark, 0, .1, 0), mesh(new THREE.CylinderGeometry(.87, 1.15, .65, 8), armor, 0, .8, 0), mesh(new THREE.OctahedronGeometry(.53, 0), eye, 0, 1.35, 0)); for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.y = TAU * i / 4; arm.add(box(.62, .45, 1.6, pale, 0, .35, 1.4, .07), box(.3, .2, .6, eye, 0, .61, 1.65, .025)); model.add(arm); } const crown = mesh(new THREE.TorusGeometry(1.3, .045, 4, 48), pale, 0, 1.13, 0); crown.rotation.x = Math.PI / 2; model.add(crown); g.userData.crown = crown;
    } else if (turret || enemy.type === 'gunner') { model.add(mesh(new THREE.CylinderGeometry(turret ? .65 : .48, turret ? .75 : .62, .25, 6), dark, 0, -.25, 0), box(.9, .42, .85, armor, 0, .04, 0, .08)); for (const side of [-1, 1]) model.add(box(.18, .18, .95, dark, side * .26, .23, .5, .025), box(.18, .1, .11, eye, side * .26, .23, .98, .01)); if (!turret) for (const side of [-1, 1]) model.add(box(.25, .22, 1.12, dark, side * .57, -.15, -.08, .06)); else model.add(box(.48, .12, .45, pale, 0, .31, -.13, .03));
    } else if (charger) { model.add(prism([[0, .85], [.58, -.25], [.38, -.62], [-.38, -.62], [-.58, -.25]], .32, armor)); for (const side of [-1, 1]) model.add(prism([[side * .27, .58], [side * .7, .15], [side * .66, -.4], [side * .34, -.18]], .15, pale)); model.add(box(.14, .08, .7, eye, 0, .24, .05, .02));
    } else { model.add(mesh(new THREE.OctahedronGeometry(.54, 0), armor)); model.children[0].scale.set(.9, .55, 1.12); for (const side of [-1, 1]) model.add(box(.48, .1, .4, dark, side * .5, -.04, -.14, .04)); model.add(box(.24, .11, .12, eye, 0, .04, .49, .02)); }
    g.userData.model = model; g.userData.ownedMaterials = [armor, dark, pale, eye]; g.userData.materials = [armor, dark, pale]; g.userData.flash = 0; g.userData.hp = enemy.hp; for (const m of g.userData.materials) m.userData.baseEmissive = m.emissive.clone();
    const bar = this.healthBar(boss ? 3.5 : 1.15, boss ? 0xe7a28e : 0xd99287, boss ? 2.3 : 1); g.add(bar); g.userData.hpBar = bar; const ground = ring(boss ? 1.85 : turret ? .8 : .62, .025, 0xd68e82, .28, 40); ground.position.y = turret ? -.42 : -.59; g.add(ground); this.battle.add(g); return g;
  }
  makeObstacle(o) {
    const g = new THREE.Group(), w = Math.max(.2, o.w || 1), d = Math.max(.2, o.d || 1), h = this.missionId === 'm1' ? .88 : this.missionId === 'm3' ? 1.08 : .76;
    const armor = material(this.missionId === 'm1' ? 0x6f7c7a : this.missionId === 'm3' ? 0x666678 : 0x62717b, { roughness: .7 }), dark = material(0x2c3f4c, { roughness: .72 }), trim = material(this.theme.accent, { roughness: .62 });
    g.add(box(w, h, d, armor, 0, h / 2 - .02, 0, .06), box(Math.max(.15, w - .12), .08, Math.max(.15, d - .12), dark, 0, h + .02, 0, .015));
    if (w > d) { for (const s of [-1, 1]) g.add(box(.13, .06, Math.max(.14, d - .2), trim, s * Math.max(0, w / 2 - .25), h + .09, 0, .01)); if (this.missionId === 'm1') for (let x = -w / 2 + .4; x < w / 2 - .2; x += .6) g.add(box(.035, h * .65, .025, dark, x, h * .5, d / 2 + .015, .005)); } else for (const s of [-1, 1]) g.add(box(Math.max(.14, w - .2), .06, .13, trim, 0, h + .09, s * Math.max(0, d / 2 - .25), .01)); this.battle.add(g); return g;
  }
  makeHazard(h) {
    const g = new THREE.Group(), lane = ['charge', 'beam', 'laser'].includes(h.type); g.userData.kind = h.type;
    if (lane) { const w = Math.max(.25, h.width || 1.1), dx = Math.cos(h.angle || 0), dz = Math.sin(h.angle || 0), edgeX = Math.abs(dx) < .0001 ? Infinity : (dx > 0 ? W - h.x : -h.x) / dx, edgeZ = Math.abs(dz) < .0001 ? Infinity : (dz > 0 ? D - h.z : -h.z) / dz, length = Math.max(.2, Math.min(h.length || 10, edgeX, edgeZ)); const area = mesh(new THREE.PlaneGeometry(w, length), basic(0xe37368, .16), 0, .018, length / 2); area.rotation.x = -Math.PI / 2; area.castShadow = false; g.add(area); g.add(line([[-w / 2, .027, 0], [-w / 2, .027, length], [w / 2, .027, 0], [w / 2, .027, length], [-w / 2, .027, length], [w / 2, .027, length]], 0xee9a79, .85)); const marks = []; for (let z = .6; z < length; z += 1.5) marks.push([-w * .25, .03, z - .25], [0, .03, z], [0, .03, z], [w * .25, .03, z - .25]); g.add(line(marks, 0xf6b396, .6)); g.userData.fill = area;
    } else { const radius = Math.max(.3, h.radius || 2), area = ring(radius, radius, 0xe1736d, .12); area.position.y = .019; g.add(area); g.userData.fill = area; const border = ring(radius, .055, 0xeaa487, .86); border.position.y = .025; g.add(border); const progress = ring(Math.max(.1, radius - .13), .1, 0xf2bb8f, .75); progress.position.y = .027; g.add(progress); g.userData.progress = progress; g.add(line([[-.28, .03, 0], [.28, .03, 0], [0, .03, -.28], [0, .03, .28]], 0xeaaa8f, .65)); } this.battle.add(g); return g;
  }
  makeObjective(o, index) {
    const g = new THREE.Group(), radius = o.radius || 2.2, base = ring(radius, .055, 0x9aaac5, .55); base.position.y = .022; g.add(base); g.userData.base = base; const progress = ring(radius - .13, .12, 0x9de0db, .8, 96); progress.position.y = .024; g.add(progress); g.userData.progress = progress; const center = ring(.42, .06, 0xa7bccf, .72, 32); center.position.y = .026; g.add(center); g.userData.center = center; const label = textLabel(o.id || String(index + 1).padStart(2, '0'), '#d1dde5', .34); label.position.y = .9; g.add(label);
    const marks = []; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, x = Math.sin(a), z = Math.cos(a); marks.push([x * (radius + .1), .03, z * (radius + .1)], [x * (radius + .4), .03, z * (radius + .4)]); } g.add(line(marks, 0xa5b1ca, .65)); this.battle.add(g); return g;
  }
  setMenu(value) { this.menu = !!value; this.hudMeasureTimer = 0; this.hudInsets = this.measureHud(); this.fitCamera(); }
  setCharacter(character) { if (!character) return; try { this.characterColor.set(character.color || 0x80cfdd); } catch { this.characterColor.set(0x80cfdd); } this.trimMaterial.color.copy(this.characterColor).lerp(new THREE.Color(0xa9d4dc), .28); this.eyeMaterial.color.copy(this.characterColor).lerp(new THREE.Color(0xd9f5ef), .55); this.eyeMaterial.emissive.copy(this.characterColor).multiplyScalar(.5); }
  setQuality(low) { this.low = !!low; this.renderer.shadowMap.enabled = !this.low; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.low ? 1 : 1.75)); this.resize(); }
  cycleCamera() { this.cameraIndex = (this.cameraIndex + 1) % 3; const p = [{ name: '战术', a: 0, e: 1.02 }, { name: '等轴', a: .36, e: .91 }, { name: '俯视', a: 0, e: 1.48 }][this.cameraIndex]; this.cameraLabel = p.name; this.targetAzimuth = p.a; this.targetElevation = p.e; return this.cameraLabel; }
  orbit(dx, dy) { this.targetAzimuth = clamp(this.targetAzimuth - dx * .003, -.65, .65); this.targetElevation = clamp(this.targetElevation + dy * .004, .8, 1.48); this.cameraLabel = '自由'; }
  resize() { this.width = Math.max(1, this.canvas.clientWidth || innerWidth); this.height = Math.max(1, this.canvas.clientHeight || innerHeight); this.renderer.setSize(this.width, this.height, false); this.hudMeasureTimer = 0; this.hudInsets = this.measureHud(); this.fitCamera(); }
  // Measure rendered controls instead of duplicating CSS sizes; hidden boss bars
  // and touch controls must not shrink the battlefield. DOM reads are throttled.
  measureHud() {
    const w = this.width, h = this.height, mobile = w < 760, compact = h <= 500 && w > h;
    const inset = { left: mobile ? 8 : 30, right: mobile ? 8 : 30, top: compact ? 68 : mobile ? 133 : 110, bottom: compact ? 72 : mobile ? 178 : 116 };
    if (this.menu || typeof document.querySelectorAll !== 'function') return inset;
    const bounds = this.canvas.getBoundingClientRect?.() || { top: 0, left: 0, right: w, bottom: h };
    const visible = selector => [...document.querySelectorAll(selector)].filter(el => !el.hidden).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.bottom > bounds.top && r.top < bounds.bottom && r.right > bounds.left && r.left < bounds.right);
    const top = visible('.topbar, .battle-objective, .battle-status, .boss-hud');
    const bottom = visible('.combat-dock, .battle-help, .touch-controls, .footer');
    if (top.length) inset.top = clamp(Math.max(...top.map(r => r.bottom - bounds.top)) + 8, 0, h);
    if (bottom.length) inset.bottom = clamp(Math.max(...bottom.map(r => bounds.bottom - r.top)) + 8, 0, h);
    return inset;
  }
  fitCamera() {
    if (!this.fitCorners) return; const w = this.width, h = this.height, mobile = w < 760; this.camera.position.set(Math.sin(this.azimuth) * Math.cos(this.elevation) * 60, Math.sin(this.elevation) * 60, Math.cos(this.azimuth) * Math.cos(this.elevation) * 60); this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld();
    let { left, right, top, bottom } = this.hudInsets || this.measureHud(); if (this.menu) { top = 40; bottom = 40; }
    const safeW = Math.max(24, w - left - right), safeH = Math.max(24, h - top - bottom); let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of this.fitCorners) { const p = c.clone().applyMatrix4(this.camera.matrixWorldInverse); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const units = Math.max((maxX - minX) / safeW, (maxY - minY) / safeH) * 1.018, hw = w * units / 2, hh = h * units / 2, cx = (minX + maxX) / 2 + (w / 2 - left - safeW / 2) * units, cy = (minY + maxY) / 2 + (top + safeH / 2 - h / 2) * units;
    this.camera.left = cx - hw; this.camera.right = cx + hw; this.camera.top = cy + hh; this.camera.bottom = cy - hh; this.camera.updateProjectionMatrix(); this.safeArea = { left, right, top, bottom };
  }
  updatePlayer(game, dt) {
    const p = this.menu ? { x: W / 2, z: D / 2, facingX: .5, facingZ: 1 } : game.player || game.snake?.[0]; if (!p) { this.head.visible = false; for (const d of this.drones) d.visible = false; this.playerRing.visible = this.shieldRing.visible = false; return; }
    this.head.visible = this.playerRing.visible = true; this.head.position.copy(toWorld(p)); this.lastHead.copy(this.head.position); const fx = Number.isFinite(p.facingX) ? p.facingX : 0, fz = Number.isFinite(p.facingZ) ? p.facingZ : 1; if (Math.hypot(fx, fz) > .01) this.head.rotation.y = Math.atan2(fx, fz);
    this.playerRing.position.set(this.head.position.x, .022, this.head.position.z); this.shieldRing.position.set(this.head.position.x, .028, this.head.position.z); this.shieldRing.visible = (game.shield || 0) > 0; const dashing = !this.menu && (game.dashRemaining || 0) > 0;
    for (const part of this.playerModel.children) if (part.userData.thruster) part.scale.z = dashing ? 2.8 : 1; this.bodyMaterial.emissive.set((game.invulnerable || 0) > 0 && !dashing ? 0x282326 : 0x000000); this.bodyMaterial.emissiveIntensity = .45; this.shieldRing.material.opacity = dashing ? .75 : .3;
    for (let i = 0; i < this.drones.length; i++) { const drone = this.drones[i], point = !this.menu ? game.snake?.[i + 1] : null; drone.visible = true; if (point) drone.position.copy(toWorld(point, .56)); else { const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), offset = new THREE.Vector3(side * (1.3 + row * .45), 0, -.95 - row * .8).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.head.rotation.y); drone.position.copy(this.head.position).add(offset); } drone.rotation.y = this.head.rotation.y; }
    if (dashing && !this.reduced) { this.dashTrailTimer -= dt; if (this.dashTrailTimer <= 0) { this.spawnGhost(); this.dashTrailTimer = .045; } } else this.dashTrailTimer = 0;
  }
  syncMap(map, items, make, update) {
    const ids = new Set(items.map((o, i) => o.id ?? `${i}/${o.x}/${o.z}`)); for (const [id, object] of map) if (!ids.has(id)) { this.battle.remove(object); disposeNode(object); map.delete(id); } items.forEach((data, i) => { const id = data.id ?? `${i}/${data.x}/${data.z}`; let o = map.get(id); if (!o) { o = make(data, i); map.set(id, o); } update(o, data, i); });
  }
  syncObjects(game, dt) {
    const active = !this.menu; this.syncMap(this.foodMeshes, active ? game.food || [] : [], f => this.makeFood(f), (o, f, i) => { o.position.copy(toWorld(f, .42 + (this.reduced ? 0 : Math.sin(this.t * 1.8 + i) * .035))); if (!this.reduced && f.type !== 'heal') o.children[0].rotation.y += dt * .6; });
    const enemies = active ? [...(game.enemies || [])] : []; if (active && game.boss && !enemies.some(e => e.id === game.boss.id || e.type === 'boss')) enemies.push({ ...game.boss, type: 'boss' });
    this.syncMap(this.enemyMeshes, enemies, e => this.makeEnemy(e), (o, e) => { o.position.copy(toWorld(e, e.type === 'turret' ? .45 : .62)); if (Number.isFinite(e.facingX) && Number.isFinite(e.facingZ)) o.userData.model.rotation.y = Math.atan2(e.facingX, e.facingZ); if (e.hp < o.userData.hp) o.userData.flash = .1; o.userData.hp = e.hp; o.userData.flash = Math.max(0, o.userData.flash - dt); for (const m of o.userData.materials) { m.emissive.copy(o.userData.flash > 0 ? new THREE.Color(0xbfd6d3) : (e.frozen || 0) > 0 ? new THREE.Color(0x153749) : m.userData.baseEmissive); m.emissiveIntensity = o.userData.flash > 0 ? .85 : .35; } this.updateBar(o.userData.hpBar, e.hp / (e.maxHp || 1)); o.userData.hpBar.visible = e.type === 'boss' || e.hp < e.maxHp; if (o.userData.crown && !this.reduced) o.userData.crown.rotation.z += dt * .22; });
    this.syncMap(this.obstacleMeshes, active ? game.obstacles || [] : [], o => this.makeObstacle(o), (o, d) => { o.position.copy(toWorld(d, 0)); });
    this.syncMap(this.hazardMeshes, active ? game.hazards || [] : [], h => this.makeHazard(h), (o, h) => { o.position.copy(toWorld(h, 0)); if (['charge', 'beam', 'laser'].includes(h.type)) o.rotation.y = Math.PI / 2 - (h.angle || 0); const urgency = 1 - clamp((h.remaining || 0) / (h.duration || 1), 0, 1); o.userData.fill.material.opacity = .1 + urgency * .11; if (o.userData.progress) o.userData.progress.geometry.setDrawRange(0, Math.max(0, Math.floor(64 * urgency)) * 6); });
    this.syncMap(this.objectiveMeshes, active ? game.objectives || [] : [], (o, i) => this.makeObjective(o, i), (o, d) => { o.position.copy(toWorld(d, 0)); o.userData.progress.geometry.setDrawRange(0, Math.floor(clamp(d.progress || 0, 0, 1) * 96) * 6); o.userData.base.material.color.set(d.contested && d.active ? 0xe3a08e : d.complete ? 0x9fdfbf : 0xa6bbd5); o.userData.base.material.opacity = d.active ? .88 : d.complete ? .5 : .23; o.userData.center.material.color.set(d.complete ? 0x9fdfbf : d.active ? 0xcde4e5 : 0x7d8b9a); o.userData.progress.material.color.set(d.complete ? 0x9fdfbf : 0x9de0db); });
    this.syncProjectiles(active ? game.projectiles || [] : [], active ? game.shots || [] : []); this.updatePayload(active ? game.payload : null);
  }
  syncProjectiles(projectiles, shots) {
    const count = Math.min(projectiles.length, this.projectileCapacity);
    for (let i = 0; i < count; i++) { const p = projectiles[i], v = Math.hypot(p.vx || 0, p.vz || 0), dx = v ? p.vx / v : 0, dz = v ? p.vz / v : 1, pos = toWorld(p, .63), radius = Math.max(.115, p.radius || .13), color = new THREE.Color(p.hostile ? 0xff9c7d : 0xbaf8f3); this.dummy.position.copy(pos); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(radius, radius * .7, radius); this.dummy.updateMatrix(); this.bulletCores.setMatrixAt(i, this.dummy.matrix); this.bulletCores.setColorAt(i, color); const length = p.hostile ? .38 : .62; this.dummy.position.set(pos.x - dx * length / 2, pos.y, pos.z - dz * length / 2); this.dummy.rotation.set(0, Math.atan2(dx, dz), 0); this.dummy.scale.set(radius * .8, .055, length); this.dummy.updateMatrix(); this.bulletTails.setMatrixAt(i, this.dummy.matrix); this.bulletTails.setColorAt(i, new THREE.Color(p.hostile ? 0xec635c : 0x61bfca)); }
    for (const m of [this.bulletCores, this.bulletTails]) { m.count = count; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    let n = 0; const attrs = this.shotGeometry.attributes; for (const s of shots) { if (!s.from || !s.to || n >= 128) continue; const a = toWorld(s.from, .67), b = toWorld(s.to, .67), c = new THREE.Color(s.color || 0xb7dce6); c.multiplyScalar(clamp((s.life ?? .1) / (s.maxLife || .2), .25, 1)); attrs.position.setXYZ(n * 2, a.x, a.y, a.z); attrs.position.setXYZ(n * 2 + 1, b.x, b.y, b.z); attrs.color.setXYZ(n * 2, c.r, c.g, c.b); attrs.color.setXYZ(n * 2 + 1, c.r, c.g, c.b); n++; } this.shotGeometry.setDrawRange(0, n * 2); attrs.position.needsUpdate = attrs.color.needsUpdate = true;
  }
  updatePayload(payload) {
    this.payloadMesh.visible = this.escortRing.visible = !!payload; this.routeGroup.visible = !!payload; if (!payload) return; this.payloadMesh.position.copy(toWorld(payload, .65)); this.escortRing.position.copy(toWorld(payload, .02)); this.escortRing.scale.setScalar((payload.escortRadius || 3.6) / 3.6); this.escortRing.material.opacity = payload.moving ? .46 : .24; this.updateBar(this.payloadMesh.userData.hpBar, payload.hp / (payload.maxHp || 1));
    const route = payload.route || [], target = route[payload.routeIndex ?? 1]; if (target && Math.hypot(target.x - payload.x, target.z - payload.z) > .02) this.payloadModel.rotation.y = Math.atan2(target.x - payload.x, target.z - payload.z); const key = route.map(p => `${p.x},${p.z}`).join('/'); if (this.routeKey === key) return; this.routeKey = key;
    for (const c of [...this.routeGroup.children]) { this.routeGroup.remove(c); disposeNode(c); } const segments = []; for (let i = 1; i < route.length; i++) { const a = toWorld(route[i - 1], -.008), b = toWorld(route[i], -.008), length = a.distanceTo(b), dir = b.clone().sub(a).normalize(); for (let d = 0; d < length; d += 1.1) { const start = a.clone().addScaledVector(dir, d), end = a.clone().addScaledVector(dir, Math.min(d + .5, length)); segments.push(start.toArray(), end.toArray()); } const marker = ring(i === route.length - 1 ? 1.3 : .42, .045, 0x97bfbc, .52, 40); marker.position.copy(b); marker.position.y = -.006; this.routeGroup.add(marker); } this.routeGroup.add(line(segments, 0xa5d0c7, .5));
  }
  spawnGhost() { const g = this.ghosts[this.ghostCursor++ % this.ghosts.length]; g.life = .24; g.mesh.visible = true; g.mesh.position.copy(this.lastHead); g.mesh.rotation.y = this.head.rotation.y; g.mesh.material.opacity = .18; }
  effect(name, data = {}) {
    if (this.menu || this.dead) return; const p = data.position || data.at || data, position = Number.isFinite(p?.x) && Number.isFinite(p?.z) ? toWorld(p, .6) : this.lastHead.clone(), color = new THREE.Color(['damage', 'impact'].includes(name) ? 0xe79b87 : name === 'kill' ? 0xd5b297 : name === 'eat' ? 0x99c6d1 : name === 'won' ? 0xe7cd94 : 0x92d9e0), heavy = ['skill', 'support', 'won'].includes(name), count = this.reduced ? 0 : Math.min(this.low ? 12 : 30, name === 'hit' ? 3 : name === 'eat' ? 5 : name === 'damage' ? 8 : name === 'impact' ? 12 : heavy ? 28 : 15);
    for (let i = 0; i < count; i++) { const p = this.particles[this.particleCursor++ % this.particles.length], a = Math.random() * TAU, speed = (heavy ? 3.8 : 2.3) * (.35 + Math.random() * .65); p.life = p.maxLife = .25 + Math.random() * .4; p.p.copy(position); p.v.set(Math.cos(a) * speed, .8 + Math.random() * 2.4, Math.sin(a) * speed); p.color.copy(color); p.size = name === 'kill' ? .065 + Math.random() * .09 : .045 + Math.random() * .05; }
    if (['skill', 'support', 'won', 'damage', 'dash', 'impact'].includes(name)) { const m = ring(1, name === 'damage' ? .04 : .035, color, .65); m.position.set(position.x, .06, position.z); this.battle.add(m); const radius = name === 'skill' ? Math.min(6.5, data.radius || 4.7) : name === 'support' ? 5.5 : name === 'won' ? 7 : name === 'impact' ? Math.min(4, data.radius || 2.1) : 1.4; this.ripples.push({ mesh: m, life: this.reduced ? .2 : .55, maxLife: this.reduced ? .2 : .55, radius }); if (this.ripples.length > 8) { const old = this.ripples.shift(); this.battle.remove(old.mesh); disposeNode(old.mesh); } }
    if (heavy && !this.low) { this.effectTimer = .3; this.skillLight.position.copy(position).add(new THREE.Vector3(0, 1.5, 0)); } if (name === 'dash' && !this.reduced) this.spawnGhost();
  }
  updateEffects(dt) {
    this.effectTimer = Math.max(0, this.effectTimer - dt); this.skillLight.intensity = this.effectTimer * 16;
    for (let i = 0; i < this.particles.length; i++) { const p = this.particles[i]; p.life = Math.max(0, p.life - dt); if (p.life > 0) { p.v.y -= dt * 7; p.p.addScaledVector(p.v, dt); if (p.p.y < .06) { p.p.y = .06; p.v.y *= -.22; } this.dummy.position.copy(p.p); this.dummy.rotation.set(this.t * 3 + i, this.t * 4 - i, i); this.dummy.scale.setScalar(p.size * clamp(p.life / p.maxLife * 2, 0, 1)); this.particleMesh.setColorAt(i, p.color); } else { this.dummy.position.set(0, -20, 0); this.dummy.scale.setScalar(0); } this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix); } this.particleMesh.instanceMatrix.needsUpdate = true; if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    for (const r of [...this.ripples]) { r.life -= dt; if (r.life <= 0) { this.battle.remove(r.mesh); disposeNode(r.mesh); this.ripples.splice(this.ripples.indexOf(r), 1); continue; } const t = 1 - r.life / r.maxLife; r.mesh.scale.setScalar(.65 + t * r.radius); r.mesh.material.opacity = .52 * (1 - t); } for (const g of this.ghosts) { g.life = Math.max(0, g.life - dt); g.mesh.visible = g.life > 0; g.mesh.material.opacity = .18 * g.life / .24; }
  }
  clearDynamic() {
    for (const map of [this.foodMeshes, this.enemyMeshes, this.obstacleMeshes, this.hazardMeshes, this.objectiveMeshes]) { for (const o of map.values()) { this.battle.remove(o); disposeNode(o); } map.clear(); } for (const r of this.ripples || []) { this.battle.remove(r.mesh); disposeNode(r.mesh); } this.ripples = []; for (const p of this.particles || []) p.life = 0; for (const g of this.ghosts || []) { g.life = 0; g.mesh.visible = false; } if (this.bulletCores) this.bulletCores.count = this.bulletTails.count = 0; if (this.shotGeometry) this.shotGeometry.setDrawRange(0, 0);
  }
  render(dt, game = {}) {
    if (this.dead) return; dt = Math.min(.06, Math.max(0, dt || 0)); this.t += dt; const missionId = game.missionId || game.mission?.id; if (missionId && missionId !== this.missionId) this.setMission(game.mission || missionId); this.azimuth += (this.targetAzimuth - this.azimuth) * Math.min(1, dt * 9); this.elevation += (this.targetElevation - this.elevation) * Math.min(1, dt * 9); this.hudMeasureTimer = (this.hudMeasureTimer || 0) - dt; if (this.hudMeasureTimer <= 0) { this.hudInsets = this.measureHud(); this.hudMeasureTimer = .25; } this.fitCamera(); this.updatePlayer(game, dt); this.syncObjects(game, dt); this.updateEffects(dt); this.renderer.render(this.scene, this.camera);
  }
  dispose() { if (this.dead) return; this.dead = true; window.removeEventListener('resize', this.resizeHandler); this.canvas.removeEventListener('webglcontextlost', this.contextLost); disposeNode(this.scene); this.renderer.dispose(); }
}
