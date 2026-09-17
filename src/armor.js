import * as THREE from 'three';

// Reference-shaped visual meshes in metres. These are not fabrication drawings.
export function anatomyRows(s,area){return area==='arm'?[[1.634,s*.248,.066,.064,0],[1.57,s*.282,.070,.066,.003],[1.46,s*.321,.062,.056,.005],[1.36,s*.355,.047,.047,.004],[1.28,s*.379,.050,.048,.012],[1.18,s*.403,.038,.035,.022],[1.105,s*.413,.031,.030,.026]]:[[1.04,s*.102,.090,.092,0],[.93,s*.111,.094,.101,.002],[.81,s*.12,.088,.094,.002],[.69,s*.127,.067,.073,.004],[.60,s*.13,.057,.061,.006],[.51,s*.139,.059,.063,-.006],[.40,s*.145,.058,.064,-.014],[.28,s*.15,.042,.047,-.01],[.165,s*.152,.034,.036,-.005]];}
const anatomyCache=new Map();
export function shoulderSurface(s,u,v,w){
 const a=u/.085;
 if(v<0){const y=1.60+v*.90,{c,r}=limbSection(s,'arm',y);return [c.x+s*(r.x+.003+w)*Math.cos(a),y,c.z+(r.y+.003+w)*Math.sin(a)];}
 const b=v/.082,{c,r}=limbSection(s,'arm',1.60);
 return [c.x+s*(-.030*Math.sin(b)+(r.x+.003+w)*Math.cos(b)*Math.cos(a)),1.60+(.082+w)*Math.sin(b)*Math.cos(a*.35),c.z+(r.y+.003+w)*Math.sin(a)];
}
export function limbSection(s,area,y){
 const key=s+area;
 if(!anatomyCache.has(key)){
  const rows=anatomyRows(s,area),center=new THREE.CatmullRomCurve3(rows.map(r=>new THREE.Vector3(r[1],r[0],r[4]))),radii=new THREE.SplineCurve(rows.map(r=>new THREE.Vector2(r[2],r[3])));
  anatomyCache.set(key,Array.from({length:1025},(_,i)=>({c:center.getPoint(i/1024),r:radii.getPoint(i/1024)})));
 }
 const samples=anatomyCache.get(key);let lo=0,hi=1024;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].c.y>y)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],t=THREE.MathUtils.clamp((a.c.y-y)/(a.c.y-b.c.y),0,1);
 return {c:a.c.clone().lerp(b.c,t),r:a.r.clone().lerp(b.r,t)};
}
export const LIMB_FITS={
 biceps:{area:'arm',low:1.416,high:1.491,arc:.72,center:s=>s*Math.PI/2,clearance:.0045,thickness:.0024},
 forearm:{area:'arm',low:1.165,high:1.314,arc:.76,center:s=>s*.28,clearance:.0045,thickness:.0024},
 thigh:{area:'leg',low:.722,high:.976,arc:.65,center:s=>s*.15,clearance:.0045,thickness:.0024},
 hamstring:{area:'leg',low:.728,high:.973,arc:.61,center:()=>Math.PI,clearance:.0045,thickness:.0024},
 shin:{area:'leg',low:.224,high:.525,arc:.67,center:()=>0,clearance:.0045,thickness:.0024}
};
// Closed two-sided parametric shell, including all cut edges. W is outward depth.
export function closedPatch(map,normal,{uSize=1,vSize=1,thickness=.0023,N=56,R=64}={}){
 const positions=[],uv=[],indices=[];
 for(let side=0;side<2;side++)for(let r=0;r<=R;r++)for(let j=0;j<=N;j++){
  const u=j/N*2-1,v=r/R;positions.push(...map(u,v,side?0:thickness));uv.push(j/N*uSize,v*vSize);
 }
 const a=new THREE.Vector3(...map(0,.5,thickness)),du=new THREE.Vector3(...map(.001,.5,thickness)).sub(a),dv=new THREE.Vector3(...map(0,.501,thickness)).sub(a);
 const forward=du.cross(dv).dot(new THREE.Vector3(...normal))>0,C=(N+1)*(R+1);
 const tri=(a,b,c,reverse=false)=>{if(forward!==reverse)indices.push(a,b,c);else indices.push(a,c,b);};
 for(let side=0;side<2;side++)for(let r=0;r<R;r++)for(let j=0;j<N;j++){const a=side*C+r*(N+1)+j,b=a+N+1;tri(a,a+1,b,!!side);tri(b,a+1,b+1,!!side);}
 for(let j=0;j<N;j++)for(const r of [0,R]){const a=r*(N+1)+j;tri(a,a+C,a+1,r>0);tri(a+1,a+C,a+C+1,r>0);}
 for(let r=0;r<R;r++)for(const j of [0,N]){const a=r*(N+1)+j,b=a+N+1;tri(a,b,a+C,j===N);tri(b,b+C,a+C,j===N);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.metricUV=true;return g;
}
export function covertLimbGeometry(s,area,substrate=false){
 const fit=LIMB_FITS[area];
 const map=(u,v,w)=>{
  // Scalloped ends withdraw from flexion creases; rounded taper avoids projecting corners.
  const y=fit.low+(fit.high-fit.low)*v+.010*u*u*(1-2*v),{c,r}=limbSection(s,fit.area,y);
  const taper=.73+.27*Math.sin(Math.PI*v),a=fit.center(s)+u*fit.arc*taper;
  const offset=fit.clearance+(substrate?-.0012:0)+w;
  const crest=area==='shin'?.0015*Math.exp(-u*u*15)*Math.sin(Math.PI*v):.0008*Math.sin(Math.PI*v)*(1-u*u);
  return [c.x+(r.x+offset+crest)*Math.sin(a),y,c.z+(r.y+offset+crest)*Math.cos(a)];
 };
 const mid=fit.center(s);return closedPatch(map,[Math.sin(mid),0,Math.cos(mid)],{uSize:fit.arc*.15,vSize:fit.high-fit.low,thickness:substrate?.0007:fit.thickness,N:40,R:48});
}
const lerpRows=(rows,y)=>{let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],t));};
const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
export function addAdept(api){
 const {mesh,line,box,ellipsoid,fittedShell,groups,mat,remember}=api;
 const component=(m,id,label)=>{m.userData.componentId=id;m.userData.componentLabel=label;return m;};
 const add=(g,material,layer,name,ex,id,label)=>component(mesh(g,material,groups[layer],name,ex),id,label);
 const trim=(name,points,material,radius,layer,ex,id,label)=>component(line(groups[layer],name,points,material,radius,ex),id,label);
 const cube=(name,pos,size,material,layer,ex,id,label)=>component(box(groups[layer],name,pos,size,material,ex),id,label);
 const round=(name,pos,size,material,layer,ex,id,label)=>component(ellipsoid(groups[layer],name,pos,size,material,ex),id,label);
 const torsoRows=[[1.22,.153,.092],[1.34,.186,.103],[1.46,.223,.120],[1.59,.231,.122],[1.655,.219,.096],[1.698,.137,.068]];
 const torso=[];
 for(const d of [1,-1]){
  const name=d===1?'front':'back',id='novasteel-'+name,label='NovaSteel '+name+' breastplate',ex=[0,.012,d*.47];
  const width=v=>lerpRows([[0,.154],[.06,.173],[.49,.175],[.64,.147],[.85,.133],[1,.149]],v)[1];
  const surface=(u,v,w)=>{
   const x=u*width(v),y=1.229+.432*v-.019*bell(u,0,.38)*v**8;
   const [,rx,rz]=lerpRows(torsoRows,y);
   let z=rz*Math.sqrt(Math.max(.06,1-(x/(rx+.006))**2))+.007;
   // Preserve clearance over the existing Ghost fabric pockets.
   const padY=d===1?1.485:1.455,padH=d===1?.125:.206,padX=d===1?.163:.132;
   if(Math.abs(y-padY)<padH&&Math.abs(x)<padX){const radius=d===1?.24:.235;z=Math.max(z,.124+(radius+.013)*Math.sqrt(Math.max(0,1-(x/radius)**2))-radius-.18*(y-padY)**2+.003);}
   const crest=(d===1?.003:.0055)*bell(x,0,.047),rib=.0014*(bell(x,.050,.0022)+bell(x,-.050,.0022));
   return [x,y,d*(z+crest+rib+w)];
  };
  const shell=add(closedPatch(surface,[0,0,d],{uSize:.35,vSize:.432}),mat.coated,2,'NovaSteel '+name+' stamped torso shell',ex,id,label);torso.push(shell);
  const outline=[];for(let i=0;i<=32;i++)outline.push(surface(-1,i/32,.0028));for(let i=0;i<=48;i++)outline.push(surface(-1+2*i/48,1,.0028));for(let i=32;i>=0;i--)outline.push(surface(1,i/32,.0028));for(let i=48;i>=0;i--)outline.push(surface(-1+2*i/48,0,.0028));
  trim('NovaSteel '+name+' rolled perimeter',outline,mat.coated,.0009,2,ex,id,label);
  // Stamped ventilation channels and central strengthening crest from reference photos.
  for(const s of [-1,1]){
   for(const u of [.53,.80])trim('NovaSteel '+name+' longitudinal channel',Array.from({length:14},(_,i)=>surface(s*u,.11+i/13*.31,.0035)),mat.coated,.0018,2,ex,id,label);
   for(const v of [.20,.25,.30,.77,.82,.87])trim('NovaSteel '+name+' diagonal emboss',Array.from({length:9},(_,i)=>surface(s*(.35+.18*i/8),v+.036*i/8,.0035)),mat.coated,.0016,2,ex,id,label);
   for(const v of [.045,.42,.53,.965])trim('NovaSteel '+name+' horizontal emboss',[surface(s*.64,v,.0034),surface(s*.77,v,.0034)],mat.coated,.0018,2,ex,id,label);
  }
  const patch=surface(0,.59,.0045);cube('NovaSteel '+name+' textile identification patch',patch,[.085,.055,.001],mat.hook,2,ex,id,label);
  for(const v of [.16,.95]){const p=surface(0,v,.0042);round('NovaSteel '+name+' flush fastener',p,[.0028,.0028,.0006],mat.fastener,2,ex,id,label);}
 }
 // Integral torso suspension replaces the former multi-vest and abdominal-track harness.
 const carrier='novasteel-carrier',carrierLabel='NovaSteel integral straps';
 for(const s of [-1,1]){
  const side=s<0?'Left':'Right',ex=[s*.04,0,.36];
  const path=[[s*.122,1.584,.136],[s*.145,1.652,.114],[s*.147,1.685,0],[s*.145,1.652,-.114],[s*.122,1.584,-.136]].map(p=>new THREE.Vector3(...p));
  const curve=new THREE.CatmullRomCurve3(path),ribbon=new THREE.Shape();ribbon.moveTo(-.020,-.002);ribbon.lineTo(.020,-.002);ribbon.lineTo(.020,.002);ribbon.lineTo(-.020,.002);ribbon.closePath();
  add(new THREE.ExtrudeGeometry(ribbon,{steps:64,bevelEnabled:false,extrudePath:curve}),mat.strap,5,side+' NovaSteel shoulder strap',ex,carrier,carrierLabel);
  round(side+' NovaSteel shoulder comfort pad',[s*.147,1.677,0],[.026,.010,.072],mat.mesh,5,ex,carrier,carrierLabel);
 }
 for(const y of [1.294,1.390]){
  const [,rx,rz]=lerpRows(torsoRows,y),ex=[0,0,.36];
  component(fittedShell(groups[5],'NovaSteel continuous torso wrap strap',[[y-.0125,0,rx+.010,rz+.016,0],[y+.0125,0,rx+.014,rz+.018,0]],mat.strap,ex,0,Math.PI*2,.002),carrier,carrierLabel);
  for(const s of [-1,1]){cube('NovaSteel low profile side buckle',[s*(rx+.010),y,.014],[.009,.029,.037],mat.edge,5,ex,carrier,carrierLabel);}
 }
 const shoulders=[];
 for(const s of [-1,1]){
  const side=s<0?'Left':'Right',id='novasteel-'+side.toLowerCase()+'-shoulder',label=side+' NovaSteel shoulder plate',ex=[s*.24,.075,.24];
  const surface=(u,v,w)=>{
   const width=.094*(.84+.16*Math.sin(Math.PI*v));
   const rib=.0013*(bell(u,-.55,.035)+bell(u,.55,.035))*(1-v);
   return shoulderSurface(s,u*width,-.102+v*.228,.017+w+rib);
  };
  const shell=add(closedPatch(surface,[s,0,0],{uSize:.178,vSize:.270}),mat.coated,3,side+' NovaSteel formed shoulder shell',ex,id,label);shoulders.push(shell);
  const perimeter=[];for(let i=0;i<=24;i++)perimeter.push(surface(-1,i/24,.0028));for(let i=0;i<=24;i++)perimeter.push(surface(-1+i/12,1,.0028));for(let i=24;i>=0;i--)perimeter.push(surface(1,i/24,.0028));for(let i=24;i>=0;i--)perimeter.push(surface(-1+i/12,0,.0028));
  trim(side+' NovaSteel shoulder folded edge',perimeter,mat.coated,.0009,3,ex,id,label);
  for(const u of [-.55,.55])trim(side+' NovaSteel shoulder stamped channel',Array.from({length:14},(_,i)=>surface(u,.1+i/13*.47,.0032)),mat.coated,.0018,3,ex,id,label);
  for(const v of [.045,.90])trim(side+' NovaSteel shoulder strap slot',[surface(-.18,v,.003),surface(.18,v,.003)],mat.edge,.0016,3,ex,id,label);
  trim(side+' NovaSteel floating suspension',[[s*.171,1.670,0],surface(0,.96,.004)],mat.strap,.009,3,ex,id,label);
 }
 // High-cut shell with an open rim, suspension pads and four-point textile retention.
 const helmetId='novasteel-helmet',helmetLabel='NovaSteel high-cut helmet',helmetEx=[0,.27,-.10];
 const dome=(u,v,w)=>{const a=(u+1)*Math.PI,limit=1.58+.32*Math.max(0,-Math.cos(a))-.04*Math.max(0,Math.cos(a)),p=.003+v*(limit-.003);return [( .103+w)*Math.sin(p)*Math.sin(a),1.935+(.111+w)*Math.cos(p),-.003+(.111+w)*Math.sin(p)*Math.cos(a)];};
 const helmet=add(closedPatch(dome,[0,1,-1],{uSize:.68,vSize:.19,N:96,R:48,thickness:.002}),mat.coated,8,'NovaSteel high-cut helmet shell',helmetEx,helmetId,helmetLabel);
 round('NovaSteel helmet crown closure',[0,2.048,-.003],[.003,.001,.003],mat.coated,8,helmetEx,helmetId,helmetLabel);
 trim('NovaSteel helmet rim',Array.from({length:97},(_,i)=>dome(-1+i/48,1,.0024)),mat.rubber,.0024,8,helmetEx,helmetId,helmetLabel);
 for(let i=0;i<6;i++){const a=i*Math.PI/3;round('NovaSteel helmet suspension cushion',[Math.sin(a)*.082,1.962,Math.cos(a)*.091-.003],[.013,.023,.009],mat.mesh,8,helmetEx,helmetId,helmetLabel);}
 for(const s of [-1,1]){
  trim('NovaSteel helmet chin retention',[[s*.094,1.936,.037],[s*.078,1.855,.045],[s*.034,1.798,.040]],mat.strap,.006,8,helmetEx,helmetId,helmetLabel);
  trim('NovaSteel helmet rear retention',[[s*.093,1.913,-.047],[s*.078,1.855,.045]],mat.strap,.0055,8,helmetEx,helmetId,helmetLabel);
 }
 round('NovaSteel helmet chin cradle',[0,1.798,.040],[.037,.007,.012],mat.leather,8,helmetEx,helmetId,helmetLabel);
 const circletId='novasteel-circlet',circletLabel='Dedicated flip-mandible circlet',circletEx=[0,.25,.13];
 trim('Dedicated welded mandible circlet',Array.from({length:97},(_,i)=>dome(-1+i/48,.965,.006)),mat.edge,.004,8,circletEx,circletId,circletLabel);
 for(const s of [-1,1]){
  for(const y of [1.946,1.961])cube('Circlet slotted side rail',[s*.110,y,-.015],[.008,.004,.077],mat.edge,8,circletEx,circletId,circletLabel);
  for(const z of [-.052,-.02,.02])cube('Circlet rail bridge',[s*.110,1.954,z],[.008,.019,.006],mat.edge,8,circletEx,circletId,circletLabel);
  round('Dedicated sealed mandible pivot',[s*.114,1.939,.020],[.009,.011,.011],mat.fastener,8,circletEx,circletId,circletLabel);
 }
 for(const x of [-.020,.020])cube('Circlet front shroud side',[x,1.998,.095],[.005,.043,.007],mat.edge,8,circletEx,circletId,circletLabel);
 for(const y of [1.979,2.019])cube('Circlet front shroud bridge',[0,y,.095],[.041,.005,.007],mat.edge,8,circletEx,circletId,circletLabel);
 const mandibleId='novasteel-mandible',mandibleLabel='NovaSteel flip mandible Gen 2',mandibleEx=[0,.13,.40];
 const face=(u,v,w)=>{const a=u*1.38,y=1.820+.102*v+.014*u*u*v-.008*u*u*(1-v),radius=.124+w;return [radius*Math.sin(a),y,.015+radius*Math.cos(a)];};
 const mandible=add(closedPatch(face,[0,0,1],{uSize:.342,vSize:.102,thickness:.002,N:64,R:40}),mat.coated,8,'NovaSteel solid flip mandible',mandibleEx,mandibleId,mandibleLabel);
 for(const v of [0,1])trim('NovaSteel mandible rolled margin',Array.from({length:49},(_,i)=>face(-1+i/24,v,.0027)),mat.coated,.0009,8,mandibleEx,mandibleId,mandibleLabel);
 for(const s of [-1,1])trim('NovaSteel mandible hinge arm',[[s*.119,1.915,.043],[s*.124,1.930,.039],[s*.114,1.939,.020]],mat.coated,.0048,8,mandibleEx,mandibleId,mandibleLabel);
 // The shield is held by a central handle, not fixed to the forearm plate.
 const bucklerId='novasteel-buckler',bucklerLabel='NovaSteel ballistic buckler',bucklerEx=[-.35,.03,.25],origin=new THREE.Vector3(-.434,1.057,.152);
 const outline=[[-.047,.155],[.047,.155],[.077,.120],[.103,.120],[.155,.020],[.140,-.077],[.063,-.150],[-.063,-.150],[-.140,-.077],[-.155,.020],[-.103,.120],[-.077,.120]];
 const shape=new THREE.Shape();outline.forEach(([x,y],i)=>{const prev=outline[(i+outline.length-1)%outline.length],next=outline[(i+1)%outline.length],a=[x+(prev[0]-x)*.08,y+(prev[1]-y)*.08],b=[x+(next[0]-x)*.08,y+(next[1]-y)*.08];if(i===0)shape.moveTo(...a);else shape.lineTo(...a);shape.quadraticCurveTo(x,y,...b);});shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.0023,bevelEnabled:true,bevelSize:.001,bevelThickness:.0006,bevelSegments:3,curveSegments:8});geometry.translate(...origin.toArray());
 const buckler=add(geometry,mat.coated,9,'NovaSteel faceted buckler shell',bucklerEx,bucklerId,bucklerLabel);
 const edge=outline.map(([x,y])=>[x+origin.x,y+origin.y,origin.z+.0028]);edge.push(edge[0]);trim('NovaSteel buckler folded rim',edge,mat.coated,.0011,9,bucklerEx,bucklerId,bucklerLabel);
 round('NovaSteel buckler central boss',[origin.x,origin.y,origin.z+.008],[.061,.072,.033],mat.coated,9,bucklerEx,bucklerId,bucklerLabel);
 for(const s of [-1,1])for(const x of [.074,.101])trim('NovaSteel buckler reinforcement channel',[[origin.x+s*x,origin.y-.091,origin.z+.003],[origin.x+s*x,origin.y+.080,origin.z+.003]],mat.coated,.0017,9,bucklerEx,bucklerId,bucklerLabel);
 const grip=[[origin.x,origin.y-.087,origin.z-.004],[origin.x,origin.y-.067,.040],[origin.x,origin.y+.067,.040],[origin.x,origin.y+.087,origin.z-.004]];
 trim('NovaSteel buckler central handle',grip,mat.edge,.008,9,bucklerEx,bucklerId,bucklerLabel);
 trim('NovaSteel buckler rubber grip',[[origin.x,origin.y-.042,.040],[origin.x,origin.y+.042,.040]],mat.rubber,.010,9,bucklerEx,bucklerId,bucklerLabel);
 for(const y of [-.106,-.088,.088,.106])round('NovaSteel buckler handle fastener',[origin.x,origin.y+y,origin.z+.003],[.0035,.0035,.001],mat.fastener,9,bucklerEx,bucklerId,bucklerLabel);
 return {torso,shoulders,helmet,mandible,buckler};
}
