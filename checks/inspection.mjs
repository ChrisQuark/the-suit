import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSuit } from '../src/suit.js';
import { desiredOpacity, applyAssemblyPose, fitComponent, FULL_ORBIT, LAYER_COLORS } from '../src/inspection.js';
import { PRODUCTS, componentProduct } from '../src/products.js';
const suit=buildSuit();
assert.equal(suit.abdominal.length,4);
const armor=[...suit.components.values()].filter(c=>c.layer===6);
assert.equal(armor.length,19,'19 independent armor components, including biceps, hamstrings and the separate cup');
const named=n=>suit.parts.find(m=>m.name===n);
assert.ok(!suit.parts.some(m=>/waist belt|Right.*stab flank/i.test(m.name)),'Waist belt and right rigid flank are absent');
assert.ok(named('Left fitted rigid stab flank'));
assert.equal(suit.pads.length,8);assert.ok(!suit.pads.some(m=>/hip/i.test(m.name)));
assert.deepEqual([...suit.components.values()].filter(c=>c.layer===1).map(c=>c.id).sort(),['d3o-left-shoulder','d3o-right-shoulder','d3o-left-elbow','d3o-right-elbow','d3o-left-knee','d3o-right-knee','d3o-chest','d3o-back'].sort());
for(const separation of [0,.4,1]){
 applyAssemblyPose(suit,separation);
 for(const m of suit.groups[0].children)assert.ok(m.position.equals(m.userData.rest),'Every part of the Cutlon garment stays on the body');
}
applyAssemblyPose(suit,0);
// Full straps must present an exterior surface from every azimuth, not merely a front tab.
for(const m of suit.parts.filter(m=>/wrap strap|groin soft leg loop/.test(m.name))){
 const center=new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
 for(let i=0;i<12;i++){
  const direction=new THREE.Vector3(Math.sin((i+.35)*Math.PI/6),0,Math.cos((i+.35)*Math.PI/6));
  const hits=new THREE.Raycaster(center.clone().addScaledVector(direction,.5),direction.clone().negate()).intersectObject(m);
  assert.ok(hits.length&&hits[0].distance<.5,`${m.name}: exterior face at azimuth ${i}`);
 }
}
for(const side of ['left','right'])for(const area of ['biceps','hamstring']){
 const c=suit.components.get(side+'-'+area);assert.ok(c);
 assert.ok(c.meshes.some(m=>/loop on plate back/.test(m.name)),'New limb shell has an independent attachment patch');
 const m=c.meshes[0],positions=m.geometry.attributes.position,normals=m.geometry.attributes.normal;
 // Mid-row exterior normal must point away from the limb centre, on both mirrored shells.
 const vertex=49+24;const normal=new THREE.Vector3().fromBufferAttribute(normals,vertex);
 assert.ok(area==='hamstring'?normal.z<-.5:Math.sign(normal.x)===(side==='left'?-1:1),`${c.name}: correct exterior normal`);
 assert.ok(positions.count>200);
}
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
for(const c of suit.components.values()){
 state.selectedPart=c.id;state.selected=c.layer;
 const visible=[...suit.parts,...suit.hardwareParts].filter(m=>desiredOpacity(m,state)>0);
 assert.equal(visible.length,c.meshes.length,`Only ${c.id} and its own trim remain visible`);
 for(const aspect of [.55,1.7]){
  const camera=new THREE.PerspectiveCamera(32,aspect,.01,40);const fit=fitComponent(c,camera);assert.ok(Number.isFinite(fit.distance)&&fit.distance>fit.radius);assert.ok(fit.center.length()>0,'Frame actual component position, not origin');
 }
 const product=componentProduct(c);assert.ok(product.name&&product.features.length>=3);
}
state.selectedPart=null;state.selected=null;assert.ok(suit.parts.every(m=>desiredOpacity(m,state)===1),'Return restores exploded assembly');
assert.ok(FULL_ORBIT.max<Math.PI/2,'Full model camera cannot pass below the floor');
assert.equal(new Set(LAYER_COLORS).size,8);
for(const hex of LAYER_COLORS){const color=new THREE.Color(hex);const hsl=color.getHSL({},THREE.SRGBColorSpace);assert.ok(hsl.s<.55,'Muted military color palette');}
assert.equal(PRODUCTS.length,8);
assert.ok(suit.parts.some(m=>m.name.includes('NETFORCE extended glove cuff')));
applyAssemblyPose(suit,0);
const lameBounds=suit.abdominal.map(m=>new THREE.Box3().setFromObject(m));
for(let i=1;i<4;i++)assert.ok(Math.abs(lameBounds[i].max.y-lameBounds[i-1].min.y-.015)<.001);
const cup=new THREE.Box3().setFromObject(named('Removable groin impact cup'));
assert.ok(lameBounds[3].min.y-cup.max.y>.09,'Groin insert remains independent with a flexible waist gap');
suit.root.traverse(m=>{if(m.isMesh){assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...m.geometry.attributes.normal.array].every(Number.isFinite));}});
console.log('PASS: fixed Cutlon, continuous strap surfaces, coverage and pad locations, independent groin cup, all-component isolation, boot rays, camera fit, muted colors, product features and waist clearance.');
