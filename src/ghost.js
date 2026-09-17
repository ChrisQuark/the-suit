import * as THREE from 'three';

// Published flat dimensions; fitted geometry bends these outlines without scaling them.
// Sources and size choices are repeated in the compact product cards.
export const GHOST_SPECS={
 chest:{width:.335,height:.245,thickness:.00825,pitch:.030,outline:[[-.30,.92],[.30,.92],[.46,1],[.59,.88],[.68,.08],[1,-.19],[.99,-.39],[.86,-.84],[.48,-1],[.28,-.78],[-.28,-.78],[-.48,-1],[-.86,-.84],[-.99,-.39],[-1,-.19],[-.68,.08],[-.59,.88],[-.46,1]]},
 back:{width:.262,height:.404,thickness:.008,pitch:.027,outline:[[-.27,.96],[.27,.96],[.39,1],[.58,.93],[.69,.69],[1,.43],[.94,-.10],[.66,-.31],[.63,-.81],[.44,-.96],[0,-1],[-.44,-.96],[-.63,-.81],[-.66,-.31],[-.94,-.10],[-1,.43],[-.69,.69],[-.58,.93],[-.39,1]]},
 limb:{width:.147,height:.240,thickness:.011,pitch:.020,outline:[[-.20,1],[.20,1],[.22,.98],[.52,.99],[.67,.94],[.98,.67],[.73,.55],[.75,.48],[1,.42],[.72,-.50],[.56,-.85],[.35,-.97],[0,-1],[-.35,-.97],[-.56,-.85],[-.72,-.50],[-1,.42],[-.75,.48],[-.73,.55],[-.98,.67],[-.67,.94],[-.52,.99],[-.22,.98]]},
 shoulder:{width:.154,height:.193,thickness:.011,pitch:.020,outline:[[-.19,1],[.19,1],[.23,.97],[.56,.94],[.82,.82],[1,.62],[.91,.05],[.72,-.04],[.84,-.13],[.63,-.71],[.43,-.94],[0,-1],[-.43,-.94],[-.63,-.71],[-.84,-.13],[-.72,-.04],[-.91,.05],[-1,.62],[-.82,.82],[-.56,.94],[-.23,.97]]},
 met:{width:.108,height:.134,thickness:.006,pitch:.017,outline:[[-.55,1],[.55,1],[.80,.82],[1,.35],[.98,-.18],[.82,-.90],[.62,-1],[-.62,-1],[-.82,-.90],[-.98,-.18],[-1,.35],[-.80,.82]]}
};

function roundPath(points,Path=THREE.Shape,round=.08){
 const p=new Path();
 points.forEach((v,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],x=[v[0]+(a[0]-v[0])*round,v[1]+(a[1]-v[1])*round],y=[v[0]+(b[0]-v[0])*round,v[1]+(b[1]-v[1])*round];if(i===0)p.moveTo(...x);else p.lineTo(...x);p.quadraticCurveTo(...v,...y);});p.closePath();return p;
}
function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function extrude(shape,depth,bevel=.0003){return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:3});}
function dense(g){
 let positions=Array.from(g.attributes.position.array);
 for(let pass=0;pass<5;pass++){
  const out=[];for(let i=0;i<positions.length;i+=9){const a=positions.slice(i,i+3),b=positions.slice(i+3,i+6),c=positions.slice(i+6,i+9);const dist=(a,b)=>Math.hypot(...a.map((x,j)=>x-b[j]));if(Math.max(dist(a,b),dist(b,c),dist(c,a))<.015){out.push(...a,...b,...c);continue;}const mid=(a,b)=>a.map((x,j)=>(x+b[j])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);out.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);}positions=out;
 }
 g.dispose();const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.computeVertexNormals();return out;
}
export function deformGeometry(original,map){
 const g=original.clone(),p=g.attributes.position,uv=[];
 for(let i=0;i<p.count;i++){const u=p.getX(i),v=p.getY(i),w=p.getZ(i);const q=map(u,v,w);p.setXYZ(i,...q);uv.push(u*8,v*8);}
 const zero=new THREE.Vector3(...map(0,0,0));const d=[0,1,2].map(i=>{const a=[0,0,0];a[i]=.0001;return new THREE.Vector3(...map(...a)).sub(zero);});
 if(d[0].clone().cross(d[1]).dot(d[2])<0){const indices=[];for(let i=0;i<p.count;i+=3)indices.push(i,i+2,i+1);g.setIndex(indices);}
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
const cache=new Map();
export function ghostGeometry(kind){
 if(cache.has(kind))return cache.get(kind);
 const spec=GHOST_SPECS[kind],outline=spec.outline.map(([x,y])=>[x*spec.width/2,y*spec.height/2]),shape=roundPath(outline);
 const backing=dense(extrude(shape,.0006,0)),cells=[],pitch=spec.pitch,h=pitch*Math.sqrt(3)/2;
 for(let row=-Math.ceil(spec.height/h);row<=Math.ceil(spec.height/h);row++)for(let col=-Math.ceil(spec.width/pitch);col<=Math.ceil(spec.width/pitch);col++){
  const x=col*pitch+(row%2)*pitch/2,y=row*h;
  for(const verts of [[[x,y],[x+pitch,y],[x+pitch/2,y+h]],[[x+pitch,y],[x+pitch*1.5,y+h],[x+pitch/2,y+h]]]){
   const c=[verts.reduce((a,p)=>a+p[0],0)/3,verts.reduce((a,p)=>a+p[1],0)/3];
   const outer=verts.map(p=>p.map((x,i)=>c[i]+(x-c[i])*.86));
   if(!outer.every(([u,v])=>inside([u/ .92,v/.92],outline)))continue;
   const cell=roundPath(outer),inner=outer.map(p=>p.map((x,i)=>c[i]+(x-c[i])*.57));cell.holes.push(roundPath(inner,THREE.Path,.11));cells.push(cell);
  }
 }
 const lattice=extrude(cells,spec.thickness-.0012,.0003);lattice.translate(0,0,.0009);
 const rimShape=roundPath(outline.map(p=>p.map(v=>v*.992)));rimShape.holes.push(roundPath(outline.map(p=>p.map(v=>v*.965)),THREE.Path));
 const rim=extrude(rimShape,spec.thickness*.48,.0002);rim.translate(0,0,.0006);
 const pocketOutline=outline.map(([u,v])=>[u*1.045,v*1.045]);const pocketShape=roundPath(pocketOutline);pocketShape.holes.push(roundPath([[-spec.width*.19,spec.height*.33-.0018],[spec.width*.19,spec.height*.33-.0018],[spec.width*.19,spec.height*.33+.0018],[-spec.width*.19,spec.height*.33+.0018]],THREE.Path,.05));const pocket=dense(extrude(pocketShape,.0008,0));pocket.translate(0,0,spec.thickness+.0012);
 const geometries={backing,lattice,rim,pocket,outline,pocketOutline,cellCount:cells.length,spec};cache.set(kind,geometries);return geometries;
}

// Flat pattern dimensions remain unchanged as the insert follows a cylindrical limb.
export function limbSurface({cx,cy,cz,radius,back=false,lean=0}){
 return (u,v,w)=>{const a=u/radius,r=radius+w;return [cx+r*Math.sin(a)+lean*v,cy+v,cz+(back?-1:1)*(r*Math.cos(a))];};
}
