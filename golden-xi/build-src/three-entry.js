// Consistent three r148 + required addons, exposed as globals for the
// non-module game scripts (scene3d.js / game.js). Built via esbuild into
// www/three-bundle.js. Replaces the standalone r144 three.min.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.SkeletonUtilsClone = cloneSkeleton;
