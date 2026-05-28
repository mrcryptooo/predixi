import * as THREE from "three";

// Module-level store so Phase 3 GSAP driver can access hemisphere groups
// without prop-drilling through React component tree.
export const hemisphereGroupStore = {
  leftGroup: null as THREE.Group | null,
  rightGroup: null as THREE.Group | null,
  bridgeGroup: null as THREE.Group | null,
};

// Plain JS proxy animated by GSAP (tl.to(splitState, { progress: 1 })).
// R3F useFrame reads this each tick and applies to Three.js groups.
// 0 = unified brain, 1 = fully split hemispheres.
export const splitState = {
  progress: 0,
};
