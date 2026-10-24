import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SnakeGame,WORLD,MISSIONS} from '../dist/engine.js';

// Exercise the real Three geometry and game renderer without creating a browser,
// GPU context or screenshots. Only the WebGL output and canvas text are stubbed.
class HeadlessRenderer {
  constructor(){this.shadowMap={};}
  setPixelRatio(){}
  setClearColor(){}
  setSize(){}
  render(scene){scene.updateMatrixWorld(true);}
  dispose(){}
}
const sceneSource=await readFile(new URL('../dist/scene.js',import.meta.url),'utf8');
const loadArena=new Function('THREE','RoundedBoxGeometry','WORLD','matchMedia','document','window','devicePixelRatio',
  sceneSource.replace(/^import .+;\r?$/gm,'').replace('export class Arena','return class Arena'));
const seeded=seed=>()=>{let n=seed+=0x6D2B79F5;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
function makeArena(t){
  const canvas={clientWidth:1440,clientHeight:900,addEventListener(){},removeEventListener(){}};
  const hud=new Map();
  const document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})}),
    querySelectorAll:selectors=>selectors.split(',').flatMap(selector=>hud.get(selector.trim())||[])};
  const Arena=loadArena({...THREE,WebGLRenderer:HeadlessRenderer},RoundedBoxGeometry,WORLD,
    ()=>({matches:false}),document,{addEventListener(){},removeEventListener(){}},1);
  const arena=new Arena(canvas);arena.setMenu(false);t.after(()=>arena.dispose());return {arena,canvas,hud};
}
function finiteGeometry(scene){
  let count=0;
  scene.traverse(object=>{
    if(!object.geometry)return;count++;
    for(const [name,attribute] of Object.entries(object.geometry.attributes))
      for(const n of attribute.array)assert.ok(Number.isFinite(n),`${object.type}.${name} contains a non-finite value`);
    if(object.geometry.index){
      const positions=object.geometry.attributes.position.count;
      for(const index of object.geometry.index.array)assert.ok(index<positions,'geometry index exceeds vertex count');
    }
    for(const n of object.matrixWorld.elements)assert.ok(Number.isFinite(n),'world transform contains a non-finite value');
  });
  return count;
}

test('all mission stages and every actor silhouette produce finite valid geometry',t=>{
  const {arena}=makeArena(t),palettes=new Set();let geometryCount=0;
  for(const mission of MISSIONS){
    const game=new SnakeGame({random:seeded(42)});game.reset({mission:mission.id});
    game.enemies=['scout','gunner','charger','turret','boss'].map((type,i)=>({id:type,type,x:8+i*4,z:8,hp:50,maxHp:100,facingX:0,facingZ:1}));
    game.boss=game.enemies.at(-1); // The optional boss reference must not duplicate its model.
    game.food=['xp','heal','gold','chrono'].map((type,i)=>({id:type,type,x:5+i*2,z:16}));
    game.hazards=[{id:'circle',type:'blast',x:16,z:12,radius:2.1,duration:1.6,remaining:.8},
      {id:'lane',type:'charge',x:7,z:8,length:8,width:1.3,angle:.4,duration:.85,remaining:.5},
      {id:'beam',type:'beam',x:24,z:10,length:24,width:1.7,angle:Math.PI,duration:1.45,remaining:.5}];
    arena.setMission(mission);arena.render(1/60,game);
    assert.equal(arena.missionId,mission.id);assert.equal(arena.enemyMeshes.size,5);assert.equal(arena.drones.length,4);
    assert.equal(arena.obstacleMeshes.size,game.obstacles.length);
    assert.equal(arena.objectiveMeshes.size,game.objectives.length);assert.equal(arena.payloadMesh.visible,!!game.payload);
    palettes.add(arena.theme.floor);geometryCount+=finiteGeometry(arena.scene);
    const obstacle=game.obstacles[0];
    if(obstacle){
      const object=arena.obstacleMeshes.get(obstacle.id),bounds=new THREE.Box3().setFromObject(object);
      assert.ok(Math.abs(bounds.max.x-bounds.min.x-obstacle.w)<.15,'rendered cover width must match its collider');
      assert.ok(Math.abs(bounds.max.z-bounds.min.z-obstacle.d)<.15,'rendered cover depth must match its collider');
    }
    const lane=arena.hazardMeshes.get('lane');
    const direction=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),lane.rotation.y);
    assert.ok(Math.abs(direction.x-Math.cos(.4))<1e-9,'charge warning must follow engine atan2(dz, dx)');
    assert.ok(Math.abs(direction.z-Math.sin(.4))<1e-9);
  }
  assert.equal(palettes.size,4,'missions need distinct ground palettes');assert.ok(geometryCount>500);
});

