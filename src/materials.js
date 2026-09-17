import * as THREE from 'three';

// Seamless, deterministic PBR tiles. Geometry UVs are measured in metres.
const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const SURFACE_RECIPES={
 knit:{tile:.024,relief:.00018,roughness:.95},
 jersey:{tile:.018,relief:.00009,roughness:.98},
 webbing:{tile:.026,relief:.00014,roughness:.93},
 polyester:{tile:.020,relief:.000065,roughness:.92},
 carbon:{tile:.026,relief:.000035,roughness:.47},
 leather:{tile:.023,relief:.00010,roughness:.76},
 rubber:{tile:.027,relief:.00009,roughness:.87},
 elastomer:{tile:.019,relief:.000018,roughness:.58},
 chrome:{tile:.036,relief:.000003,roughness:.19},
 polymer:{tile:.024,relief:.00003,roughness:.78},
 hook:{tile:.015,relief:.00018,roughness:.98}
};
function field(kind,u,v){
 const noise=(Math.sin(TAU*(u*37+v*53))+.5*Math.cos(TAU*(u*91-v*43))+.25*Math.sin(TAU*(u*173+v*137)))/1.75;
 const yarn=(x,n)=>Math.pow(.5+.5*Math.cos(TAU*x*n),3);
 if(kind==='knit'||kind==='jersey'){
  const columns=kind==='knit'?8:12,rows=kind==='knit'?12:16;
  const bend=Math.abs(Math.sin(TAU*v*rows/2))*.37;
  return clamp(.32+.43*yarn(u+bend/columns,columns)+.10*Math.cos(TAU*v*rows)+noise*.045);
 }
 if(kind==='webbing'){
  const over=(Math.floor(u*16)+Math.floor(v*16))%2===0;
  return clamp(.24+.44*(over?yarn(u,16):yarn(v,16))+.15*(over?yarn(v,16):yarn(u,16))+.035*Math.cos(TAU*u*128)+noise*.025);
 }
 if(kind==='carbon'){
  const over=((Math.floor(u*8)-Math.floor(v*8)+16)%4)<2;
  return clamp(.34+.29*(over?yarn(u,8):yarn(v,8))+.075*Math.cos(TAU*(over?u:v)*96)+noise*.018);
 }
 if(kind==='polyester')return clamp(.48+.11*Math.sin(TAU*u*96)+.065*Math.cos(TAU*v*96)+noise*.055);
 if(kind==='leather')return clamp(.48+.19*Math.sin(TAU*u*22+.8*Math.sin(TAU*v*8))*Math.sin(TAU*v*26+.6*Math.cos(TAU*u*6))+noise*.04);
 if(kind==='rubber')return clamp(.48+.075*Math.sin(TAU*u*18)*Math.cos(TAU*v*22)+noise*.065);
 if(kind==='elastomer')return clamp(.5+noise*.04+.025*Math.cos(TAU*(u*48+v*40)));
 if(kind==='chrome')return clamp(.5+.07*Math.sin(TAU*v*192+.2*Math.sin(TAU*u*4))+.035*Math.cos(TAU*v*88)+noise*.012);
 if(kind==='hook')return clamp(.3+.36*yarn(u+.02*Math.sin(TAU*v*12),24)*yarn(v,24)+noise*.09);
 return clamp(.5+.055*Math.sin(TAU*v*80)+noise*.05);
}
function texture(data,size,name,tile,color=false){
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=name;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/tile,1/tile);t.anisotropy=8;
 t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
 if(color)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}
