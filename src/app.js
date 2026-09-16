import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildSuit } from './suit.js';
import { LAYERS } from './layers.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { LAYER_COLORS, LAYER_COLOR_NAMES, FULL_ORBIT, desiredOpacity, applyAssemblyPose, fitComponent } from './inspection.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={selected:null,selectedPart:null,colors:false,hidden:new Set(),isolate:false,hardware:false,separation:0,peeling:false,peelStage:8,autoRotate:false};
const eye='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.4"/></svg>';
let suit,controls,camera,renderer,scene,cameraTween=null,peelTimer=null,modelReady=false,focusLayer=false;
let currentSeparation=0,frameHandle=0,previous=0;
let pieceReturn=null;

$('layers').innerHTML=LAYERS.map((l,i)=>`<li data-layer="${i}"><button class="layer-select" data-select="${i}" aria-pressed="false"><span class="layer-number">${String(i+1).padStart(2,'0')}</span><span class="layer-name">${l.name}</span></button><button class="layer-eye" data-eye="${i}" aria-label="Hide ${l.name}" aria-pressed="true">${eye}</button></li>`).join('');

function updateUI(){
  document.body.classList.toggle('color-mode',state.colors);
  $('colors').setAttribute('aria-pressed',String(state.colors));$('colors').querySelector('span').textContent=state.colors?'Colors on':'Colors off';
  if(!state.selectedPart)$('piece-picker').value='';$('piece-bar').hidden=!state.selectedPart;$('return-piece').hidden=!state.selectedPart;
  $('isolate').hidden=!!state.selectedPart;$('focus').hidden=!!state.selectedPart;
  document.querySelectorAll('[data-layer]').forEach(row=>{const i=Number(row.dataset.layer);row.style.setProperty('--layer-color','#'+LAYER_COLORS[i].toString(16).padStart(6,'0'));row.title=state.colors?LAYER_COLOR_NAMES[i]:'';});
  document.querySelectorAll('[data-layer]').forEach(row=>{const i=Number(row.dataset.layer);row.classList.toggle('selected',state.selected===i);row.classList.toggle('is-hidden',state.hidden.has(i));row.querySelector('.layer-select').setAttribute('aria-pressed',String(state.selected===i));const b=row.querySelector('.layer-eye');b.setAttribute('aria-pressed',String(!state.hidden.has(i)));b.setAttribute('aria-label',`${state.hidden.has(i)?'Show':'Hide'} ${LAYERS[i].name}`);});
  $('assembled').classList.toggle('active',state.separation===0);$('assembled').setAttribute('aria-pressed',String(state.separation===0));
  $('exploded').classList.toggle('active',state.separation>0);$('exploded').setAttribute('aria-pressed',String(state.separation>0));
  $('separation').value=String(Math.round(state.separation*100));$('separation').style.setProperty('--range',`${state.separation*100}%`);$('separation-value').textContent=`${Math.round(state.separation*100)}%`;
  $('hardware').setAttribute('aria-pressed',String(state.hardware));$('rotate').setAttribute('aria-pressed',String(state.autoRotate));$('peel').setAttribute('aria-pressed',String(state.peeling));$('peel').querySelector('span').textContent=state.peeling?'Stop peel':'Peel layers';
  $('isolate').classList.toggle('active',state.isolate);$('isolate').innerHTML=state.isolate?'Exit isolation <span>↙</span>':'Isolate layer <span>↗</span>';
  $('focus').innerHTML=focusLayer?'Full view <span>−</span>':'Inspect close-up <span>+</span>';
  $('status').textContent=state.selectedPart?'PIECE ISOLATED · DRAG TO ROTATE':state.peeling?`PEELING / ${Math.max(1,state.peelStage+1)} OF 8`:state.hardware?'HARDWARE REVEALED':state.isolate&&state.selected!==null?`LAYER ${String(state.selected+1).padStart(2,'0')} ISOLATED`:state.selected!==null?`INSPECTING LAYER ${String(state.selected+1).padStart(2,'0')}`:state.hidden.size?`${8-state.hidden.size} LAYERS VISIBLE`:'ALL LAYERS VISIBLE';
  $('annotation').hidden=!state.hardware&&state.selected!==4;
  $('annotation-text').textContent=state.hardware?'Straps through slots. Sliding rivets. Hook-and-loop sleeves.':'Three rigid lames beneath the knit. Open at the nape.';
}
function showDetail(i){
  $('details').classList.toggle('has-selection',i!==null);$('close-detail').hidden=i===null;$('detail-actions').hidden=i===null;
  if(i===null){$('detail-index').textContent='SYSTEM / 001';$('detail-title').innerHTML='Built in layers.<br>Free to move.';$('detail-description').textContent='A close study of protection, articulation, and the space between them.';$('detail-extra').innerHTML='<p class="overview-note">Select a layer or a part of the suit to look beneath the surface.</p><div class="overview-stats"><div><strong>08</strong><span>Independent layers</span></div><div><strong>04</strong><span>Sliding abdominal lames</span></div></div>';return;}
  const l=LAYERS[i];$('detail-index').textContent=`LAYER ${String(i+1).padStart(2,'0')} / ${String(LAYERS.length).padStart(2,'0')}`;$('detail-title').textContent=l.title;$('detail-description').textContent=l.description;
  $('detail-extra').innerHTML=`<dl class="detail-specs"><div><dt>Material</dt><dd>${l.material}</dd></div><div><dt>Construction</dt><dd>${l.build}</dd></div><div><dt>Attachment</dt><dd>${l.attachment}</dd></div></dl><p class="detail-note">${l.note}</p>`;
}
function selectLayer(i){exitPiece(false);stopPeel();state.selected=i;state.isolate=false;if(i!==null)state.hidden.delete(i);if(focusLayer){focusLayer=false;setCamera('full');}showDetail(i);updateUI();}
function stopPeel(){state.peeling=false;state.peelStage=8;clearInterval(peelTimer);peelTimer=null;}
function setSeparation(v){exitPiece(false);stopPeel();state.separation=v;focusLayer=false;setCamera('full');updateUI();}
function setCamera(mode='full'){
  if(!camera||!controls)return;
  const mobile=window.innerWidth<=760;
  let target=new THREE.Vector3(0,1.0,0),p;
  if(mode==='focus'&&state.selected!==null){const l=LAYERS[state.selected];target.set(...l.focus);target.z+=state.separation*.35;p=target.clone().add(new THREE.Vector3(l.distance*.23,l.distance*.08,l.distance));}
  else{const dist=state.separation>0?(mobile?4.8:4.65):4.05;const exploded=state.separation>0&&mode==='full';p=new THREE.Vector3(mode==='front'?0:mode==='back'?0:dist*(exploded?.78:.26),1.12,mode==='back'?-dist:dist*(exploded?.78:1));}
  cameraTween={start:performance.now(),from:camera.position.clone(),to:p,fromTarget:controls.target.clone(),toTarget:target};
  if(reduced){camera.position.copy(p);controls.target.copy(target);cameraTween=null;}
  $('view-label').textContent=mode==='back'?'BACK VIEW':mode==='front'?'FRONT VIEW':mode==='focus'?'DETAIL / INSPECTION':'FRONT / THREE-QUARTER';
}
function reset(){exitPiece(false);stopPeel();state.selected=null;state.hidden.clear();state.isolate=false;state.hardware=false;state.separation=0;state.autoRotate=false;focusLayer=false;showDetail(null);setCamera('full');updateUI();}
$('layers').addEventListener('click',e=>{const select=e.target.closest('[data-select]'),vis=e.target.closest('[data-eye]');if(select)selectLayer(Number(select.dataset.select));if(vis){exitPiece(false);stopPeel();const i=Number(vis.dataset.eye);state.hidden.has(i)?state.hidden.delete(i):state.hidden.add(i);if(state.hidden.has(state.selected)){state.selected=null;state.isolate=false;showDetail(null);}updateUI();}});
$('show-all').addEventListener('click',()=>{exitPiece(false);stopPeel();state.selected=null;state.hidden.clear();state.isolate=false;showDetail(null);updateUI();});
$('close-detail').addEventListener('click',()=>state.selectedPart?exitPiece():selectLayer(null));
$('assembled').addEventListener('click',()=>setSeparation(0));$('exploded').addEventListener('click',()=>setSeparation(1));$('separation').addEventListener('input',e=>setSeparation(Number(e.target.value)/100));
$('isolate').addEventListener('click',()=>{stopPeel();state.isolate=!state.isolate;updateUI();});
$('focus').addEventListener('click',()=>{focusLayer=!focusLayer;setCamera(focusLayer?'focus':'full');updateUI();});
$('hardware').addEventListener('click',()=>{exitPiece(false);stopPeel();state.hardware=!state.hardware;state.isolate=false;state.selected=state.hardware?5:null;state.hidden.clear();showDetail(state.selected);updateUI();});
$('rotate').addEventListener('click',()=>{state.autoRotate=!state.autoRotate;cameraTween=null;updateUI();});
$('front').addEventListener('click',()=>{state.autoRotate=false;state.selectedPart?framePiece('front'):setCamera('front');updateUI();});$('back').addEventListener('click',()=>{state.autoRotate=false;state.selectedPart?framePiece('back'):setCamera('back');updateUI();});$('reset').addEventListener('click',reset);
document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();reset();});
$('peel').addEventListener('click',()=>{
  if(state.peeling){stopPeel();state.selected=null;showDetail(null);updateUI();return;}
  reset();state.peeling=true;state.peelStage=7;state.selected=7;showDetail(7);updateUI();
  // Deliberately read as an assembly study: outside to skin, one layer at a time.
  peelTimer=setInterval(()=>{if(document.hidden)return;state.peelStage--;if(state.peelStage<0){stopPeel();state.selected=0;showDetail(0);}else{state.selected=state.peelStage;showDetail(state.selected);}updateUI();},reduced?3300:2400);
});
$('about-toggle').addEventListener('click',()=>{$('about').showModal();$('about-toggle').setAttribute('aria-expanded','true');});$('about-close').addEventListener('click',()=>$('about').close());$('about').addEventListener('close',()=>$('about-toggle').setAttribute('aria-expanded','false'));$('about').addEventListener('click',e=>{if(e.target===$('about')){const b=$('about').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('about').close();}});