test('battlefield avoids measured visible HUD through desktop, phone and landscape camera changes',t=>{
  const {arena,canvas,hud}=makeArena(t);
  // Bounds include the playable surface, actor overhang and boss upper shell,
  // independently of the camera fitting implementation's chosen corners.
  const bounds=[];
  for(const x of [-WORLD.x/2-.3,WORLD.x/2+.3])for(const y of [0,2.5])for(const z of [-WORLD.z/2-.3,WORLD.z/2+.3])bounds.push(new THREE.Vector3(x,y,z));
  const viewports=[[390,844],[428,926],[667,375],[844,390],[768,1024],[1280,720],[1440,900],[1920,1080]];
  for(const [width,height] of viewports){
    const compact=height<=500,mobile=width<760;
    // Rectangles model the actual topbar/objective/status/boss and dock/footer
    // layout. Their sizes can change without changing projection mathematics.
    const top=compact?60:mobile?125:102,bottom=compact?64:mobile?170:108;
    const rect=(y,h)=>({left:0,right:width,top:y,bottom:y+h,width,height:h});
    const element=(bounds,hidden=false)=>({hidden,getBoundingClientRect:()=>bounds});
    hud.set('.topbar',[element(rect(0,compact?35:mobile?52:64))]);
    hud.set('.battle-objective',[element(compact?rect(4,27):mobile?rect(58,44):rect(8,50))]);
    hud.set('.battle-status',[element(rect(top-24,24))]);
    hud.set('.combat-dock',[element(rect(height-bottom,bottom-(compact?0:28)))]);
    hud.set('.footer',compact?[]:[element(rect(height-28,28))]);
    // A hidden boss bar would take most of this view if visibility were ignored.
    hud.set('.boss-hud',[element(rect(height/2,50),true)]);
    hud.set('.touch-controls',[element(rect(0,0))]);
    canvas.clientWidth=width;canvas.clientHeight=height;arena.resize();
    const safe={left:mobile?8:30,right:mobile?8:30,top,bottom};
    assert.equal(arena.safeArea.top,top+8,'visible HUD has a small separation margin');
    assert.equal(arena.safeArea.bottom,bottom+8);
    for(let view=0;view<5;view++){
      if(view<3)arena.cycleCamera();else arena.orbit(view===3?10000:-10000,-10000);
      arena.azimuth=arena.targetAzimuth;arena.elevation=arena.targetElevation;arena.fitCamera();
      for(const corner of bounds){
        const p=corner.clone().project(arena.camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
        assert.ok(x>=safe.left&&x<=width-safe.right,`${width}x${height} view ${view} clips the battlefield horizontally`);
        assert.ok(y>=safe.top&&y<=height-safe.bottom,`${width}x${height} view ${view} overlaps the combat HUD`);
        assert.ok(p.z>=-1&&p.z<=1,'camera depth range must contain the battlefield');
      }
    }
    // Showing a boss bar must trigger a fresh fit without waiting for resize.
    const boss=compact?rect(37,24):mobile?rect(130,24):rect(74,36);
    hud.set('.boss-hud',[element(boss)]);
    for(let frame=0;frame<16;frame++)arena.render(1/60,{});
    assert.equal(arena.safeArea.top,Math.max(top,boss.bottom)+8);
    for(const corner of bounds){const p=corner.clone().project(arena.camera);assert.ok((1-p.y)*height/2>boss.bottom,'new boss bar overlaps the battlefield');}
  }
});

test('real engine frames keep visible actors, bullets, payload and controls synchronized',t=>{
  const {arena}=makeArena(t);let frames=0,playingFrames=0,bulletsSeen=0;
  const effects=new Set(['eat','damage','kill','skill','won','dash','support','impact','hit']);
  for(const mission of MISSIONS){
    const game=new SnakeGame({random:seeded(17),onEvent:(name,data)=>{if(effects.has(name))arena.effect(name,data);}});
    game.reset({mission:mission.id,stats:{maxHp:100000,attack:9,shield:10000}});
    if(game.payload)game.payload.hp=game.payload.maxHp=100000;
    game.start();arena.setMission(mission);
    for(let frame=0;frame<900;frame++){
      if(game.status==='choosing')game.chooseUpgrade(game.choices[0].id);
      if(frame%60===0)game.setMove(Math.cos(frame*.012),Math.sin(frame*.012));
      if(frame%150===0)game.dash();
      game.update(1/60);arena.render(1/60,game);frames++;
      if(game.status==='playing')playingFrames++;
      assert.equal(arena.head.position.x,game.player.x-WORLD.x/2,'player model must not interpolate behind gameplay');
      assert.equal(arena.head.position.z,game.player.z-WORLD.z/2);
      assert.equal(arena.enemyMeshes.size,game.enemies.length);assert.equal(arena.foodMeshes.size,game.food.length);
      assert.equal(arena.hazardMeshes.size,game.hazards.length);
      assert.equal(arena.bulletCores.count,Math.min(game.projectiles.length,arena.projectileCapacity));
      bulletsSeen+=game.projectiles.length;
      if(game.payload){
        assert.equal(arena.payloadMesh.position.x,game.payload.x-WORLD.x/2);
        assert.equal(arena.payloadMesh.position.z,game.payload.z-WORLD.z/2);
        assert.equal(arena.payloadMesh.rotation.y,0,'payload heading must not rotate its health bar');
      }
    }
    finiteGeometry(arena.scene);
  }
  assert.equal(frames,3600);assert.ok(playingFrames>3000,'integration run must exercise active simulation');assert.ok(bulletsSeen>50);
  // End-of-run/menu changes cannot leave combat geometry or transient effects behind.
  for(const name of effects)arena.effect(name,{x:16,z:12});
  for(let frame=0;frame<90;frame++)arena.updateEffects(1/60);
  assert.equal(arena.ripples.length,0);assert.ok(arena.ghosts.every(g=>g.life===0));
  arena.setMenu(true);arena.render(1/60,{});
  assert.equal(arena.enemyMeshes.size,0);assert.equal(arena.hazardMeshes.size,0);assert.equal(arena.bulletCores.count,0);
  assert.equal(arena.payloadMesh.visible,false);assert.equal(arena.routeGroup.visible,false);
});
