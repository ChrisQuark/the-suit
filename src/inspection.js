import * as THREE from 'three';

export const LAYER_COLORS=[0x686b59,0xa46a39,0x7f7866,0x59695d,0x786d67,0x938261,0x4c6571,0x555e45];
export const LAYER_COLOR_NAMES=['Olive-gray knit','Burnt-ochre impact pads','Taupe soft vest','Field-green stab panels','Earth-tone neck lames','Khaki webbing','Slate-blue outer plates','Ranger-green gloves & boots'];
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
  for(const m of [...suit.parts,...suit.hardwareParts])m.position.copy(m.userData.rest).addScaledVector(m.userData.explode,m.userData.layer===0?0:separation);
  suit.root.updateMatrixWorld(true);
}
export function fitComponent(component,camera){
  const bounds=new THREE.Box3();for(const m of component.meshes)bounds.union(new THREE.Box3().setFromObject(m));
  const sphere=bounds.getBoundingSphere(new THREE.Sphere());
  const vfov=THREE.MathUtils.degToRad(camera.fov),hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect);
  const distance=Math.max(.10,sphere.radius/Math.sin(Math.min(vfov,hfov)/2)*1.25);
  return {center:sphere.center,distance,radius:sphere.radius};
}
