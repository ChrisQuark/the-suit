import * as THREE from 'three';
import { ghostGeometry, deformGeometry, limbSurface } from './ghost.js';

// Deterministic microstructure stays self-contained, with no downloaded textures.
function surface(kind, repeats=8){
  const size=256, data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const hash=Math.sin(x*127.1+y*311.7)*43758.5453,noise=hash-Math.floor(hash);
    const u=x%16,v=y%16;
    let h=.5;
    if(kind==='knit')h=.46+.22*Math.cos((u/16-Math.abs(v/8-1)*.42)*Math.PI*2)+.08*Math.sin(v*Math.PI/2);
    if(kind==='carbon'){const over=(Math.floor(x/8)+Math.floor(y/8))%4<2;h=.39+.23*Math.sin((over?x:y)*Math.PI/4)+.12*(over?1:0);}
    if(kind==='nylon')h=.5+.16*Math.sin(x*Math.PI/2)+.12*Math.cos(y*Math.PI/4);
    if(kind==='metal')h=.57+.04*Math.sin(y*1.2)+.035*Math.sin(y*.31+x*.018);
    if(kind==='rubber')h=.45+.13*Math.sin(x*.7)*Math.sin(y*.65);
    const c=Math.round(255*Math.max(0,Math.min(1,h+(noise-.5)*(kind==='metal'?.09:.13))));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeats,repeats);t.anisotropy=8;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