function exitPiece(restore=true){
  if(!state.selectedPart)return;
  state.selectedPart=null;state.isolate=false;focusLayer=false;
  controls.minDistance=.48;controls.maxDistance=8;controls.minPolarAngle=FULL_ORBIT.min;controls.maxPolarAngle=FULL_ORBIT.max;
  if(restore&&pieceReturn){state.selected=pieceReturn.selected;state.hardware=pieceReturn.hardware;cameraTween={start:performance.now(),from:camera.position.clone(),to:pieceReturn.position,fromTarget:controls.target.clone(),toTarget:pieceReturn.target};}
  else{state.selected=null;setCamera('full');}
  pieceReturn=null;showDetail(state.selected);updateUI();
}
function framePiece(view='front'){
  const c=suit?.components.get(state.selectedPart);if(!c)return;
  applyAssemblyPose(suit,state.separation);
  const fit=fitComponent(c,camera),isBack=c.id==='back';
  const direction=new THREE.Vector3(.25,.14,(view==='back'?-1:1)*(isBack?-1:1)).normalize();
  controls.minDistance=Math.max(.04,fit.radius*1.15+camera.near);controls.maxDistance=Math.max(2,fit.distance*4);controls.minPolarAngle=.01;controls.maxPolarAngle=Math.PI-.01;
  cameraTween={start:performance.now(),from:camera.position.clone(),to:fit.center.clone().addScaledVector(direction,fit.distance),fromTarget:controls.target.clone(),toTarget:fit.center};
}
function selectPiece(id){
  const c=suit?.components.get(id);if(!c)return;
  if(!state.selectedPart)pieceReturn={position:camera.position.clone(),target:controls.target.clone(),selected:state.selected,hardware:state.hardware};
  stopPeel();state.selectedPart=id;state.selected=c.layer;state.hardware=false;state.isolate=false;state.autoRotate=false;currentSeparation=state.separation;
  showDetail(c.layer);$('detail-title').textContent=c.name;$('detail-index').textContent='INDIVIDUAL COMPONENT';$('piece-name').textContent=c.name;
  $('detail-description').textContent='Drag to orbit this component from any angle. Scroll to zoom, or return to the assembly.';
  $('piece-picker').value=id;framePiece();updateUI();
}
$('colors').addEventListener('click',()=>{state.colors=!state.colors;updateUI();});
$('return-piece').addEventListener('click',()=>exitPiece());$('piece-back').addEventListener('click',()=>exitPiece());
$('piece-picker').addEventListener('change',e=>{if(e.target.value)selectPiece(e.target.value);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.selectedPart)exitPiece();});

