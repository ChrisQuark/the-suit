import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSuit } from '../src/suit.js';
import { desiredOpacity, applyAssemblyPose, fitComponent, FULL_ORBIT, LAYER_COLORS } from '../src/inspection.js';
import { PRODUCTS, componentProduct } from '../src/products.js';
import { GHOST_SPECS, ghostGeometry } from '../src/ghost.js';
const suit=buildSuit();
assert.equal(suit.abdominal.length,4);
const armor=[...suit.components.values()].filter(c=>c.layer===6);
assert.equal(armor.length,19,'19 independent armor components, including biceps, hamstrings and the separate cup');
const named=n=>suit.parts.find(m=>m.name===n);
assert.ok(!suit.parts.some(m=>/waist belt|Right.*stab flank/i.test(m.name)),'Waist belt and right rigid flank are absent');
assert.ok(named('Left fitted rigid stab flank'));
assert.equal(suit.pads.length,10);assert.ok(!suit.pads.some(m=>/hip/i.test(m.name)));
assert.deepEqual([...suit.components.values()].filter(c=>c.layer===1).map(c=>c.id).sort(),['d3o-left-shoulder','d3o-right-shoulder','d3o-left-elbow','d3o-right-elbow','d3o-left-knee','d3o-right-knee','d3o-chest','d3o-back','d3o-left-met','d3o-right-met'].sort());
assert.equal(suit.parts.filter(m=>m.name.endsWith('external Cutlon pocket')).length,10);
for(const [kind,spec] of Object.entries(GHOST_SPECS)){
 const flat=ghostGeometry(kind);assert.ok(flat.cellCount>50,'Pads contain many independent raised cells');
 const shape=flat.lattice.parameters.shapes[0],hole=shape.holes[0].getPoints(6),center=hole.reduce((a,p)=>a.add(p),new THREE.Vector2()).divideScalar(hole.length);
 const ray=new THREE.Raycaster(new THREE.Vector3(center.x,center.y,.1),new THREE.Vector3(0,0,-1));
 const lattice=new THREE.Mesh(flat.lattice,new THREE.MeshBasicMaterial()),backing=new THREE.Mesh(flat.backing,new THREE.MeshBasicMaterial());
 assert.equal(ray.intersectObject(lattice).length,0,'A cell opening is real geometry, not painted on');
 assert.ok(ray.intersectObject(backing).length,'Fabric backing remains behind the opening');
 flat.backing.computeBoundingBox();const bounds=flat.backing.boundingBox.getSize(new THREE.Vector3());
 assert.ok(Math.abs(bounds.x-spec.width)<.004&&Math.abs(bounds.y-spec.height)<.004,'Photo outline preserves catalog size');
 flat.lattice.computeBoundingBox();assert.ok(Math.abs(flat.lattice.boundingBox.max.z-spec.thickness)<.0001,'Catalog thickness is preserved');
}
for(const m of suit.parts.filter(m=>m.userData.isPadPocket))assert.equal(desiredOpacity(m,{selected:1,selectedPart:null,hidden:new Set(),isolate:false,hardware:false,separation:0,peeling:false}),.045,'Pocket fabric fades to reveal a selected insert layer');
assert.ok(suit.components.get('hyperline').meshes.length>15,'Vest includes separate inserts, carrier, binding and closures');
for(const separation of [0,.4,1]){
 applyAssemblyPose(suit,separation);
 for(const m of suit.groups[0].children)assert.ok(m.position.equals(m.userData.rest),'Every part of the Cutlon garment stays on the body');
}
applyAssemblyPose(suit,0);
// Hiding the garment must reveal independently controlled orange inserts.
const padState={selected:null,selectedPart:null,hidden:new Set(),isolate:false,hardware:false,separation:0,peeling:false};
for(const separation of [0,.4,1])for(const hideGarment of [false,true]){
 padState.separation=separation;padState.hidden=new Set(hideGarment?[0]:[]);
 for(const m of suit.groups[1].children)assert.equal(desiredOpacity(m,padState),1,'Every pad surface survives the Cutlon visibility toggle');
 padState.hidden.add(1);
 for(const m of suit.groups[1].children)assert.equal(desiredOpacity(m,padState),0,'Impact visibility is controlled by its own layer');
}
for(const side of ['Left','Right']){
 for(const area of ['leg','sleeve']){
  const garment=named(`${side} continuous tailored ${area}`),body=suit.mannequin.getObjectByName(garment.name+' mannequin'),p=garment.geometry.attributes.position;
  for(const row of [4,12,20,28,36,44,52,60,68,76,84,92]){
   const center=new THREE.Vector3();for(let j=0;j<48;j++)center.add(new THREE.Vector3().fromBufferAttribute(p,row*49+j));center.divideScalar(48);
   for(let j=0;j<12;j++){
    const direction=new THREE.Vector3(Math.sin(j*Math.PI/6),0,Math.cos(j*Math.PI/6));
    const ray=new THREE.Raycaster(center.clone().addScaledVector(direction,.3),direction.clone().negate());
    const clothHit=ray.intersectObject(garment)[0],bodyHit=ray.intersectObject(body)[0];
    assert.ok(clothHit&&bodyHit,`${side} ${area} has outward surfaces at ring ${row}, angle ${j}`);
    assert.ok(bodyHit.distance-clothHit.distance>.003,`${side} ${area}: mannequin stays inside the knit from every tested angle`);
   }
  }
 }
 const garment=named(`${side} shoulder knit`),body=suit.mannequin.getObjectByName(`${side} shoulder`);
 // Offset the lower ray slightly from the sphere's degenerate pole vertex.
 for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(.001,-1,.001).normalize(),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
  const ray=new THREE.Raycaster(garment.position.clone().addScaledVector(axis,.3),axis.clone().negate());
  assert.ok(ray.intersectObject(body)[0].distance-ray.intersectObject(garment)[0].distance>.003,'Shoulder mannequin is inset on every side');
 }
}
const padHue=suit.materials.pad.color.getHSL({},THREE.SRGBColorSpace);
assert.ok(padHue.h>.055&&padHue.h<.11&&padHue.s>.6,'Default impact inserts use distinct warm orange');
assert.ok(suit.materials.knit.color.getHSL({},THREE.SRGBColorSpace).s<.15,'Cutlon remains neutral charcoal');
const surfaceKinds=new Set();
for(const [name,material] of Object.entries(suit.materials)){
 if(name==='skin')continue;
 assert.ok(material.map&&material.normalMap&&material.roughnessMap,`${name} has albedo, relief and roughness textures`);
 surfaceKinds.add(material.userData.surfaceKind);
 const normals=material.normalMap.image.data;let min=255,max=0;
 for(let i=0;i<normals.length;i+=4){min=Math.min(min,normals[i]);max=Math.max(max,normals[i]);}
 assert.ok(max>min,`${name} has real microstructure normals`);
 assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);
 assert.ok(material.map.repeat.x>20&&material.map.repeat.x<70,'Surface scale is calibrated per metre');
}
assert.equal(surfaceKinds.size,11,'Eleven distinct material constructions');
assert.equal(named('Left glove palm').material.userData.surfaceKind,'leather');
assert.equal(named('Left NETFORCE mesh knuckle oval').material.userData.surfaceKind,'jersey');
assert.equal(named('Left rounded athletic sole').material.userData.surfaceKind,'rubber');
suit.root.traverse(m=>{if(m.isMesh&&m.material.map){assert.equal(m.geometry.userData.metricUV,true,`${m.name} uses physical texture scale`);assert.ok([...m.geometry.attributes.uv.array].every(Number.isFinite));}});
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
 const product=componentProduct(c);assert.ok(product.name&&product.features.length===3);assert.ok(product.dimensions&&product.contribution);assert.ok(c.dimensions.every(v=>Number.isFinite(v)&&v>0));
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
console.log('PASS: independent orange pads, 588 mannequin-clearance rays, eleven textured materials, metric UVs, fixed Cutlon, full straps, component isolation, boot rays, camera fit, muted colors, product cards and waist clearance.');
