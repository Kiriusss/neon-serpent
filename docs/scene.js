import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SIZE } from './engine.js';

const C={mint:0x81ffd4,cyan:0x1be8ed,pink:0xff3b9f,gold:0xffd16a,blue:0x708bff};
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const world=(v)=>v-(SIZE-1)/2;
function neon(color,intensity=2){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.3,metalness:.35});}
function line(points,color,opacity=1){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}

export class Arena {
  constructor(canvas,{onFailure=()=>{}}={}) {
    this.canvas=canvas;this.onFailure=onFailure;this.t=0;this.menu=true;this.topView=false;
    this.low=matchMedia('(prefers-reduced-motion: reduce)').matches;this.reduced=this.low;
    this.pointer=new THREE.Vector2();this.shake=0;this.flash=0;this.foodMeshes=new Map();
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.low?1:1.6));
    this.renderer.setClearColor(0x060a12);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x060a12,.008);
    this.camera=new THREE.PerspectiveCamera(43,1,.1,350);this.camera.position.set(29,33,42);
    this.look=new THREE.Vector3(-6,0,0);this.camera.lookAt(this.look);
    this.fitCamera=new THREE.PerspectiveCamera(43,1,.1,350);
    this.fitCorners=[[-13,0,-13],[13,0,-13],[-13,0,13],[13,0,13]].map(p=>new THREE.Vector3(...p));
    this.scene.add(new THREE.HemisphereLight(0xadcfff,0x0a1728,2));
    const light=new THREE.DirectionalLight(0xb5fff1,3);light.position.set(-10,30,15);this.scene.add(light);
    const rim=new THREE.DirectionalLight(0x5078ff,2);rim.position.set(20,8,-20);this.scene.add(rim);
    this.headLight=new THREE.PointLight(C.mint,24,8,2);this.scene.add(this.headLight);
    this.buildStage();this.buildBackground();this.buildSnake();this.buildParticles();
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.9,.5,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.resize();this.onResize=()=>this.resize();window.addEventListener('resize',this.onResize);
    this.contextLost=(e)=>{e.preventDefault();onFailure('图形上下文暂时中断，请刷新页面重新连接。');};
    canvas.addEventListener('webglcontextlost',this.contextLost);
  }
  buildStage(){
    this.stage=new THREE.Group();this.scene.add(this.stage);
    const base=new THREE.Mesh(new RoundedBoxGeometry(26,1.1,26,3,.45),new THREE.MeshStandardMaterial({color:0x0d1c2a,metalness:.8,roughness:.3}));base.position.y=-.85;this.stage.add(base);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(24.3,.2,24.3),new THREE.MeshStandardMaterial({color:0x101c29,metalness:.65,roughness:.4}));deck.position.y=-.16;this.stage.add(deck);
    const gridPoints=[];
    for(let i=0;i<=SIZE;i++){const p=i-SIZE/2;gridPoints.push(p,0,-12,p,0,12,-12,0,p,12,0,p);}
    const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));
    this.grid=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x267183,transparent:true,opacity:.28}));this.stage.add(this.grid);
    this.edgeMaterial=neon(C.cyan,2.3);
    this.edges=[];
    for(const [x,z,w,d] of [[0,-12.25,24.5,.045],[0,12.25,24.5,.045],[-12.25,0,.045,24.5],[12.25,0,.045,24.5]]){
      const edge=new THREE.Mesh(new THREE.BoxGeometry(w,.075,d),this.edgeMaterial);edge.position.set(x,.02,z);this.stage.add(edge);this.edges.push(edge);
      const under=new THREE.Mesh(new THREE.BoxGeometry(w,.045,d),neon(C.cyan,1.5));under.position.set(x,-1.17,z);this.stage.add(under);
    }
    // Armor clamps and calibrated tick marks make the board read as a physical machine.
    const clampMat=new THREE.MeshStandardMaterial({color:0x38505e,metalness:.85,roughness:.25});
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const bracket=new THREE.Mesh(new RoundedBoxGeometry(2,.38,2,2,.18),clampMat);bracket.position.set(sx*12.2,-.18,sz*12.2);this.stage.add(bracket);
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.8,.08,.11),neon(C.mint,2));lamp.position.set(sx*12.2,.04,sz*12.4);this.stage.add(lamp);
    }
    for(let i=-10;i<=10;i++)for(const side of [-1,1]){
      const tick=new THREE.Mesh(new THREE.BoxGeometry(i%5===0?.06:.025,.02,i%5===0?.4:.2),new THREE.MeshBasicMaterial({color:i%5===0?0x7ec8cc:0x315862}));tick.position.set(i,.035,side*12.65);this.stage.add(tick);
    }
    const circles=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;circles.push([Math.cos(a)*8,-2.4,Math.sin(a)*8]);}
    this.reactor=line(circles,0x248a8c,.5);this.stage.add(this.reactor);
    const reactor2=this.reactor.clone();reactor2.scale.set(1.2,1,1.2);reactor2.position.y=-.35;this.stage.add(reactor2);
    this.centerRing=new THREE.Mesh(new THREE.RingGeometry(3.8,3.82,100),new THREE.MeshBasicMaterial({color:0x29616c,side:THREE.DoubleSide,transparent:true,opacity:.25}));this.centerRing.rotation.x=-Math.PI/2;this.centerRing.position.y=.015;this.stage.add(this.centerRing);
    const cross=line([[-.6,.025,0],[.6,.025,0]],0x3c8e91,.45);this.stage.add(cross);const cross2=cross.clone();cross2.rotation.y=Math.PI/2;this.stage.add(cross2);
  }
  buildBackground(){
    const positions=[],colors=[];
    for(let i=0;i<1800;i++){positions.push((Math.random()-.5)*260,Math.random()*130-40,(Math.random()-.6)*260);const c=new THREE.Color().setHSL(.46+Math.random()*.2,.35,.25+Math.random()*.4);colors.push(c.r,c.g,c.b);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.stars=new THREE.Points(geo,new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true,depthWrite:false}));this.scene.add(this.stars);
    this.portal=new THREE.Group();this.portal.position.set(0,5,-27);this.portal.rotation.x=.1;this.portal.rotation.y=-.12;this.scene.add(this.portal);
    const outer=new THREE.Mesh(new THREE.TorusGeometry(13,.09,8,180),neon(0x264d68,.8));this.portal.add(outer);
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(12.6,.025,8,180,Math.PI*1.35),neon(C.cyan,2.7));ring1.rotation.z=.4;this.portal.add(ring1);
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(12.3,.018,6,180,Math.PI*.65),neon(C.pink,2));ring2.rotation.z=3;this.portal.add(ring2);
    this.portalRings=[ring1,ring2];
    for(let i=0;i<60;i++){const a=i/60*Math.PI*2;const tick=new THREE.Mesh(new THREE.BoxGeometry(.025,i%5===0?.5:.18,.025),neon(i%5===0?C.cyan:0x27485a,i%5===0?1.4:.3));tick.position.set(Math.sin(a)*13.4,Math.cos(a)*13.4,0);tick.rotation.z=-a;this.portal.add(tick);}
    // Distant monoliths: a quiet cyber skyline beneath the arena.
    this.monoliths=new THREE.Group();this.scene.add(this.monoliths);
    const mat=new THREE.MeshStandardMaterial({color:0x0b1524,metalness:.7,roughness:.4});
    for(let i=0;i<34;i++){const angle=i/34*Math.PI*2,rad=32+Math.random()*18,h=2+Math.random()*16;const x=Math.cos(angle)*rad,z=Math.sin(angle)*rad;
      const block=new THREE.Mesh(new THREE.BoxGeometry(1+Math.random()*2,h,1+Math.random()*2),mat);block.position.set(x,-15+h/2,z);this.monoliths.add(block);
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.025,h*.75,.035),neon(i%4===0?C.pink:0x22889a,1));strip.position.set(x-.45,-15+h*.6,z+.65);this.monoliths.add(strip);
    }
    const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=64;const ctx=dustCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.15,'rgba(255,255,255,.4)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    this.glowTexture=new THREE.CanvasTexture(dustCanvas);
    for(const [x,y,z,color,s] of [[0,-6,0,0x08475d,65],[8,8,-30,0x13266b,85],[-24,0,-14,0x073a46,50]]){
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowTexture,color,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));halo.position.set(x,y,z);halo.scale.set(s,s,1);this.scene.add(halo);
    }
    this.orbit=new THREE.Group();this.scene.add(this.orbit);
    const orbitPoints=[];for(let i=0;i<240;i++){const a=i/239*Math.PI*2;orbitPoints.push([Math.cos(a)*21,-3,Math.sin(a)*21]);}this.orbit.add(line(orbitPoints,0x164152,.35));
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2;const moon=new THREE.Mesh(new THREE.OctahedronGeometry(.18),neon(i===1?C.pink:C.cyan,2));moon.position.set(Math.cos(a)*21,-3,Math.sin(a)*21);this.orbit.add(moon);}
  }
  buildSnake(){
    this.bodyMaterial=new THREE.MeshStandardMaterial({color:0x3a9a89,emissive:0x123e35,emissiveIntensity:.55,metalness:.7,roughness:.24});
    this.body=new THREE.InstancedMesh(new RoundedBoxGeometry(.89,.55,.89,2,.15),this.bodyMaterial,SIZE*SIZE);this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.body.frustumCulled=false;this.scene.add(this.body);
    this.coreMaterial=neon(C.mint,2.3);
    this.cores=new THREE.InstancedMesh(new RoundedBoxGeometry(.5,.055,.56,1,.05),this.coreMaterial,SIZE*SIZE);this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.cores.frustumCulled=false;this.scene.add(this.cores);
    this.shadow=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5,1.5),new THREE.MeshBasicMaterial({map:this.glowTexture,color:0x33bda4,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending}),SIZE*SIZE);this.shadow.frustumCulled=false;this.scene.add(this.shadow);
    this.head=new THREE.Group();this.scene.add(this.head);
    const skull=new THREE.Mesh(new RoundedBoxGeometry(.95,.68,1.05,3,.2),new THREE.MeshStandardMaterial({color:0xb0e5c9,emissive:0x2d5c45,emissiveIntensity:.35,metalness:.6,roughness:.23}));this.head.add(skull);
    const visor=new THREE.Mesh(new RoundedBoxGeometry(.8,.2,.14,2,.06),new THREE.MeshStandardMaterial({color:0x081822,metalness:.8,roughness:.1}));visor.position.set(0,.11,.48);this.head.add(visor);
    for(const x of [-.24,.24]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.16,.07,.04),neon(0xdbffda,4));eye.position.set(x,.12,.56);this.head.add(eye);}
    const headCore=new THREE.Mesh(new THREE.BoxGeometry(.14,.035,.42),neon(C.mint,3));headCore.position.set(0,.352,-.08);this.head.add(headCore);
    this.dummy=new THREE.Object3D();this.headAngle=Math.PI/2;
    this.trailCounter=0;
  }
  buildParticles(){
    this.maxParticles=1500;this.particles=Array.from({length:this.maxParticles},()=>({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:1,r:1,g:1,b:1}));this.particleCursor=0;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.maxParticles*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(this.maxParticles*3),3));g.setAttribute('alpha',new THREE.BufferAttribute(new Float32Array(this.maxParticles),1));g.setAttribute('size',new THREE.BufferAttribute(new Float32Array(this.maxParticles),1));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{pixelRatio:{value:this.renderer.getPixelRatio()}},vertexShader:`attribute float alpha;attribute float size;varying float vAlpha;varying vec3 vColor;uniform float pixelRatio;void main(){vAlpha=alpha;vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*pixelRatio*190./-mv.z,0.,45.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float vAlpha;varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,2.)*vAlpha;gl_FragColor=vec4(vColor*2.,a);}`});
    this.particleMesh=new THREE.Points(g,m);this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);
    this.shockwaves=[];
  }
  emit(x,y,z,color,count=50,force=1){
    const c=new THREE.Color(color);for(let i=0;i<count;i++){
      const p=this.particles[this.particleCursor++%this.maxParticles],a=Math.random()*Math.PI*2,v=(1+Math.random()*5)*force;
      Object.assign(p,{x,y,z,vx:Math.cos(a)*v,vy:(Math.random()*6+1)*force,vz:Math.sin(a)*v,life:.5+Math.random()*.8,max:1.3,size:.25+Math.random()*.7,r:c.r,g:c.g,b:c.b});
    }
  }
  shock(x,z,color){
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.9,1,80),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.12,z);this.scene.add(mesh);this.shockwaves.push({mesh,life:1});
  }
  eat(data){const x=world(data.x),z=world(data.z),color=data.type==='gold'?C.gold:data.type==='chrono'?C.blue:C.pink;
    this.emit(x,.7,z,color,this.low?30:85,1.1);this.shock(x,z,color);this.shake=this.reduced?0:.15;this.flash=.7;
  }
  death(data){const x=world(data.position.x),z=world(data.position.z);this.emit(x,.8,z,C.pink,this.low?70:180,1.7);this.shock(x,z,C.pink);this.shake=this.reduced?0:.7;this.flash=1.5;}
  setMenu(menu){this.menu=menu;}
  setQuality(low){this.low=low;this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.6));this.resize();}
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.composer?.setSize(w,h);this.particleMesh?.material.uniforms.pixelRatio&&(this.particleMesh.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio());}
  makeFood(food){
    const group=new THREE.Group();const color=food.type==='gold'?C.gold:food.type==='chrono'?C.blue:C.pink;
    const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(food.type==='gold'?.48:.36,0),neon(color,3));group.add(mesh);
    const cage=new THREE.Mesh(new THREE.OctahedronGeometry(.7,0),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.28}));group.add(cage);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.64,.018,6,40),neon(color,1.8));ring.rotation.x=Math.PI/2;ring.position.y=-.48;group.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.025,.08,4,6,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=1.7;group.add(beam);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowTexture,color,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(2.5,2.5,1);group.add(glow);
    group.position.set(world(food.x),.9,world(food.z));this.scene.add(group);return group;
  }
  updateFood(foods,dt){
    const ids=new Set(foods.map(f=>f.id));for(const [id,mesh]of this.foodMeshes)if(!ids.has(id)){this.scene.remove(mesh);mesh.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.dispose();}});this.foodMeshes.delete(id);}
    for(const f of foods){let mesh=this.foodMeshes.get(f.id);if(!mesh){mesh=this.makeFood(f);this.foodMeshes.set(f.id,mesh);}mesh.position.y=.95+Math.sin(this.t*2.8+f.x)*.16;mesh.children[0].rotation.y+=dt;mesh.children[0].rotation.z+=dt*.6;mesh.children[1].rotation.y-=dt*.6;mesh.children[1].rotation.z=.4;mesh.children[2].scale.setScalar(1+Math.sin(this.t*3)*.08);}
  }
  updateSnake(game,dt){
    let positions=[];
    if(this.menu){for(let i=0;i<40;i++){const t=this.t*.55-i*.15;positions.push({x:Math.sin(t)*5.5+2,z:-8.5+i*.47,y:.5+Math.sin(i*.3+this.t)*.04});}}
    else{const alpha=game.status==='dead'?1:game.progress;positions=game.snake.map((p,i)=>{
      const prev=game.previous[i]||game.previous.at(-1)||p;
      const jump=Math.abs(prev.x-p.x)>1||Math.abs(prev.z-p.z)>1;
      return {x:world(jump?p.x:lerp(prev.x,p.x,alpha)),z:world(jump?p.z:lerp(prev.z,p.z,alpha)),y:.48+(game.boosting?.13:0)};
    });}
    const head=positions[0],next=positions[1]||head;let dx=head.x-next.x,dz=head.z-next.z;
    if(Math.abs(dx)>3||Math.abs(dz)>3){dx={right:1,left:-1,up:0,down:0}[game.direction];dz={right:0,left:0,up:-1,down:1}[game.direction];}
    const targetAngle=Math.atan2(dx,dz);let delta=targetAngle-this.headAngle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));this.headAngle+=delta*Math.min(1,dt*25);
    this.head.position.set(head.x,head.y+.05,head.z);this.head.rotation.y=this.headAngle;this.headLight.position.set(head.x,1.5,head.z);
    this.head.visible=game.status!=='dead'||this.menu;
    if(positions.length>this.shadow.instanceMatrix.count){
      const capacity=THREE.MathUtils.ceilPowerOfTwo(positions.length);
      for(const key of ['body','cores','shadow']){const old=this[key],mesh=new THREE.InstancedMesh(old.geometry,old.material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;this.scene.remove(old);old.dispose();this.scene.add(mesh);this[key]=mesh;}
    }
    this.body.count=positions.length-1;this.cores.count=positions.length-1;this.shadow.count=positions.length;
    for(let i=0;i<positions.length;i++){
      const p=positions[i],prev=positions[i-1]||p,next=positions[i+1]||p;
      const scale=i>positions.length-5?lerp(.5,1,(positions.length-i)/5):1;
      this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,Math.atan2(prev.x-next.x,prev.z-next.z),0);this.dummy.scale.set(scale,scale,1);this.dummy.updateMatrix();
      if(i>0){this.body.setMatrixAt(i-1,this.dummy.matrix);this.dummy.position.y=p.y+.3*scale;this.dummy.scale.set(scale,.85+Math.sin(this.t*4-i*.35)*.15,scale);this.dummy.updateMatrix();this.cores.setMatrixAt(i-1,this.dummy.matrix);}
      this.dummy.position.set(p.x,.055,p.z);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();this.shadow.setMatrixAt(i,this.dummy.matrix);
    }
    this.body.instanceMatrix.needsUpdate=true;this.cores.instanceMatrix.needsUpdate=true;this.shadow.instanceMatrix.needsUpdate=true;
    this.coreMaterial.color.set(game.boosting?0xc89bff:C.mint);this.coreMaterial.emissive.copy(this.coreMaterial.color);this.coreMaterial.emissiveIntensity=game.boosting?4:2.1;
    this.bodyMaterial.emissiveIntensity=game.boosting?1.3:.55;
    if(game.boosting&&!this.menu&&game.status==='playing'&&(this.trailCounter+=dt)>.035){this.trailCounter=0;const tail=positions.at(-1);this.emit(tail.x,.5,tail.z,C.blue,3,.25);}
  }
  updateParticles(dt){
    const attrs=this.particleMesh.geometry.attributes;
    for(let i=0;i<this.maxParticles;i++){const p=this.particles[i];if(p.life>0){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=7*dt;p.vx*=1-dt*.8;p.vz*=1-dt*.8;attrs.position.setXYZ(i,p.x,p.y,p.z);attrs.color.setXYZ(i,p.r,p.g,p.b);attrs.size.setX(i,p.size);attrs.alpha.setX(i,Math.max(0,p.life/p.max));}else attrs.alpha.setX(i,0);}
    for(const name of ['position','color','alpha','size'])attrs[name].needsUpdate=true;
    for(let i=this.shockwaves.length-1;i>=0;i--){const s=this.shockwaves[i];s.life-=dt*1.2;s.mesh.scale.setScalar(1+(1-s.life)*7);s.mesh.material.opacity=Math.max(0,s.life*.65);if(s.life<=0){this.scene.remove(s.mesh);s.mesh.geometry.dispose();s.mesh.material.dispose();this.shockwaves.splice(i,1);}}
  }
  render(dt,game){
    this.t+=dt;this.shake=Math.max(0,this.shake-dt*1.5);this.flash=Math.max(0,this.flash-dt*2);
    const mobile=innerWidth<761;let destination,target;
    if(this.menu){destination=mobile?new THREE.Vector3(32,40,46):new THREE.Vector3(30,33,39);target=mobile?new THREE.Vector3(-1,0,15):new THREE.Vector3(-8,0,0);}
    else{destination=this.topView?new THREE.Vector3(0,47,.01):new THREE.Vector3(0,mobile?44:31,mobile?30:26);target=new THREE.Vector3(innerWidth>1100?-2.5:mobile?0:-3,0,mobile?-1:1);
      // Fit the complete board in portrait and tablet viewports, including the far corners.
      this.fitCamera.aspect=this.camera.aspect;this.fitCamera.updateProjectionMatrix();
      for(let pass=0;pass<4;pass++){this.fitCamera.position.copy(destination);this.fitCamera.lookAt(target);this.fitCamera.updateMatrixWorld();let fit=1;
        for(const corner of this.fitCorners){const p=corner.clone().project(this.fitCamera);fit=Math.max(fit,Math.abs(p.x)/.86,Math.abs(p.y)/.72);}
        if(fit<=1.001)break;destination.sub(target).multiplyScalar(fit*1.02).add(target);
      }
    }
    if(!this.reduced&&!this.topView){destination.x+=this.pointer.x*(this.menu?1.5:.4);destination.y+=this.pointer.y*.5;}
    this.camera.position.lerp(destination,1-Math.exp(-dt*2.3));this.look.lerp(target,1-Math.exp(-dt*2.3));this.camera.lookAt(this.look);
    if(this.shake){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.y+=(Math.random()-.5)*this.shake;}
    const fov=game.boosting&&!this.menu?47:43;this.camera.fov=lerp(this.camera.fov,fov,Math.min(1,dt*4));this.camera.updateProjectionMatrix();
    if(!this.reduced){this.portalRings[0].rotation.z+=dt*.035;this.portalRings[1].rotation.z-=dt*.05;this.orbit.rotation.y+=dt*.04;this.stars.rotation.y+=dt*.003;}
    this.edgeMaterial.emissiveIntensity=(game.mode==='infinity'?1.5:2.1)+Math.sin(this.t*1.5)*.2;
    this.edgeMaterial.color.set(game.mode==='infinity'?C.blue:C.cyan);this.edgeMaterial.emissive.copy(this.edgeMaterial.color);
    this.updateSnake(game,dt);this.updateFood(game.food,dt);this.updateParticles(dt);
    this.bloom.strength=.85+this.flash*.25+(game.boosting?.2:0);
    if(this.low)this.renderer.render(this.scene,this.camera);else this.composer.render();
  }
  dispose(){window.removeEventListener('resize',this.onResize);this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m?.dispose());});this.glowTexture.dispose();this.composer.dispose();this.renderer.dispose();}
}
