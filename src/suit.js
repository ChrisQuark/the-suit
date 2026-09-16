import * as THREE from 'three';

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
    pad:new THREE.MeshStandardMaterial({color:0x242626,roughness:.92,bumpMap:rubberMap,bumpScale:.0005}),
    soft:new THREE.MeshStandardMaterial({color:0x242629,roughness:.96,bumpMap:nylonMap,bumpScale:.0005}),
    carbon:new THREE.MeshStandardMaterial({color:0x27292c,roughness:.44,metalness:.28,map:carbonMap,bumpMap:carbonMap,bumpScale:.00025}),
    strap:new THREE.MeshStandardMaterial({color:0x17191b,roughness:.96,bumpMap:nylonMap,bumpScale:.0006}),
    metal:new THREE.MeshPhysicalMaterial({color:0x272b30,metalness:.78,roughness:.36,bumpMap:metalMap,bumpScale:.00009,clearcoat:.20,clearcoatRoughness:.32,iridescence:.07,iridescenceIOR:1.3,iridescenceThicknessRange:[120,220]}),
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
    if(name.includes('chest plate')||name.includes('back plate')){
      const upper=Math.exp(-Math.pow((y-1.55)/.12,2));
      const pec=Math.exp(-Math.pow((Math.abs(x)-.095)/.09,2));
      return .016*pec*upper-.018*Math.pow((y-1.54)/.16,2)+.004*Math.exp(-x*x/.0005)*upper;
    }
    if(name.includes('thigh plate'))return -.16*Math.pow(y-.88,2);
    if(name.includes('shin plate'))return .006*Math.exp(-Math.pow(x/.022,2))-.12*Math.pow(y-.36,2);
    if(name.includes('forearm plate'))return -.22*Math.pow(y-1.245,2);
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
    let geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:4,steps:1,curveSegments:12});
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
    // Low-profile pads concealed until layer or exploded inspection.
    const p1=ellipsoid(groups[1],`${side} shoulder pad`,[s*.263,1.641,.004],[.092,.027,.091],mat.pad,[s*.13,.075,.14]);p1.rotation.z=-s*.3;pads.push(p1);
    pads.push(ellipsoid(groups[1],`${side} elbow pad`,[s*.365,1.359,-.028],[.048,.057,.031],mat.pad,[s*.12,0,.15]));
    pads.push(ellipsoid(groups[1],`${side} knee pad`,[s*.129,.602,.056],[.056,.067,.022],mat.pad,[s*.1,0,.16]));
    pads.push(ellipsoid(groups[1],`${side} hip pad`,[s*.163,1.055,.005],[.020,.079,.076],mat.pad,[s*.13,0,.12]));
    for(let j=0;j<4;j++)box(groups[1],`${side} knee pad channel ${j+1}`,[s*.129,.565+j*.021,.077],[.07,.003,.002],mat.edge,[s*.1,0,.16]);
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
    const shoulder=mesh(shoulderGeo,mat.metal,groups[6],`${side} independent shoulder cap`,[s*.30,.075,.36]);shoulder.position.set(s*.258,1.623,.003);shoulder.scale.set(.099,.083,.096);shoulder.rotation.z=-s*.24;remember(shoulder);
    const innerShoulder=mesh(shoulderGeo.clone(),new THREE.MeshStandardMaterial({color:0x101318,roughness:.70,metalness:.25,side:THREE.BackSide}),groups[6],`${side} shoulder shell inner face`,[s*.30,.075,.36]);innerShoulder.position.copy(shoulder.position);innerShoulder.scale.copy(shoulder.scale).multiplyScalar(.97);innerShoulder.quaternion.copy(shoulder.quaternion);remember(innerShoulder);
    const hemPoints=Array.from({length:65},(_,j)=>{const a=j/64*Math.PI*2,t=Math.PI*.60;return new THREE.Vector3(-Math.cos(a)*Math.sin(t),Math.cos(t),Math.sin(a)*Math.sin(t)).multiply(shoulder.scale).applyQuaternion(shoulder.quaternion).add(shoulder.position).toArray();});
    line(groups[6],`${side} rolled shoulder shell edge`,hemPoints,mat.edge,.0017,[s*.30,.075,.36]);
    const sx=s*.39;
    const fore=panel(groups[6],`${side} outer forearm plate`,[[sx-.032,1.339],[sx+.032,1.335],[sx+.044,1.316],[sx+.030,1.143],[sx+.010,1.126],[sx-.025,1.14],[sx-.039,1.224]],.070,.005,mat.metal,[s*.32,0,.40],4.2,sx);
    const fp=fore.geometry.attributes.position;for(let i=0;i<fp.count;i++)fp.setX(i,fp.getX(i)-s*.23*(fp.getY(i)-1.245));fore.geometry.computeVertexNormals();remember(fore);
    const tx=s*.142;
    panel(groups[6],`${side} outer thigh plate`,[[tx-.048,1.01],[tx+.041,1.014],[tx+.064,.989],[tx+.055,.76],[tx+.025,.727],[tx-.043,.75],[tx-.066,.916]],.112,.006,mat.metal,[s*.30,0,.39],5,tx);
    const kx=s*.148;
    panel(groups[6],`${side} shin plate`,[[kx-.033,.53],[kx,.548],[kx+.034,.53],[kx+.037,.234],[kx+.016,.178],[kx-.025,.183],[kx-.037,.248]],.077,.006,mat.metal,[s*.26,0,.38],5,kx);
    // Fingered gloves, flexible wrists, and athletic boot soles.
    ellipsoid(groups[7],`${side} glove palm`,[s*.431,1.064,.031],[.042,.063,.026],mat.rubber,[s*.18,-.025,.16]);
    for(let f=0;f<4;f++){const x=s*(.404+f*.017),y=1.005+(f===0?.01:f===3?.012:0);ellipsoid(groups[7],`${side} glove finger ${f+1}`,[x,y,.034],[.010,.041-(f===3?.007:0),.012],mat.rubber,[s*.18,-.025,.16],16);}
    const thumb=ellipsoid(groups[7],`${side} glove thumb`,[s*.39,1.055,.049],[.013,.035,.016],mat.rubber,[s*.18,-.025,.16]);thumb.rotation.z=-s*.45;
    link(groups[7],`${side} glove wrist`,[s*.409,1.1,.026],[s*.419,1.126,.026],.040,.034,mat.rubber,[s*.18,-.025,.16]);
    const bootRows=[[-.058,.036,.071,.031],[-.045,.050,.096,.049],[-.005,.058,.107,.064],[.035,.061,.101,.061],[.080,.064,.083,.043],[.135,.063,.069,.028],[.178,.053,.065,.023],[.206,.023,.062,.018],[.213,.001,.061,.005]];
    const bp=[],bu=[],bi=[],N=48;
    const bc=new THREE.CatmullRomCurve3(bootRows.map(r=>new THREE.Vector3(r[0],r[1],r[2]))),br=new THREE.SplineCurve(bootRows.map(r=>new THREE.Vector2(r[3],0)));
    for(let i=0;i<=64;i++){const t=i/64,c=bc.getPoint(t),ry=br.getPoint(t).x;for(let j=0;j<=N;j++){const a=j/N*Math.PI*2;bp.push(s*.153+c.y*Math.cos(a),Math.max(.042,c.z+ry*Math.sin(a)),c.x);bu.push(j/N,t);}}
    for(let i=0;i<64;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;bi.push(a,a+1,b,b,a+1,b+1);}
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));bg.setIndex(bi);bg.computeVertexNormals();mesh(bg,mat.rubber,groups[7],`${side} sculpted athletic boot`,[s*.14,-.05,.13]);
    for(const d of [-1,1])line(groups[7],`${side} bonded boot quarter seam ${d}`,[[s*.153+d*.051,.115,-.03],[s*.153+d*.060,.118,.035],[s*.153+d*.062,.089,.092],[s*.153+d*.055,.080,.161]],mat.seam,.00085,[s*.14,-.05,.13]);
    const soleShape=new THREE.Shape();soleShape.moveTo(-.035,-.065);soleShape.quadraticCurveTo(-.07,-.065,-.07,-.02);soleShape.lineTo(-.07,.16);soleShape.quadraticCurveTo(-.07,.215,0,.215);soleShape.quadraticCurveTo(.07,.215,.07,.16);soleShape.lineTo(.07,-.02);soleShape.quadraticCurveTo(.07,-.065,.035,-.065);soleShape.closePath();
    const sole=mesh(new THREE.ExtrudeGeometry(soleShape,{depth:.021,bevelEnabled:true,bevelThickness:.003,bevelSize:.002,bevelSegments:2,steps:1,curveSegments:16}),mat.edge,groups[7],`${side} rounded athletic sole`,[s*.14,-.05,.13]);sole.rotation.x=Math.PI/2;sole.position.set(s*.153,.041,0);remember(sole);
    link(groups[7],`${side} knit boot collar`,[s*.151,.135,0],[s*.15,.201,0],.058,.060,mat.knit,[s*.14,-.05,.13]);
    for(let j=0;j<5;j++){
      const y=.150-j*.008,z=.040+j*.021,ex=[s*.14,-.05,.13];
      for(const d of [-1,1]){
        const eye=mesh(new THREE.TorusGeometry(.0035,.001,6,12),mat.fastener,groups[7],`${side} boot eyelet ${j} ${d}`,ex);eye.position.set(s*.153+d*.025,y,z);eye.rotation.x=-.7;remember(eye);
        line(groups[7],`${side} cross lace ${j} ${d}`,[[s*.153+d*.025,y,z],[s*.153,y+.003,z+.010],[s*.153-d*.025,y-.008,z+.021]],mat.strap,.0016,ex);
      }
    }
    for(let j=0;j<8;j++)for(const d of [-1,1])box(groups[7],`${side} sole traction lug ${j} ${d}`,[s*.153+d*.064,.033,-.025+j*.027],[.012,.010,.014],mat.rubber,[s*.14,-.05,.13]);
    for(let f=0;f<4;f++){
      const x=s*(.404+f*.017),ex=[s*.18,-.025,.16];
      ellipsoid(groups[7],`${side} flexible knuckle reinforcement ${f}`,[x,1.045,.055],[.008,.013,.003],mat.knit,ex,16);
      for(let j=0;j<2;j++)line(groups[7],`${side} finger articulation seam ${f} ${j}`,[[x-.006,1.006+j*.014,.043],[x,1.006+j*.014,.047],[x+.006,1.006+j*.014,.043]],mat.seam,.00065,ex);
    }

  }
  ellipsoid(groups[1],'Optional thin chest trauma pad',[0,1.51,.119],[.15,.137,.009],mat.pad,[0,0,.17]);
  // Soft IIIA wrap is genuinely continuous around the torso.
  rings(groups[2],'Soft ballistic side wrap',[[1.181,.163,.103],[1.30,.18,.119],[1.45,.231,.137],[1.587,.227,.133]],mat.soft,[0,0,.24]);
  const softOutline=[[-.151,1.226],[-.206,1.438],[-.212,1.572],[-.139,1.667],[-.075,1.642],[.075,1.642],[.139,1.667],[.212,1.572],[.206,1.438],[.151,1.226]];
  panel(groups[2],'Soft ballistic front',softOutline,.147,.005,mat.soft,[0,0,.25],1.15);
  const sb=panel(groups[2],'Soft ballistic back',softOutline,.147,.005,mat.soft,[0,0,-.25],1.15);sb.rotation.y=Math.PI;
  const stabOutline=[[-.151,1.241],[-.197,1.42],[-.203,1.566],[-.136,1.642],[-.071,1.611],[.071,1.611],[.136,1.642],[.203,1.566],[.197,1.42],[.151,1.241]];
  panel(groups[3],'Rigid carbon stab front',stabOutline,.162,.009,mat.carbon,[0,0,.40],1.17);
  const stabBack=panel(groups[3],'Rigid carbon stab back',stabOutline,.163,.009,mat.carbon,[0,0,-.40],1.17);stabBack.rotation.y=Math.PI;
  for(const s of [-1,1]){const flank=box(groups[3],`${s<0?'Left':'Right'} rigid stab flank`,[s*.185,1.39,0],[.009,.254,.148],mat.carbon,[s*.23,0,0]);flank.rotation.z=-s*.15;}
  // Three rigid lames under the knit; the nape has a deliberate 60-degree opening.
  for(let i=0;i<3;i++){
    const y=1.702+i*.027,rx=.072-i*.003,rz=.065-i*.0015;
    const g=rings(groups[4],`Concealed neck lame ${i+1}`,[[y,rx,rz],[y+.035,rx-.005,rz-.003]],mat.metal,[.24,.07+i*.012,.27],-Math.PI*5/6,Math.PI*5/6);g.material=mat.metal.clone();g.material.side=THREE.DoubleSide;
    rings(groups[4],`Neck lame ${i+1} rolled edge`,[[y+.032,rx-.004,rz-.002],[y+.035,rx-.005,rz-.003]],mat.edge,[.24,.07+i*.012,.27],-Math.PI*5/6,Math.PI*5/6);
  }
  // 25 mm harness: the vest stack remains beneath these paths.
  for(const s of [-1,1]){
    const x=s*.137;
    box(groups[5],`${s<0?'Left':'Right'} front harness webbing`,[x,1.454,.161],[.025,.380,.006],mat.strap,[s*.035,0,.49]);
    box(groups[5],`${s<0?'Left':'Right'} back harness webbing`,[x,1.454,-.168],[.025,.380,.006],mat.strap,[s*.035,0,-.49]);
    const top=line(groups[5],'Harness over shoulder',[[x,1.606,.143],[x,1.669,.077],[x,1.68,0],[x,1.669,-.08],[x,1.606,-.151]],mat.strap,.0125);top.userData.explode.set(s*.035,.04,0);
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
  rings(groups[5],'Harness rib band',[[1.342,.193,.165],[1.367,.197,.167]],mat.strap,[0,0,.48]);
  rings(groups[5],'Soft waist belt',[[1.1065,.160,.098],[1.1315,.160,.099]],mat.strap,[0,0,.15]);
  box(groups[5],'Waist belt buckle',[0,1.119,.109],[.051,.027,.014],mat.edge,[0,0,.16]);
  // Chest stops at solar plexus. There is no connection to the abdominal lames.
  const chest=[[-.115,1.654],[-.058,1.628],[.058,1.628],[.115,1.654],[.200,1.589],[.215,1.502],[.159,1.422],[.081,1.406],[-.081,1.406],[-.159,1.422],[-.215,1.502],[-.200,1.589]];
  panel(groups[6],'Independent chest plate',chest,.188,.008,mat.metal,[0,.02,.69],1.50);
  const back=panel(groups[6],'Independent upper back plate',chest,.182,.008,mat.metal,[0,.02,-.66],1.50);back.rotation.y=Math.PI;
  // Recessed milled breaks, a central fold and restrained edge lines.
  for(const s of [-1,1]){
    const groove=line(groups[6],'Chest machined transition',[[s*.16,1.595],[s*.18,1.53],[s*.135,1.45],[s*.072,1.426]].map(([x,y])=>[x,y,.197-1.5*x*x+shellRelief('Independent chest plate',x,y)]),mat.edge,.0012);groove.userData.explode.set(0,.02,.69);
    for(const yy of [1.602,1.454]){
      const x=s*.133,z=.197-1.50*x*x+shellRelief('Independent chest plate',x,yy);
      box(hardware,'Torso recessed strap slot',[x,yy,z],[.038,.012,.004],mat.edge,[0,.02,.69]);
      box(hardware,'Harness strap threaded through chest slot',[x,yy,z+.003],[.025,.008,.005],mat.strap,[0,.02,.69]);
      for(const dx of [-.021,.021])box(hardware,'Chest slot metal rim',[x+dx,yy,z],[.002,.014,.005],mat.fastener,[0,.02,.69]);
      const b=box(hardware,'Back plate threaded strap slot',[x,yy,-z],[.038,.012,.006],mat.edge,[0,.02,-.66]);
      box(hardware,'Back harness strap through slot',[x,yy,-z-.004],[.025,.007,.006],mat.strap,[0,.02,-.66]);
    }
  }
  const abdominal=[];
  for(let i=0;i<4;i++){
    const top=1.405-i*.055,bottom=top-.067,w=.171-i*.007,z=.193-i*.004;
    const a=panel(groups[6],`Abdominal lame ${i+1} — 70 mm, 15 mm overlap`,[[-w,top],[-w+.015,bottom+.008],[-w*.50,bottom],[w*.50,bottom],[w-.015,bottom+.008],[w,top]],z,.007,mat.metal,[0,-i*.012,.72+i*.08],1.0);abdominal.push(a);
    for(const s of [-1,1]){
      const x=s*.095,yy=top-.018,ex=[0,-i*.012,.72+i*.08];
      box(hardware,`Abdominal lame ${i+1} vertical travel slot`,[x,yy,z-.004],[.008,.025,.007],mat.edge,ex);
      const pin=mesh(new THREE.CylinderGeometry(.004,.004,.010,12),mat.fastener,hardware,`Lame ${i+1} slotted rivet — 12 mm travel`,ex);pin.rotation.x=Math.PI/2;pin.position.set(x,yy,z+.003);remember(pin);
    }
    const edge=line(groups[6],`Abdominal lame ${i+1} downward overlap`,[[-w+.012,bottom+.01,z-w*w+.007],[0,bottom+.001,z+.009],[w-.012,bottom+.01,z-w*w+.007]],mat.edge,.001);edge.userData.explode.set(0,-i*.012,.72+i*.08);
  }
  // Optional hanging tasset omitted: the unplated waist remains uninterrupted.
  groups.forEach((g,i)=>g.traverse(o=>{if(o.isMesh)o.userData.layer=i;}));
  root.updateMatrixWorld(true);
  return {root,groups,parts,hardware,hardwareParts,collarKnits,mannequin,materials:mat,abdominal,pads};
}