export function makeSurface(kind){
 const recipe=SURFACE_RECIPES[kind],size=512,height=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)height[y*size+x]=field(kind,x/size,y/size);
 const color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
 const sample=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=sample(x,y),i=(y*size+x)*4;
  const modulation=kind==='chrome'?.975+(h-.5)*.035:kind==='carbon'?.79+h*.20:.82+h*.17;
  const c=Math.round(clamp(modulation)*255),r=Math.round(clamp(.87+(h-.5)*.16)*255);
  color.set([c,c,c,255],i);rough.set([r,r,r,255],i);
  const dx=(sample(x+1,y)-sample(x-1,y))*recipe.relief*size/(2*recipe.tile),dy=(sample(x,y+1)-sample(x,y-1))*recipe.relief*size/(2*recipe.tile);
  const n=new THREE.Vector3(-dx,-dy,1).normalize();normal.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],i);
 }
 return {map:texture(color,size,kind+' albedo',recipe.tile,true),normalMap:texture(normal,size,kind+' normal',recipe.tile),roughnessMap:texture(rough,size,kind+' roughness',recipe.tile),roughness:recipe.roughness};
}
export function makeMaterials(overrides={}){
 const surfaces=Object.fromEntries(Object.keys(SURFACE_RECIPES).map(kind=>[kind,makeSurface(kind)]));
 const physical=(kind,params)=>{const m=new THREE.MeshPhysicalMaterial({...surfaces[kind],...params});m.userData.surfaceKind=kind;return m;};
 return {
  knit:physical('knit',{color:0x34383b,metalness:0,sheen:.42,sheenColor:0x747b7e,sheenRoughness:.85}),
  seam:physical('webbing',{color:0x454b4c,metalness:0}),
  skin:new THREE.MeshStandardMaterial({color:0x121619,roughness:.48,metalness:.05}),
  pad:physical('elastomer',{color:0xe88729,metalness:0,clearcoat:.08,clearcoatRoughness:.65}),
  padBacking:physical('jersey',{color:0x151919,metalness:0,sheen:.20}),
  pocket:physical('knit',{color:0x292e30,metalness:0,sheen:.30,sheenRoughness:.85}),
  soft:physical('polyester',{color:0x343a3d,metalness:0,sheen:.30,sheenRoughness:.9}),
  carbon:physical('carbon',{color:0x44494c,metalness:.10,clearcoat:.38,clearcoatRoughness:.36}),
  strap:physical('webbing',{color:0x252b29,metalness:0,sheen:.18}),
  metal:physical('chrome',{color:0xc8cdd2,metalness:1,clearcoat:.20,clearcoatRoughness:.28,iridescence:.018}),
  edge:physical('polymer',{color:0x20262a,metalness:.08}),
  rubber:physical('rubber',{color:0x232827,metalness:0}),
  leather:physical('leather',{color:0x2c302e,metalness:0,clearcoat:.04}),
  mesh:physical('jersey',{color:0x323936,metalness:0,sheen:.25}),
  fastener:physical('chrome',{color:0x747b7b,metalness:.8,roughness:.36}),
  hook:physical('hook',{color:0x41483b,metalness:0}),
  ...overrides
 };
}
export function scaleMetricUV(geometry,u,v){
 const uv=geometry.attributes.uv;if(!uv)return;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);
 geometry.userData.metricUV=true;
}
export function assignMetricUV(mesh){
 const g=mesh.geometry;if(g.userData.metricUV||!g.attributes.uv)return;
 if(g.type==='SphereGeometry'){
  const radius=g.parameters.radius??1;scaleMetricUV(g,TAU*radius*Math.sqrt((mesh.scale.x**2+mesh.scale.z**2)/2),Math.PI*radius*mesh.scale.y);return;
 }
 if(g.type==='CylinderGeometry'||g.type==='TorusGeometry'){
  g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);scaleMetricUV(g,Math.PI*Math.max(size.x,size.z),size.y);return;
 }
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*mesh.scale.x,y=p.getY(i)*mesh.scale.y,z=p.getZ(i)*mesh.scale.z;
  const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
  if(ax>ay&&ax>az)uv.setXY(i,z,y);else if(ay>az)uv.setXY(i,x,z);else uv.setXY(i,x,y);
 }
 g.userData.metricUV=true;
}