// Every component is independent geometry. Coordinates are in metres.
export function buildSuit(materials = {}) {
  const root = new THREE.Group(); root.name = 'Original modular protective suit';
  const knitMap=surface('knit',24),carbonMap=surface('carbon',22),nylonMap=surface('nylon',16),metalMap=surface('metal',5),rubberMap=surface('rubber',7);
  const mat = {
    knit:new THREE.MeshPhysicalMaterial({color:0x17191b,roughness:.93,metalness:0,bumpMap:knitMap,bumpScale:.00032,sheen:.22,sheenColor:0x535966,sheenRoughness:.85}),
    seam:new THREE.MeshStandardMaterial({color:0x25272a,roughness:.96}),
    skin:new THREE.MeshStandardMaterial({color:0x16191d,roughness:.38,metalness:.16}),
    pad:new THREE.MeshPhysicalMaterial({color:0xd57619,roughness:.59,metalness:0,clearcoat:.08,clearcoatRoughness:.6,bumpMap:rubberMap,bumpScale:.000045}),
    padBacking:new THREE.MeshStandardMaterial({color:0x111518,roughness:.98,bumpMap:knitMap,bumpScale:.00012}),
    pocket:new THREE.MeshPhysicalMaterial({color:0x202326,roughness:.91,bumpMap:knitMap,bumpScale:.0002,sheen:.18}),
    soft:new THREE.MeshStandardMaterial({color:0x242629,roughness:.96,bumpMap:nylonMap,bumpScale:.0005}),
    carbon:new THREE.MeshStandardMaterial({color:0x27292c,roughness:.44,metalness:.28,map:carbonMap,bumpMap:carbonMap,bumpScale:.00025}),
    strap:new THREE.MeshStandardMaterial({color:0x17191b,roughness:.96,bumpMap:nylonMap,bumpScale:.0006}),
    metal:new THREE.MeshPhysicalMaterial({color:0xc5ccd4,metalness:1,roughness:.19,bumpMap:metalMap,bumpScale:.000035,clearcoat:.30,clearcoatRoughness:.32,iridescence:.025,iridescenceIOR:1.3,iridescenceThicknessRange:[120,220]}),
    edge:new THREE.MeshStandardMaterial({color:0x14181d,roughness:.6,metalness:.55}),
    rubber:new THREE.MeshStandardMaterial({color:0x141619,roughness:.88,bumpMap:rubberMap,bumpScale:.0006}),
    fastener:new THREE.MeshStandardMaterial({color:0x555c65,metalness:.7,roughness:.42}),
    hook:new THREE.MeshStandardMaterial({color:0x3e443a,roughness:1}),
    ...materials
  };
  const groups=Array.from({length:8},(_,i)=>{const g=new THREE.Group();g.userData.layer=i;g.name=['Cut-resistant knit','Impact pads','Soft ballistic vest','Rigid stab vest','Concealed neck armor','Webbing harness','Outer plates','Gloves and boots'][i];root.add(g);return g;});
  const mannequin=new THREE.Group();mannequin.name='Neutral mannequin';root.add(mannequin);
  const hardware=new THREE.Group();hardware.name='Attachment hardware';root.add(hardware);
  const parts=[], hardwareParts=[], collarKnits=[], pads=[];
  function mesh(geometry,material,parent,name,explode=[0,0,0]){
    const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);
    m.userData.layer=parent.userData.layer??5;m.userData.rest=m.position.clone();m.userData.explode=new THREE.Vector3(...explode);
    if(parent===hardware){hardwareParts.push(m);m.userData.hardware=true;} else if(parent!==mannequin)parts.push(m);
    return m;
  }
  function remember(m){m.userData.rest.copy(m.position);return m;}
  function ellipsoid(parent,name,pos,scale,material,explode=[0,0,0],segments=32){
    const m=mesh(new THREE.SphereGeometry(1,segments,24),material,parent,name,explode);m.position.set(...pos);m.scale.set(...scale);return remember(m);
  }
  function box(parent,name,pos,size,material,explode=[0,0,0]){const m=mesh(new THREE.BoxGeometry(...size),material,parent,name,explode);m.position.set(...pos);return remember(m);}
  function link(parent,name,a,b,rx,rz,material,explode=[0,0,0]){
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);
    const length=v.length();
    const profile=[[0,.94],[.12,1.02],[.34,1.03],[.58,.92],[.81,.77],[1,.66]].map(([t,r])=>new THREE.Vector2(rx*r,(t-.5)*length));
    const m=mesh(new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(40),48),material,parent,name,explode);m.scale.z=rz/rx;m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return remember(m);
  }
  function rings(parent,name,rows,material,explode=[0,0,0],start=0,end=Math.PI*2){
    if(rows.length>4){const original=rows,curve=new THREE.CatmullRomCurve3(rows.map(r=>new THREE.Vector3(r[1],r[0],r[2])));rows=curve.getPoints((rows.length-1)*6).map((p,i)=>[p.y,p.x,p.z,original[Math.min(original.length-1,Math.round(i/6))][3]||0]);}
    const n=64,vs=[],uv=[],idx=[];
    rows.forEach(([y,rx,rz,cz=0],r)=>{for(let j=0;j<=n;j++){let a=start+(end-start)*j/n;vs.push(Math.sin(a)*rx,y,Math.cos(a)*rz+cz);uv.push(j/n,r/(rows.length-1));}});
    for(let r=0;r<rows.length-1;r++)for(let j=0;j<n;j++){const a=r*(n+1)+j,b=a+n+1;idx.push(a,a+1,b,b,a+1,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    return mesh(g,material,parent,name,explode);
  }
  function fittedShell(parent,name,rows,material,explode,start=-Math.PI,end=Math.PI,thickness=.003){
    if(rows.length>2){const centers=new THREE.CatmullRomCurve3(rows.map(r=>new THREE.Vector3(r[1],r[0],r[4]||0))),radii=new THREE.SplineCurve(rows.map(r=>new THREE.Vector2(r[2],r[3])));rows=Array.from({length:25},(_,i)=>{const c=centers.getPoint(i/24),r=radii.getPoint(i/24);return [c.y,c.x,r.x,r.y,c.z];});}
    const N=48,R=rows.length,vs=[],uv=[],idx=[];
    for(let side=0;side<2;side++)for(let r=0;r<R;r++)for(let j=0;j<=N;j++){
      const [y,cx,rx,rz,cz=0]=rows[r],a=start+(end-start)*j/N,t=side?-thickness:0;
      vs.push(cx+Math.sin(a)*(rx+t),y,cz+Math.cos(a)*(rz+t));uv.push(j/N,r/(R-1));
    }
    const count=R*(N+1),forward=end>start;
    function tri(a,b,c,reverse=false){if(forward!==reverse)idx.push(a,b,c);else idx.push(a,c,b);}
    for(let side=0;side<2;side++)for(let r=0;r<R-1;r++)for(let j=0;j<N;j++){const a=side*count+r*(N+1)+j,b=a+N+1;tri(a,a+1,b,!!side);tri(b,a+1,b+1,!!side);}
    for(let j=0;j<N;j++)for(const r of [0,R-1]){const a=r*(N+1)+j;tri(a,a+count,a+1,r>0);tri(a+1,a+count,a+count+1,r>0);}
    for(let r=0;r<R-1;r++)for(const j of [0,N]){const a=r*(N+1)+j,b=a+N+1;tri(a,b,a+count,j===N);tri(b,b+count,a+count,j===N);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(g,material,parent,name,explode);
  }
  function shoulderRibbon(name,x,explode){
    const path=new THREE.CatmullRomCurve3([[x,1.34,.155],[x,1.55,.157],[x,1.66,.11],[x,1.685,0],[x,1.66,-.11],[x,1.55,-.157],[x,1.34,-.155]].map(v=>new THREE.Vector3(...v)));
    const shape=new THREE.Shape();shape.moveTo(-.0125,-.001);shape.lineTo(.0125,-.001);shape.lineTo(.0125,.001);shape.lineTo(-.0125,.001);shape.closePath();
    return mesh(new THREE.ExtrudeGeometry(shape,{steps:80,bevelEnabled:false,extrudePath:path}),mat.strap,groups[5],name,explode);
  }
  function tailoredLimb(parent,name,rows,material,explode){
    const center=new THREE.CatmullRomCurve3(rows.map(r=>new THREE.Vector3(r[1],r[0],r[4]||0)));
    const radii=new THREE.SplineCurve(rows.map(r=>new THREE.Vector2(r[2],r[3])));
    const vs=[],uv=[],idx=[],R=96,N=48;
    for(let i=0;i<=R;i++){
      const t=i/R,c=center.getPoint(t),r=radii.getPoint(t);
      for(let j=0;j<=N;j++){
        const a=j/N*Math.PI*2;
        // Irregular, shallow compression folds around the articulated joints.
        const joint=name.includes('sleeve')?Math.exp(-Math.pow((c.y-1.36)/.038,2)):Math.exp(-Math.pow((c.y-.60)/.05,2));
        const wrinkle=.0009*joint*(Math.sin(c.y*390+a*2)+.35*Math.sin(c.y*680-a*3));
        vs.push(c.x+(r.x+wrinkle)*Math.sin(a),c.y,c.z+(r.y+wrinkle)*Math.cos(a));uv.push(j/N,t*1.3);
      }
    }
    for(let i=0;i<R;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const inner=mesh(g.clone(),mat.skin,mannequin,name+' mannequin');inner.scale.set(.99,1,.99);return mesh(g,material,parent,name,explode);
  }
  function shellRelief(name,x,y){
    const bell=(v,c,w)=>Math.exp(-Math.pow((v-c)/w,2));
    if(name.includes('chest plate')){
      // Two pectoral volumes, a recessed sternum and curved lower rib boundary.
      const pec=.024*bell(Math.abs(x),.105,.078)*bell(y,1.546,.080);
      const sternum=.007*bell(x,0,.018)*bell(y,1.54,.105);
      return pec-sternum-.016*Math.pow((y-1.54)/.16,2);
    }
    if(name.includes('back plate'))return .014*bell(Math.abs(x),.105,.073)*bell(y,1.555,.09)-.008*bell(x,0,.024)-.014*Math.pow((y-1.54)/.16,2);
    if(name.includes('Abdominal lame')){
      const i=Number(name.match(/lame (\d)/)?.[1]||1)-1,cy=1.405-i*.055-.031;
      return .009*bell(Math.abs(x),.064,.047)*bell(y,cy,.030)-.003*bell(x,0,.015);
    }
    if(name.includes('thigh plate'))return .008*bell(x,0,.043)*bell(y,.887,.125)-.16*Math.pow(y-.88,2);
    if(name.includes('shin plate'))return .007*bell(x,0,.019)-.12*Math.pow(y-.36,2);
    if(name.includes('forearm plate'))return .007*bell(x,0,.026)*bell(y,1.25,.09)-.22*Math.pow(y-1.245,2);
    return 0;
  }
  function panel(parent,name,outline,z,thickness,material,explode=[0,0,0],curve=.0,curveOrigin=0){
    const shape=new THREE.Shape();
    const rounding=name.includes('Abdominal')?.035:.075;
    for(let i=0;i<outline.length;i++){
      const prev=outline[(i+outline.length-1)%outline.length],p=outline[i],next=outline[(i+1)%outline.length];
      const a=[p[0]+(prev[0]-p[0])*rounding,p[1]+(prev[1]-p[1])*rounding],b=[p[0]+(next[0]-p[0])*rounding,p[1]+(next[1]-p[1])*rounding];
      if(i===0)shape.moveTo(...a);else shape.lineTo(...a);shape.quadraticCurveTo(...p,...b);
    }shape.closePath();
    const isCarrier=name.startsWith('Hyperline'),bevel=isCarrier?Math.min(thickness*.12,.00035):.0015;
    let geo=new THREE.ExtrudeGeometry(shape,{depth:isCarrier?thickness-2*bevel:thickness,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:4,steps:1,curveSegments:12});
    if(isCarrier)geo.translate(0,0,bevel);
    // Subdivide broad faces before bending, so the shell follows the body
    // instead of creating flat chords that intersect the underlying garment.
    if(curve){for(let step=0;step<4;step++){
      const p=geo.attributes.position,n=geo.attributes.normal,positions=[],normals=[];
      const emit=(vs,ns)=>{vs.forEach(v=>positions.push(...v));ns.forEach(v=>normals.push(...v));};
      const mid=(a,b)=>a.map((v,k)=>(v+b[k])/2);
      for(let i=0;i<p.count;i+=3){const vs=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]),ns=[0,1,2].map(j=>[n.getX(i+j),n.getY(i+j),n.getZ(i+j)]);
        const large=vs.some((v,k)=>Math.hypot(...v.map((x,j)=>x-vs[(k+1)%3][j]))>.028);
        if(!large){emit(vs,ns);continue;}const ab=mid(vs[0],vs[1]),bc=mid(vs[1],vs[2]),ca=mid(vs[2],vs[0]),nab=mid(ns[0],ns[1]),nbc=mid(ns[1],ns[2]),nca=mid(ns[2],ns[0]);
        emit([vs[0],ab,ca],[ns[0],nab,nca]);emit([ab,vs[1],bc],[nab,ns[1],nbc]);emit([ca,bc,vs[2]],[nca,nbc,ns[2]]);emit([ab,bc,ca],[nab,nbc,nca]);
      }
      geo.dispose();geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    }}
    const p=geo.attributes.position,n=geo.attributes.normal;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)-curveOrigin,y=p.getY(i),e=.0001;
      const h=shellRelief(name,x,y),dx=(shellRelief(name,x+e,y)-shellRelief(name,x-e,y))/(2*e),dy=(shellRelief(name,x,y+e)-shellRelief(name,x,y-e))/(2*e);
      p.setZ(i,p.getZ(i)+z-curve*x*x+h);
      const normal=new THREE.Vector3(n.getX(i)+(2*curve*x-dx)*n.getZ(i),n.getY(i)-dy*n.getZ(i),n.getZ(i)).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    const uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*3;uv[i*2+1]=p.getY(i)*3;}geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    return mesh(geo,material,parent,name,explode);
  }
  function line(parent,name,points,material,radius=.0013,explode=[0,0,0]){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,24,radius,5,false),material,parent,name,explode);}
  function ghostPad(name,kind,map,explode){
    const g=ghostGeometry(kind);
    let main;
    for(const [key,material] of [['backing',mat.padBacking],['lattice',mat.pad],['rim',mat.pad]]){
      const m=mesh(deformGeometry(g[key],map),material,groups[1],`${name} ${key}`,explode);
      m.userData.ghostKind=kind;m.userData.keepDark=key==='backing';m.userData.catalogDimensions=[g.spec.width,g.spec.height,g.spec.thickness];
      if(key==='lattice'){main=m;main.userData.cellCount=g.cellCount;pads.push(main);}
    }
    const pocket=mesh(deformGeometry(g.pocket,map),mat.pocket,groups[0],`${name} external Cutlon pocket`);pocket.userData.isPadPocket=true;
    const edge=g.pocketOutline.map(([u,v])=>map(u,v,g.spec.thickness+.002));edge.push(edge[0]);
    const seam=line(groups[0],`${name} pocket flatlock seam`,edge,mat.seam,.00055);seam.userData.isPadPocket=true;
    const lip=line(groups[0],`${name} pocket insertion opening`,[-1,-.5,0,.5,1].map(t=>map(t*g.spec.width*.19,g.spec.height*.33,g.spec.thickness+.0025)),mat.strap,.0011);lip.userData.isPadPocket=true;
    return main;
  }
  // Neutral head and a complete under-body prevent voids when layers are removed.
  const headProfile=new THREE.CatmullRomCurve3([new THREE.Vector3(.040,1.785,.052),new THREE.Vector3(.061,1.805,.068),new THREE.Vector3(.077,1.85,.077),new THREE.Vector3(.079,1.92,.075),new THREE.Vector3(.060,1.959,.056),new THREE.Vector3(.016,1.976,.018)]);
  rings(mannequin,'Sculpted featureless mannequin head',headProfile.getPoints(36).map(p=>[p.y,p.x,p.z,-.001]),mat.skin);
  ellipsoid(mannequin,'Crown',[0,1.96,-.006],[.044,.019,.044],mat.skin);
  ellipsoid(mannequin,'Left ear',[-.079,1.867,0],[.012,.025,.013],mat.skin);
  ellipsoid(mannequin,'Right ear',[.079,1.867,0],[.012,.025,.013],mat.skin);
  link(mannequin,'Bare neck',[0,1.675,0],[0,1.811,0],.057,.059,mat.skin);
  const torsoRows=[[.98,.131,.082,0],[1.06,.165,.095,0],[1.13,.155,.090,0],[1.22,.153,.092,0],[1.34,.186,.103,0],[1.46,.223,.12,0],[1.59,.231,.122,0],[1.655,.219,.096,0],[1.698,.137,.068,0],[1.73,.06,.058,0]];
  rings(mannequin,'Mannequin torso',torsoRows,mat.skin);
  rings(groups[0],'Tailored knit torso',torsoRows.map(([y,x,z,c])=>[y,x+.002,z+.002,c]),mat.knit,[0,0,-.05]);
  const collar=rings(groups[0],'Soft outer turtleneck',[[1.681,.098,.078],[1.705,.077,.072],[1.743,.071,.070],[1.784,.064,.064],[1.801,.060,.06]],mat.knit,[0,.05,-.12]);collarKnits.push(collar);
  const hem=rings(groups[0],'Rolled collar hem',[[1.796,.061,.061],[1.801,.062,.062],[1.804,.060,.060]],mat.seam,[0,.05,-.12]);collarKnits.push(hem);
  for(const s of [-1,1]){
    const side=s<0?'Left':'Right';
    // Organic knit sleeve silhouette, relaxed A stance.
    ellipsoid(mannequin,`${side} shoulder`,[s*.237,1.615,0],[.080,.072,.072],mat.skin);
    ellipsoid(groups[0],`${side} shoulder knit`,[s*.244,1.604,0],[.082,.075,.074],mat.knit,[s*.055,0,-.035]);
    const armA=[s*.274,1.593,0],armB=[s*.355,1.359,.004],armC=[s*.409,1.11,.026];
    tailoredLimb(groups[0],`${side} continuous tailored sleeve`,[[1.634,s*.248,.066,.064,0],[1.57,s*.282,.070,.066,.003],[1.46,s*.321,.062,.056,.005],[1.36,s*.355,.047,.047,.004],[1.28,s*.379,.050,.048,.012],[1.18,s*.403,.038,.035,.022],[1.105,s*.413,.031,.030,.026]],mat.knit,[s*.055,0,-.035]);
    // Leg tapers, separated at crotch. Knees have flexible fabric only.
    const thighA=[s*.102,1.036,0],thighB=[s*.127,.60,.008],ankle=[s*.15,.155,-.005];
    tailoredLimb(groups[0],`${side} continuous tailored leg`,[[1.04,s*.102,.090,.092,0],[.93,s*.111,.094,.101,.002],[.81,s*.12,.088,.094,.002],[.69,s*.127,.067,.073,.004],[.60,s*.13,.057,.061,.006],[.51,s*.139,.059,.063,-.006],[.40,s*.145,.058,.064,-.014],[.28,s*.15,.042,.047,-.01],[.165,s*.152,.034,.036,-.005]],mat.knit,[s*.045,0,-.025]);
    // Garment seams are tailoring details, never a hard plate attachment.
    line(groups[0],`${side} torso seam`,[[s*.155,1.08,.047],[s*.16,1.27,.058],[s*.195,1.44,.077],[s*.194,1.59,.084]],mat.seam,.001,[0,0,-.05]);
    // Narrow compression wrinkles follow the joint, with sewn garment seams.
    line(groups[0],`${side} sleeve flatlock`,[[s*.321,1.51,.065],[s*.347,1.40,.053],[s*.375,1.29,.060],[s*.411,1.14,.055]],mat.seam,.0008,[s*.055,0,-.035]);
    // Ghost L2 inserts follow the real flat patterns and sit in exterior Cutlon pockets.
    ghostPad(`${side} Ghost shoulder`,'shoulder',(u,v,w)=>{
      const a=u/.079,b=(v+.018)/.108;
      return [s*(.249+(.073+w)*Math.cos(a)*Math.cos(b)),1.598+(.083+w)*Math.sin(b),(.079+w)*Math.sin(a)];
    },[s*.15,.07,.13]);
    ghostPad(`${side} Ghost elbow`,'limb',limbSurface({cx:s*.355,cy:1.36,cz:.003,radius:.061,back:true,lean:-s*.27}),[s*.15,0,-.20]);
    ghostPad(`${side} Ghost knee`,'limb',limbSurface({cx:s*.131,cy:.61,cz:.005,radius:.074,lean:-s*.035}),[s*.13,0,.23]);
    // Concealed sleeve mounts: hook surface on the sleeve, loop on plate back.
    for(const [loc,y,x,z,w,h] of [['forearm',1.239,s*.404,.059,.086,.050],['thigh',.842,s*.148,.098,.123,.052],['shin',.365,s*.15,.064,.089,.053]]){
      const ex=[s*.32,0,.40];
      box(hardware,`${side} ${loc} sewn sleeve`,[x,y,z-.007],[w+.014,h+.014,.009],mat.strap,[s*.075,0,.09]);
      box(hardware,`${side} ${loc} hook on sleeve`,[x,y,z],[w,h,.005],mat.hook,[s*.09,0,.115]);
      box(hardware,`${side} ${loc} loop on plate back`,[x,y,z+.009],[w,h,.004],mat.strap,ex);
      for(let k=0;k<7;k++)box(hardware,`${side} ${loc} hook texture ${k}`,[x-w*.4+k*w*.13,y,z+.003],[.002,h*.83,.001],mat.fastener,[s*.09,0,.115]);
    }
    // Outer limb panels deliberately independent of shoulders, chest and joints.
    const shoulderGeo=new THREE.SphereGeometry(1,64,36,0,Math.PI*2,0,Math.PI*.60);
    const shoulder=mesh(shoulderGeo,mat.metal,groups[6],`${side} independent shoulder cap`,[s*.30,.075,.36]);shoulder.position.set(s*.258,1.623,.003);shoulder.scale.set(.095,.076,.092);shoulder.rotation.z=-s*.24;remember(shoulder);
    const innerShoulder=mesh(shoulderGeo.clone(),new THREE.MeshStandardMaterial({color:0x101318,roughness:.70,metalness:.25,side:THREE.BackSide}),groups[6],`${side} shoulder shell inner face`,[s*.30,.075,.36]);innerShoulder.position.copy(shoulder.position);innerShoulder.scale.copy(shoulder.scale).multiplyScalar(.97);innerShoulder.quaternion.copy(shoulder.quaternion);remember(innerShoulder);
    const hemPoints=Array.from({length:65},(_,j)=>{const a=j/64*Math.PI*2,t=Math.PI*.60;return new THREE.Vector3(-Math.cos(a)*Math.sin(t),Math.cos(t),Math.sin(a)*Math.sin(t)).multiply(shoulder.scale).applyQuaternion(shoulder.quaternion).add(shoulder.position).toArray();});
    line(groups[6],`${side} rolled shoulder shell edge`,hemPoints,mat.edge,.0017,[s*.30,.075,.36]);
    const sx=s*.39;
    const fore=panel(groups[6],`${side} outer forearm plate`,[[sx-.032,1.339],[sx+.032,1.335],[sx+.044,1.316],[sx+.030,1.143],[sx+.010,1.126],[sx-.025,1.14],[sx-.039,1.224]],.068,.003,mat.metal,[s*.32,0,.40],4.2,sx);
    const fp=fore.geometry.attributes.position;for(let i=0;i<fp.count;i++)fp.setX(i,fp.getX(i)-s*.23*(fp.getY(i)-1.245));fore.geometry.computeVertexNormals();remember(fore);
    const tx=s*.142;
    panel(groups[6],`${side} outer thigh plate`,[[tx-.048,1.01],[tx+.041,1.014],[tx+.064,.989],[tx+.055,.76],[tx+.025,.727],[tx-.043,.75],[tx-.066,.916]],.108,.003,mat.metal,[s*.30,0,.39],5,tx);
    const kx=s*.148;
    panel(groups[6],`${side} shin plate`,[[kx-.033,.53],[kx,.548],[kx+.034,.53],[kx+.037,.234],[kx+.016,.178],[kx-.025,.183],[kx-.037,.248]],.075,.003,mat.metal,[s*.26,0,.38],5,kx);
    fittedShell(groups[6],`${side} fitted biceps shell`,[[1.414,s*.341,.061,.060,.005],[1.475,s*.319,.069,.062,.005],[1.535,s*.294,.073,.070,.004],[1.578,s*.280,.074,.070,.003]],mat.metal,[s*.30,.01,.22],-s*.35,s*2.20,.003);
    fittedShell(groups[6],`${side} fitted hamstring shell`,[[.72,s*.125,.074,.082,.002],[.82,s*.119,.092,.102,.002],[.93,s*.111,.099,.109,.002],[.991,s*.106,.095,.102,0]],mat.metal,[s*.22,0,-.38],Math.PI-.78,Math.PI+.78,.003);
    for(const [area,y,cx,rx,rz,cz,a,b,ex] of [
      ['biceps',1.477,s*.318,.067,.060,.005,s*.35,s*1.1,[s*.30,.01,.22]],
      ['hamstring',.867,s*.116,.092,.102,.002,Math.PI-.40,Math.PI+.40,[s*.22,0,-.38]]
    ]){
      fittedShell(hardware,`${side} ${area} sewn sleeve`,[[y-.019,cx,rx-.003,rz-.003,cz],[y+.019,cx,rx-.003,rz-.003,cz]],mat.strap,[s*.075,0,0],a,b,.001);
      fittedShell(hardware,`${side} ${area} hook on sleeve`,[[y-.016,cx,rx-.002,rz-.002,cz],[y+.016,cx,rx-.002,rz-.002,cz]],mat.hook,[s*.09,0,0],a,b,.001);
      fittedShell(hardware,`${side} ${area} loop on plate back`,[[y-.016,cx,rx,rz,cz],[y+.016,cx,rx,rz,cz]],mat.strap,ex,a,b,.001);
    }
    for(const [label,y,cx,rx,rz,cz] of [['biceps',1.489,s*.314,.073,.068,.005],['forearm',1.252,s*.385,.056,.054,.014],['thigh',.861,s*.117,.102,.110,.002],['shin',.382,s*.146,.064,.071,-.01]]){
      fittedShell(groups[5],`${side} ${label} full wrap strap`,[[y-.009,cx,rx,rz,cz],[y+.009,cx,rx,rz,cz]],mat.strap,[s*.075,0,0],0,Math.PI*2,.002);
    }
    // Fingered gloves, flexible wrists, and athletic boot soles.
    ellipsoid(groups[7],`${side} glove palm`,[s*.431,1.064,.031],[.042,.063,.026],mat.rubber,[s*.18,-.025,.16]);
    for(let f=0;f<4;f++){const x=s*(.404+f*.017),y=1.005+(f===0?.01:f===3?.012:0);ellipsoid(groups[7],`${side} glove finger ${f+1}`,[x,y,.034],[.010,.041-(f===3?.007:0),.012],mat.rubber,[s*.18,-.025,.16],16);}
    const thumb=ellipsoid(groups[7],`${side} glove thumb`,[s*.39,1.055,.049],[.013,.035,.016],mat.rubber,[s*.18,-.025,.16]);thumb.rotation.z=-s*.45;
    link(groups[7],`${side} glove wrist`,[s*.409,1.1,.026],[s*.419,1.126,.026],.040,.034,mat.rubber,[s*.18,-.025,.16]);
    const gloveEx=[s*.18,-.025,.16];
    const cuff=link(groups[7],`${side} NETFORCE extended glove cuff`,[s*.415,1.098,.026],[s*.401,1.195,.020],.047,.037,mat.rubber,gloveEx);
    ellipsoid(groups[7],`${side} NETFORCE cuff mesh insert`,[s*.407,1.153,.057],[.021,.034,.004],mat.strap,gloveEx);
    ellipsoid(groups[7],`${side} NETFORCE mesh knuckle oval`,[s*.431,1.05,.057],[.036,.018,.006],mat.strap,gloveEx);
    const cuffBand=box(groups[7],`${side} NETFORCE cuff closure`,[s*.416,1.108,.061],[.084,.016,.007],mat.rubber,gloveEx);cuffBand.rotation.z=s*.10;
    for(let f=0;f<4;f++)ellipsoid(groups[7],`${side} NETFORCE dorsal finger mesh ${f+1}`,[s*(.404+f*.017),1.02,.046],[.006,.019,.003],mat.strap,gloveEx,16);
    const bootRows=[[-.058,.036,.071,.031],[-.045,.050,.096,.049],[-.005,.058,.107,.064],[.035,.061,.101,.061],[.080,.064,.083,.043],[.135,.063,.069,.028],[.178,.053,.065,.023],[.206,.023,.062,.018],[.213,.001,.061,.005]];
    const bp=[],bu=[],bi=[],N=48;
    const bc=new THREE.CatmullRomCurve3(bootRows.map(r=>new THREE.Vector3(r[0],r[1],r[2]))),br=new THREE.SplineCurve(bootRows.map(r=>new THREE.Vector2(r[3],0)));
    for(let i=0;i<=64;i++){const t=i/64,c=bc.getPoint(t),ry=br.getPoint(t).x;for(let j=0;j<=N;j++){const a=j/N*Math.PI*2;bp.push(s*.153+c.y*Math.cos(a),Math.max(.042,c.z+ry*Math.sin(a)),c.x);bu.push(j/N,t);}}
    for(let i=0;i<64;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;bi.push(a,a+1,b,b,a+1,b+1);}
    for(const row of [0,64]){
      const center=bp.length/3,z=bp[(row*(N+1))*3+2];let cy=0;for(let j=0;j<N;j++)cy+=bp[(row*(N+1)+j)*3+1]/N;
      bp.push(s*.153,cy,z);bu.push(.5,row/64);
      for(let j=0;j<N;j++){const a=row*(N+1)+j,b=a+1;if(row===0)bi.push(center,b,a);else bi.push(center,a,b);}
    }
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));bg.setIndex(bi);bg.computeVertexNormals();mesh(bg,mat.rubber,groups[7],`${side} sculpted athletic boot`,[s*.14,.035,.13]);
    const sock=bg.clone(),sp=sock.attributes.position;
    for(let i=0;i<sp.count;i++){sp.setX(i,s*.153+(sp.getX(i)-s*.153)*.88);sp.setY(i,Math.max(.040,sp.getY(i)-.020));}sock.computeVertexNormals();mesh(sock,mat.knit,groups[0],`${side} Cutlon foot sleeve`);
    ghostPad(`${side} Ghost met guard`,'met',(u,v,w)=>{
      const z=.106-v;let j=0;while(j<bootRows.length-2&&bootRows[j+1][0]<z)j++;
      const A=bootRows[j],B=bootRows[j+1],t=THREE.MathUtils.clamp((z-A[0])/(B[0]-A[0]),0,1),r=A.map((x,i)=>THREE.MathUtils.lerp(x,B[i],t));
      const x=.075*Math.sin(u/.075),top=r[2]+r[3]*Math.sqrt(Math.max(.03,1-(x/r[1])**2));
      return [s*.153+x,top-.013+w,z];
    },[s*.12,.10,.25]);
    for(const d of [-1,1])line(groups[7],`${side} bonded boot quarter seam ${d}`,[[s*.153+d*.051,.115,-.03],[s*.153+d*.060,.118,.035],[s*.153+d*.062,.089,.092],[s*.153+d*.055,.080,.161]],mat.seam,.00085,[s*.14,.035,.13]);
    const soleShape=new THREE.Shape();soleShape.moveTo(-.035,-.065);soleShape.quadraticCurveTo(-.07,-.065,-.07,-.02);soleShape.lineTo(-.07,.16);soleShape.quadraticCurveTo(-.07,.215,0,.215);soleShape.quadraticCurveTo(.07,.215,.07,.16);soleShape.lineTo(.07,-.02);soleShape.quadraticCurveTo(.07,-.065,.035,-.065);soleShape.closePath();
    const sole=mesh(new THREE.ExtrudeGeometry(soleShape,{depth:.021,bevelEnabled:true,bevelThickness:.003,bevelSize:.002,bevelSegments:2,steps:1,curveSegments:16}),mat.edge,groups[7],`${side} rounded athletic sole`,[s*.14,.035,.13]);sole.rotation.x=Math.PI/2;sole.position.set(s*.153,.041,0);remember(sole);
    link(groups[7],`${side} knit boot collar`,[s*.151,.135,0],[s*.15,.201,0],.058,.060,mat.knit,[s*.14,.035,.13]);
    for(let j=0;j<5;j++){
      const y=.150-j*.008,z=.040+j*.021,ex=[s*.14,.035,.13];
      for(const d of [-1,1]){
        const eye=mesh(new THREE.TorusGeometry(.0035,.001,6,12),mat.fastener,groups[7],`${side} boot eyelet ${j} ${d}`,ex);eye.position.set(s*.153+d*.025,y,z);eye.rotation.x=-.7;remember(eye);
        line(groups[7],`${side} cross lace ${j} ${d}`,[[s*.153+d*.025,y,z],[s*.153,y+.003,z+.010],[s*.153-d*.025,y-.008,z+.021]],mat.strap,.0016,ex);
      }
    }
    for(let j=0;j<8;j++)for(const d of [-1,1])box(groups[7],`${side} sole traction lug ${j} ${d}`,[s*.153+d*.064,.033,-.025+j*.027],[.012,.010,.014],mat.rubber,[s*.14,.035,.13]);
    for(let f=0;f<4;f++){
      const x=s*(.404+f*.017),ex=[s*.18,-.025,.16];
      ellipsoid(groups[7],`${side} flexible knuckle reinforcement ${f}`,[x,1.045,.055],[.008,.013,.003],mat.knit,ex,16);
      for(let j=0;j<2;j++)line(groups[7],`${side} finger articulation seam ${f} ${j}`,[[x-.006,1.006+j*.014,.043],[x,1.006+j*.014,.047],[x+.006,1.006+j*.014,.043]],mat.seam,.00065,ex);
    }

  }
  ghostPad('Ghost chest','chest',(u,v,w)=>[.24*Math.sin(u/.24),1.485+v,.124+(.24+w)*Math.cos(u/.24)-.24-.18*v*v],[0,0,.22]);
  ghostPad('Ghost back','back',(u,v,w)=>[.235*Math.sin(u/.235),1.455+v,-(.122+(.235+w)*Math.cos(u/.235)-.235-.20*v*v)],[0,0,-.23]);
  // Hyper Concealable reference: scoop neck, high armholes, soft hem and six closures.
  const softOutline=[[-.160,1.205],[-.205,1.245],[-.217,1.390],[-.194,1.441],[-.185,1.553],[-.167,1.665],[-.106,1.659],[-.071,1.601],[0,1.590],[.071,1.601],[.106,1.659],[.167,1.665],[.185,1.553],[.194,1.441],[.217,1.390],[.205,1.245],[.160,1.205]];
  for(const d of [-1,1]){
    const label=d>0?'front':'back',ex=[0,0,d*.27];
    const carrier=panel(groups[2],`Hyperline ${label} brushed carrier`,softOutline,.145,.000762,mat.soft,ex,1.15);if(d<0)carrier.rotation.y=Math.PI;
    const insertOutline=softOutline.map(([x,y])=>[x*.965,1.43+(y-1.43)*.962]);
    const insert=panel(groups[2],`Hyperline ${label} 4.83 mm soft insert`,insertOutline,.1386,.004826,mat.padBacking,ex,1.15);if(d<0)insert.rotation.y=Math.PI;
    const binding=softOutline.map(([x,y])=>[x,y,d*(.147-1.15*x*x)]);binding.push(binding[0]);line(groups[2],`Hyperline ${label} flat stitched binding`,binding,mat.seam,.0008,ex);
    const chestSeam=[[-.163,1.524],[-.090,1.548],[0,1.557],[.090,1.548],[.163,1.524]].map(([x,y])=>[x,y,d*(.148-1.15*x*x)]);line(groups[2],`Hyperline ${label} yoke seam`,chestSeam,mat.seam,.00055,ex);
  }
  for(const side of [-1,1]){
    const label=side<0?'Left':'Right';
    fittedShell(groups[2],`Hyperline ${label} soft overlap wing`,[[1.217,0,.176,.115,0],[1.30,0,.191,.127,0],[1.39,0,.219,.139,0]],mat.soft,[side*.16,0,0],side*.93,side*2.20,.004826);
    for(const y of [1.268,1.351]){
      fittedShell(groups[2],`Hyperline ${label} side Comfort Strap`,[[y-.012,0,.213,.146,0],[y+.012,0,.216,.148,0]],mat.strap,[side*.16,0,0],side*.74,side*2.42,.001);
      box(groups[2],`Hyperline ${label} side closure patch`,[side*.166,y,.135],[.053,.025,.0015],mat.pocket,[side*.16,0,0]);
    }
    const path=new THREE.CatmullRomCurve3([[side*.135,1.591,.127],[side*.141,1.656,.105],[side*.137,1.674,0],[side*.141,1.656,-.105],[side*.135,1.591,-.127]].map(p=>new THREE.Vector3(...p)));
    const ribbon=new THREE.Shape();ribbon.moveTo(-.016,-.0005);ribbon.lineTo(.016,-.0005);ribbon.lineTo(.016,.0005);ribbon.lineTo(-.016,.0005);ribbon.closePath();
    mesh(new THREE.ExtrudeGeometry(ribbon,{steps:64,bevelEnabled:false,extrudePath:path}),mat.strap,groups[2],`Hyperline ${label} shoulder Comfort Strap`,[side*.05,.05,0]);
    const patch=panel(groups[2],`Hyperline ${label} shoulder closure patch`,[[side*.135-.020,1.646],[side*.135+.020,1.646],[side*.135+.020,1.585],[side*.135-.020,1.585]],.137,.001,mat.pocket,[side*.05,.05,0],.5);
  }
  const stabOutline=[[-.151,1.241],[-.197,1.42],[-.203,1.566],[-.136,1.642],[-.071,1.611],[.071,1.611],[.136,1.642],[.203,1.566],[.197,1.42],[.151,1.241]];
  panel(groups[3],'Rigid carbon stab front',stabOutline,.158,.004,mat.carbon,[0,0,.40],1.17);
  const stabBack=panel(groups[3],'Rigid carbon stab back',stabOutline,.158,.004,mat.carbon,[0,0,-.40],1.17);stabBack.rotation.y=Math.PI;
  fittedShell(groups[3],'Left fitted rigid stab flank',[[1.265,0,.177,.116,0],[1.38,0,.215,.138,0],[1.50,0,.236,.145,0]],mat.carbon,[-.23,0,0],-2.05,-1.08,.003);
  // Three rigid lames under the knit; the nape has a deliberate 60-degree opening.
  for(let i=0;i<3;i++){
    const y=1.702+i*.027,rx=.072-i*.003,rz=.065-i*.0015;
    const g=rings(groups[4],`Concealed neck lame ${i+1}`,[[y,rx,rz],[y+.035,rx-.005,rz-.003]],mat.metal,[.24,.07+i*.012,.27],-Math.PI*5/6,Math.PI*5/6);g.material=mat.metal.clone();g.material.side=THREE.DoubleSide;
    rings(groups[4],`Neck lame ${i+1} rolled edge`,[[y+.032,rx-.004,rz-.002],[y+.035,rx-.005,rz-.003]],mat.edge,[.24,.07+i*.012,.27],-Math.PI*5/6,Math.PI*5/6);
  }
  // 25 mm harness: the vest stack remains beneath these paths.
  for(const s of [-1,1]){
    const x=s*.137;
    shoulderRibbon(`${s<0?'Left':'Right'} continuous shoulder harness`,x,[0,0,.45]);
    // Slide buckles are real frames with central strap, not painted marks.
    for(const [z,d] of [[.18,1],[-.18,-1]]){
      const ex=[s*.035,0,d*.50];
      box(groups[5],'Side-release buckle top',[x,1.562,z],[.039,.006,.012],mat.edge,ex);
      box(groups[5],'Side-release buckle bottom',[x,1.527,z],[.039,.006,.012],mat.edge,ex);
      box(groups[5],'Buckle left rail',[x-.017,1.544,z],[.005,.035,.012],mat.fastener,ex);
      box(groups[5],'Buckle right rail',[x+.017,1.544,z],[.005,.035,.012],mat.fastener,ex);
    }
    // Inner elastic tracks carry the four independent lames.
    box(hardware,'Inner vertical abdominal elastic strip',[s*.095,1.31,.160],[.022,.212,.007],mat.strap,[s*.03,0,.53]);
  }
  fittedShell(groups[5],'Continuous upper chest wrap strap',[[1.515,0,.243,.177,0],[1.54,0,.243,.177,0]],mat.strap,[0,0,.45],0,Math.PI*2,.002);
  fittedShell(groups[5],'Continuous lower rib wrap strap',[[1.335,0,.203,.159,0],[1.360,0,.210,.162,0]],mat.strap,[0,0,.45],0,Math.PI*2,.002);
  // Floating groin module: soft envelope, separate impact-cup concept, no waist belt.
  const groinOutline=[[-.062,1.082],[.062,1.082],[.069,1.023],[.038,.945],[0,.920],[-.038,.945],[-.069,1.023]];
  panel(groups[2],'Floating cut-resistant groin pouch',groinOutline,.111,.004,mat.soft,[0,0,.30],2.5);
  panel(groups[6],'Removable groin impact cup',[[-.052,1.067],[.052,1.067],[.055,1.018],[.028,.953],[0,.936],[-.028,.953],[-.055,1.018]],.121,.003,mat.metal,[0,0,.44],5);
  for(const side of [-1,1]){
    const label=side<0?'Left':'Right';
    fittedShell(groups[5],`${label} groin soft leg loop`,[[.974,side*.105,.098,.106,0],[.989,side*.105,.098,.106,0]],mat.strap,[0,0,.45],0,Math.PI*2,.002);
    const tab=line(groups[5],`${label} groin suspension tab`,[[side*.065,1.342,.152],[side*.066,1.21,.101],[side*.052,1.075,.115]],mat.strap,.004,[0,0,.45]);
  }
  // Chest stops at solar plexus. There is no connection to the abdominal lames.
  const chest=[[-.115,1.654],[-.058,1.628],[.058,1.628],[.115,1.654],[.194,1.604],[.211,1.535],[.191,1.469],[.147,1.429],[.081,1.406],[-.081,1.406],[-.147,1.429],[-.191,1.469],[-.211,1.535],[-.194,1.604]];
  panel(groups[6],'Independent chest plate',chest,.180,.004,mat.metal,[0,.02,.69],1.50);
  const back=panel(groups[6],'Independent upper back plate',chest,.176,.004,mat.metal,[0,.02,-.66],1.50);back.rotation.y=Math.PI;
  // Recessed milled breaks, a central fold and restrained edge lines.
  for(const s of [-1,1]){
    const groove=line(groups[6],'Chest machined transition',[[s*.16,1.595],[s*.18,1.53],[s*.135,1.45],[s*.072,1.426]].map(([x,y])=>[x,y,.185-1.5*x*x+shellRelief('Independent chest plate',x,y)]),mat.edge,.0012);groove.userData.explode.set(0,.02,.69);
    for(const yy of [1.602,1.454]){
      const x=s*.133,z=.185-1.50*x*x+shellRelief('Independent chest plate',x,yy);
      box(hardware,'Torso recessed strap slot',[x,yy,z],[.038,.012,.004],mat.edge,[0,.02,.69]);
      box(hardware,'Harness strap threaded through chest slot',[x,yy,z+.003],[.025,.008,.005],mat.strap,[0,.02,.69]);
      for(const dx of [-.021,.021])box(hardware,'Chest slot metal rim',[x+dx,yy,z],[.002,.014,.005],mat.fastener,[0,.02,.69]);
      const b=box(hardware,'Back plate threaded strap slot',[x,yy,-z],[.038,.012,.006],mat.edge,[0,.02,-.66]);
      box(hardware,'Back harness strap through slot',[x,yy,-z-.004],[.025,.007,.006],mat.strap,[0,.02,-.66]);
    }
  }
  const abdominal=[];
  for(let i=0;i<4;i++){
    const top=1.405-i*.055,bottom=top-.067,w=.171-i*.007,z=.179-i*.004;
    const a=panel(groups[6],`Abdominal lame ${i+1} — 70 mm, 15 mm overlap`,[[-w,top],[-w+.015,bottom+.008],[-w*.50,bottom],[w*.50,bottom],[w-.015,bottom+.008],[w,top]],z,.004,mat.metal,[0,-i*.012,.72+i*.08],1.0);abdominal.push(a);
    for(const s of [-1,1]){
      const x=s*.095,yy=top-.018,ex=[0,-i*.012,.72+i*.08];
      box(hardware,`Abdominal lame ${i+1} vertical travel slot`,[x,yy,z-.004],[.008,.025,.007],mat.edge,ex);
      const pin=mesh(new THREE.CylinderGeometry(.004,.004,.010,12),mat.fastener,hardware,`Lame ${i+1} slotted rivet — 12 mm travel`,ex);pin.rotation.x=Math.PI/2;pin.position.set(x,yy,z+.003);remember(pin);
    }
    const edge=line(groups[6],`Abdominal lame ${i+1} downward overlap`,[[-w+.012,bottom+.01,z-w*w+.007],[0,bottom+.001,z+.009],[w-.012,bottom+.01,z-w*w+.007]],mat.edge,.001);edge.userData.explode.set(0,-i*.012,.72+i*.08);
  }
  for(const plate of [...groups[6].children].filter(m=>/fitted biceps shell|fitted hamstring shell|outer forearm plate|outer thigh plate|shin plate/.test(m.name))){
    const g=plate.geometry.clone(),p=g.attributes.position,side=plate.name.startsWith('Left')?-1:1;
    for(let i=0;i<p.count;i++){
      if(plate.name.includes('biceps'))p.setX(i,p.getX(i)-side*.0012);
      else p.setZ(i,p.getZ(i)+(plate.name.includes('hamstring')?.0012:-.0012));
    }
    const liner=mesh(g,mat.edge,groups[6],plate.name+' inner polymer substrate',plate.userData.explode.toArray());liner.userData.keepDark=true;
  }
  for(const m of mannequin.children){
    if(!/head|Crown|ear/.test(m.name))continue;
    const a=new THREE.Matrix4().makeTranslation(0,1.784,0).multiply(new THREE.Matrix4().makeScale(1.13,1.27,1.16)).multiply(new THREE.Matrix4().makeTranslation(0,-1.784,0));
    m.updateMatrix();m.geometry.applyMatrix4(m.matrix);m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.set(1,1,1);m.geometry.applyMatrix4(a);remember(m);
  }
  // Optional hanging tasset omitted: the unplated waist remains uninterrupted.
  groups.forEach((g,i)=>g.traverse(o=>{if(o.isMesh)o.userData.layer=i;}));
  for(const m of parts){if(m.userData.layer===0)m.userData.explode.set(0,0,0);if(m.userData.layer===5)m.userData.explode.set(0,0,.45);}
  const components=new Map();
  for(const m of [...parts,...hardwareParts]){
    const n=m.name,side=n.startsWith('Left')?'left':n.startsWith('Right')?'right':null,layer=m.userData.layer;
    let id=null,label=n;
    if(layer===6||m.userData.hardware){
      const abs=n.match(/(?:Abdominal lame|Lame) (\d)/);
      if(abs){id='abdomen-'+abs[1];label='Abdominal plate '+abs[1];}
      else if(/chest|Chest|Torso recessed|Harness strap threaded/.test(n)){id='chest';label='Pectoral chest plate';}
      else if(/back plate|Back plate|Back harness/.test(n)){id='back';label='Upper back plate';}
      else if(side&&/shoulder/.test(n)){id=side+'-shoulder';label=side+' shoulder cap';}
      else if(side&&/biceps|hamstring|forearm|thigh|shin/.test(n)&&(!m.userData.hardware||n.includes('loop on plate back'))){const area=n.match(/biceps|hamstring|forearm|thigh|shin/)[0];id=side+'-'+area;label=side+' '+area+' plate';}
    }
    if(layer===0){id='cutlon';label='Cutlon base garment';}
    if(/groin/i.test(n)){id=layer===6?'groin-cup':layer===2?'groin-pouch':'groin-support';label=layer===6?'Removable groin impact cup':layer===2?'Floating cut-resistant groin pouch':'Groin suspension and soft leg loops';}
    if(layer===5&&!id&&!/groin/i.test(n)){id='harness';label='Continuous wraparound harness';}
    if(layer===1){const zone=/shoulder|elbow|knee|chest|back|met/.exec(n.toLowerCase())?.[0];id='d3o-'+(side?side+'-':'')+zone;label='D3O Ghost '+(side?side+' ':'')+(zone==='met'?'met guard':zone+' protector');}
    if(layer===2&&n.startsWith('Hyperline')){id='hyperline';label='Safe Life Defense Hyper Concealable vest';}
    if(layer===4){const number=n.match(/lame (\d)/)?.[1];id='neck-'+number;label='Concealed neck lame '+number;}
    if(layer===7){const glove=/glove|NETFORCE|knuckle|finger/.test(n);id=side+(glove?'-glove':'-boot');label=side+(glove?' NETFORCE-style glove':' athletic boot');}
    if(!id)id='mesh-'+m.id;
    m.userData.component=id;
    if(!components.has(id))components.set(id,{id,name:label.charAt(0).toUpperCase()+label.slice(1),layer,meshes:[]});
    const c=components.get(id);c.meshes.push(m);if(layer===6&&!m.userData.hardware)c.layer=6;
  }
  root.updateMatrixWorld(true);
  for(const c of components.values()){const bounds=new THREE.Box3();for(const m of c.meshes)bounds.union(new THREE.Box3().setFromObject(m));c.dimensions=bounds.getSize(new THREE.Vector3()).toArray();}
  return {root,groups,parts,components,hardware,hardwareParts,collarKnits,mannequin,materials:mat,abdominal,pads};
}