function environment(){
  // Linear HDR studio: large softboxes produce broad, controlled reflections.
  const studio=new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(12,24,16),new THREE.MeshBasicMaterial({color:0x111318,side:THREE.BackSide})));
  for(const [position,size,power,tint] of [
    [[-3,3,4],[2.2,4],7,[1,.96,.91]],
    [[3,2,-2],[1,4],9,[.80,.88,1]],
    [[1,4,2],[3,1.5],4,[1,1,1]],
    [[-4,1,-3],[.5,3],3,[1,1,1]]
  ]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(...tint).multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false}));
    card.position.set(...position);card.lookAt(0,1,0);studio.add(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),result=pmrem.fromScene(studio,.04,.1,30);
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();return result.texture;
}
async function init3D(){
  renderer=new THREE.WebGLRenderer({canvas:$('scene'),alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.environment=environment();scene.environmentIntensity=1.0;
  const mobile=window.innerWidth<=760;
  camera=new THREE.PerspectiveCamera(32,1,.01,40);camera.position.set(.90,1.12,4.05);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.0,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=.48;controls.maxDistance=8;controls.minPolarAngle=FULL_ORBIT.min;controls.maxPolarAngle=FULL_ORBIT.max;controls.autoRotateSpeed=.65;
  controls.addEventListener('start',()=>{cameraTween=null;});
  scene.add(new THREE.HemisphereLight(0xd5dbe5,0x151619,.7));
  const key=new THREE.DirectionalLight(0xf0ece5,2.8);key.position.set(-2.2,3.4,3.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.7;key.shadow.camera.right=1.7;key.shadow.camera.top=2.4;key.shadow.camera.bottom=-1.4;key.shadow.normalBias=.0015;key.shadow.bias=-.00015;scene.add(key);
  const rim=new THREE.DirectionalLight(0xc4d2e6,2.4);rim.position.set(2.2,2.3,-1.7);scene.add(rim);
  const front=new THREE.DirectionalLight(0xc3ccdc,.4);front.position.set(1.3,.6,3);scene.add(front);
  suit=buildSuit();
  suit.root.traverse(m=>{if(!m.isMesh)return;m.material=m.material.clone();m.userData.baseColor=m.material.color.clone();m.userData.baseMetalness=m.material.metalness;m.userData.baseRoughness=m.material.roughness;m.userData.baseMap=m.material.map;m.userData.colorMode=false;m.material.envMapIntensity=m.userData.layer===6?1.15:.48;m.userData.opacity=1;});
  $('piece-picker').disabled=false;
  $('piece-picker').innerHTML='<option value="">Inspect a piece…</option>'+[...suit.components.values()].filter(c=>c.layer===6||c.layer===7).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  suit.collarKnits.forEach(p=>p.userData.isCollar=true);scene.add(suit.root);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(3,96),new THREE.MeshStandardMaterial({color:0x07080a,roughness:.72,metalness:.12,transparent:true,opacity:.92,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;floor.receiveShadow=true;scene.add(floor);

  // Subtle grounding, without a visible pedestal or a busy environment.
  const shadeCanvas=document.createElement('canvas');shadeCanvas.width=shadeCanvas.height=128;const ctx=shadeCanvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,4,64,64,64);grad.addColorStop(0,'#000000b0');grad.addColorStop(1,'#00000000');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const contact=new THREE.Mesh(new THREE.PlaneGeometry(.6,.40),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.009;scene.add(contact);
  // Contact shading makes the plate overlaps, cloth recesses and sole contact legible.
  // Keep normals-based occlusion out of transparent layer inspection.
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});target.samples=Math.min(4,renderer.capabilities.maxSamples);
  const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  const occlusion=new SSAOPass(scene,camera,1,1,mobile?12:24);occlusion.kernelRadius=.055;occlusion.minDistance=.000025;occlusion.maxDistance=.0015;composer.addPass(occlusion);composer.addPass(new OutputPass());
  const observer=new ResizeObserver(()=>{const b=$('viewport').getBoundingClientRect();renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();composer.setSize(b.width,b.height);if(state.selectedPart)framePiece();});observer.observe($('viewport'));
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
  $('scene').addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  $('scene').addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
    const b=$('scene').getBoundingClientRect();mouse.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(suit.parts).filter(h=>h.object.visible&&h.object.material.opacity>.4);if(hits.length){const m=hits[0].object;if(state.separation>.025||state.selectedPart)selectPiece(m.userData.component);else selectLayer(m.userData.layer);}
  });
  $('scene').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();cameraTween=null;
    if(e.key==='0'){reset();return;}const v=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(v);
    if(e.key==='ArrowLeft')s.theta-=.13;if(e.key==='ArrowRight')s.theta+=.13;if(e.key==='ArrowUp')s.phi-=.08;if(e.key==='ArrowDown')s.phi+=.08;
    if(e.key==='+'||e.key==='=')s.radius*=.90;if(e.key==='-')s.radius*=1.1;s.radius=THREE.MathUtils.clamp(s.radius,controls.minDistance,controls.maxDistance);s.phi=THREE.MathUtils.clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  });
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frameHandle);$('render-error').hidden=false;});
  modelReady=true;$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,reduced?0:650);updateUI();
  function frame(t){
    const dt=Math.min((t-previous)/1000,.05);previous=t;const ease=reduced?1:1-Math.exp(-dt*7);
    currentSeparation+=(state.separation-currentSeparation)*ease;
    for(const m of [...suit.parts,...suit.hardwareParts]){
      const target=desiredOpacity(m,state);if(state.selectedPart)m.userData.opacity=target;else m.userData.opacity+=(target-m.userData.opacity)*ease;m.visible=m.userData.opacity>.012;
      m.material.opacity=m.userData.opacity;m.material.transparent=m.userData.opacity<.995;m.material.depthWrite=m.userData.opacity>.75;
      if(m.userData.colorMode!==state.colors){m.userData.colorMode=state.colors;m.material.map=state.colors?null:m.userData.baseMap;m.material.metalness=state.colors?.05:m.userData.baseMetalness;m.material.roughness=state.colors?.67:m.userData.baseRoughness;m.material.needsUpdate=true;}
      const ex=m.userData.explode;m.position.copy(m.userData.rest).addScaledVector(ex,currentSeparation);
      if(state.peeling&&m.userData.layer>state.peelStage)m.position.addScaledVector(ex,.4);
      if(state.hardware&&m.userData.hardware&&!state.colors){m.material.color.lerp(new THREE.Color(0xb8cdaa),ease);if(m.material.emissive){m.material.emissive.setHex(0x597747);m.material.emissiveIntensity=.25;}}
      else{m.material.color.lerp(state.colors?new THREE.Color(LAYER_COLORS[m.userData.layer]):m.userData.baseColor,ease);if(m.material.emissive)m.material.emissiveIntensity=0;}
    }
    suit.mannequin.visible=!state.selectedPart;
    floor.visible=contact.visible=!state.selectedPart&&currentSeparation<.01;
    // The mannequin is the stable reference for exploded and isolated views.
    suit.mannequin.traverse(m=>{if(!m.isMesh)return;const alpha=state.isolate?.24:1;m.material.transparent=alpha<1;m.material.opacity=alpha;m.material.depthWrite=alpha===1;});
    if(cameraTween){const f=Math.min((t-cameraTween.start)/(reduced?1:900),1),e=f*f*(3-2*f);camera.position.lerpVectors(cameraTween.from,cameraTween.to,e);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,e);if(f===1)cameraTween=null;}
    controls.autoRotate=state.autoRotate&&!cameraTween;controls.update(dt);occlusion.enabled=!state.selectedPart&&state.selected===null&&!state.hardware&&!state.peeling&&currentSeparation<.005&&state.hidden.size===0;composer.render(dt);frameHandle=requestAnimationFrame(frame);
  }
  frameHandle=requestAnimationFrame(frame);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameHandle);}else{previous=performance.now();frameHandle=requestAnimationFrame(frame);}});
}
$('details').classList.remove('has-selection');
init3D().catch(error=>{console.error('The Suit: 3D initialization failed',error);$('loading').hidden=true;$('render-error').hidden=false;});
updateUI();
