import * as THREE from 'three';

export const LAYER_COLORS=[0x94a3b8,0xff721b,0x9665e8,0x20b9dd,0xe776cd,0xe9c64b,0x287ff0,0x32c4a2];
export const LAYER_COLOR_NAMES=['Slate knit','Orange impact pads','Purple soft vest','Cyan stab panels','Pink neck lames','Yellow webbing','Blue outer plates','Teal gloves & boots'];
export const FULL_ORBIT={min:.20,max:Math.PI*.485};

export function desiredOpacity(part,state){
  const layer=part.userData.layer;
  if(state.selectedPart)return part.userData.component===state.selectedPart?1:0;
  if(part.userData.hardware)return state.hardware?1:state.isolate?0:state.hidden.has(5)?0:state.selected!==null&&state.selected<5?.035:1;
  if(state.hidden.has(layer))return 0;
  if(state.isolate)return state.selected===layer?1:0;
  if(layer===1&&state.selected!==1&&state.separation<.04&&!state.peeling)return 0;
  if(state.peeling&&layer>state.peelStage)return 0;
  if(state.hardware){if(layer===6)return .13;if(layer===5)return 1;if(layer===4)return .4;if(layer===0)return .35;return .08;}
  if(state.selected===4&&part.userData.isCollar)return .035;
  if(state.selected!==null&&layer>state.selected)return .045;
  return 1;
}
export function applyAssemblyPose(suit,separation){
  for(const m of [...suit.parts,...suit.hardwareParts])m.position.copy(m.userData.rest).addScaledVector(m.userData.explode,separation);
  suit.root.updateMatrixWorld(true);
}
export function fitComponent(component,camera){
  const bounds=new THREE.Box3();for(const m of component.meshes)bounds.union(new THREE.Box3().setFromObject(m));
  const sphere=bounds.getBoundingSphere(new THREE.Sphere());
  const vfov=THREE.MathUtils.degToRad(camera.fov),hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect);
  const distance=Math.max(.10,sphere.radius/Math.sin(Math.min(vfov,hfov)/2)*1.25);
  return {center:sphere.center,distance,radius:sphere.radius};
}
