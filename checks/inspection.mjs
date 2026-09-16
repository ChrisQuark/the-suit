import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSuit } from '../src/suit.js';
import { desiredOpacity, applyAssemblyPose, fitComponent, FULL_ORBIT, LAYER_COLORS } from '../src/inspection.js';
const suit=buildSuit();
assert.equal(suit.abdominal.length,4);
const armor=[...suit.components.values()].filter(c=>c.layer===6);
assert.equal(armor.length,14,'14 independent armor components, with their trim grouped');
const chrome=suit.materials.metal;assert.equal(chrome.metalness,1);assert.ok(chrome.roughness<=.2);
const head=suit.mannequin.children.find(m=>m.name.includes('head'));
const h=new THREE.Box3().setFromObject(head).getSize(new THREE.Vector3());assert.ok(h.y>.235&&h.y<.25,'Head now has adult mannequin proportions');
const state={selected:null,selectedPart:null,hidden:new Set(),isolate:false,hardware:false,separation:1,peeling:false};
applyAssemblyPose(suit,1);
for(const side of ['left','right']){
 const boot=suit.components.get(side+'-boot');assert.ok(boot.meshes.length>10);
 const box=new THREE.Box3();for(const m of boot.meshes)box.union(new THREE.Box3().setFromObject(m));
 assert.ok(box.min.y>0,'Exploded boots stay above ground');
 // Raycast boot upper from eight horizontal directions: tests real face winding / heel closure.
 const upper=boot.meshes.find(m=>m.name.includes('sculpted athletic boot'));
 const center=new THREE.Box3().setFromObject(upper).getCenter(new THREE.Vector3());
 for(let i=0;i<8;i++){const dir=new THREE.Vector3(Math.sin(i*Math.PI/4),0,Math.cos(i*Math.PI/4));const r=new THREE.Raycaster(center.clone().addScaledVector(dir,.5),dir.clone().negate());const hits=r.intersectObject(upper);assert.ok(hits.length>0&&hits[0].distance<.5,`${side} boot has an outward-facing surface from azimuth ${i}`);}
}
for(const c of armor){
 state.selectedPart=c.id;state.selected=c.layer;
 const visible=[...suit.parts,...suit.hardwareParts].filter(m=>desiredOpacity(m,state)>0);
 assert.equal(visible.length,c.meshes.length,`Only ${c.id} and its own trim remain visible`);
 for(const aspect of [.55,1.7]){
  const camera=new THREE.PerspectiveCamera(32,aspect,.01,40);const fit=fitComponent(c,camera);assert.ok(Number.isFinite(fit.distance)&&fit.distance>fit.radius);assert.ok(fit.center.length()>0,'Frame actual component position, not origin');
 }
}
state.selectedPart=null;state.selected=null;assert.ok(suit.parts.every(m=>desiredOpacity(m,state)===1),'Return restores exploded assembly');
assert.ok(FULL_ORBIT.max<Math.PI/2,'Full model camera cannot pass below the floor');
assert.equal(LAYER_COLORS[1],0xff721b);assert.equal(LAYER_COLORS[6],0x287ff0);
assert.ok(suit.parts.some(m=>m.name.includes('NETFORCE extended glove cuff')));
applyAssemblyPose(suit,0);
const lameBounds=suit.abdominal.map(m=>new THREE.Box3().setFromObject(m));
for(let i=1;i<4;i++)assert.ok(Math.abs(lameBounds[i].max.y-lameBounds[i-1].min.y-.015)<.001);
const waist=new THREE.Box3().setFromObject(suit.parts.find(m=>m.name==='Soft waist belt'));assert.ok(Math.abs(lameBounds[3].min.y-waist.max.y-.04)<.001);
suit.root.traverse(m=>{if(m.isMesh){assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...m.geometry.attributes.normal.array].every(Number.isFinite));}});
console.log('PASS: component isolation, front/back boot rays, explosion clearance, camera fit, head proportions, chrome, layer colors, glove details and abdominal movement gaps.');
