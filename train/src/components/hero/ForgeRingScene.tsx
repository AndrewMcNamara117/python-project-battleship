'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * THE FORGE RING — the hero object.
 *
 * An abstract endurance artefact: a circular elevation trace rendered as
 * radial steel bars, wrapped by a travelling teal arc that reads as position
 * on a route. Black steel and smoked glass, one accent colour, no chrome.
 *
 * Performance notes: one InstancedMesh for all 216 bars (a single draw call),
 * no post-processing, no shadow maps, capped DPR, and the whole canvas is
 * dynamically imported so Three.js never enters the initial bundle.
 */

const BAR_COUNT = 216;
const RADIUS = 2.35;

/** Deterministic elevation profile — the same silhouette on every load. */
function elevationAt(i: number): number {
  const t = (i / BAR_COUNT) * Math.PI * 2;
  return (
    Math.sin(t * 3) * 0.34 +
    Math.sin(t * 7 + 1.1) * 0.19 +
    Math.sin(t * 13 + 2.7) * 0.1 +
    Math.sin(t * 23 + 0.4) * 0.05
  );
}

function Bars({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorSteel = useMemo(() => new THREE.Color('#6b7a72'), []);
  const colorGreen = useMemo(() => new THREE.Color('#2dff8a'), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const profile = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => elevationAt(i)), []);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    // the travelling head — one lap every 16 seconds
    const head = (t / 16) % 1;

    for (let i = 0; i < BAR_COUNT; i++) {
      const a = (i / BAR_COUNT) * Math.PI * 2;
      const e = profile[i];
      const height = 0.24 + Math.abs(e) * 1.15;

      // distance behind the head, wrapped — drives the trailing glow
      const d = (head - i / BAR_COUNT + 1) % 1;
      const glow = Math.max(0, 1 - d * 3.2);

      const r = RADIUS + e * 0.22;
      dummy.position.set(Math.cos(a) * r, e * 0.55, Math.sin(a) * r);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(0.045, height * (1 + glow * 0.5), 0.045);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);

      scratch.copy(colorSteel).lerp(colorGreen, glow);
      m.setColorAt(i, scratch);
    }

    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;

    // gentle rotation plus pointer parallax — the object leans, it does not spin
    const p = pointer.current ?? { x: 0, y: 0 };
    const parent = m.parent;
    if (parent) {
      parent.rotation.y = t * 0.055 + p.x * 0.4;
      parent.rotation.x = -0.16 + p.y * 0.1;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BAR_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        metalness={0.72}
        roughness={0.28}
        emissive="#154a2c"
        emissiveIntensity={0.85}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function CoreRings() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = clock.getElapsedTime() * 0.04;
  });

  return (
    <group ref={group} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[RADIUS - 0.5, 0.009, 6, 200]} />
        <meshBasicMaterial color="#2dff8a" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[RADIUS + 0.55, 0.004, 6, 200]} />
        <meshBasicMaterial color="#eeeeee" transparent opacity={0.09} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[RADIUS - 1.25, 0.003, 6, 160]} />
        <meshBasicMaterial color="#eeeeee" transparent opacity={0.06} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rig({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();

  // react-hooks/immutability flags the camera mutation below. Per-frame
  // mutation of the Three.js scene graph is exactly what useFrame is for —
  // routing camera position through React state would re-render the tree
  // sixty times a second. The mutation is confined to this callback.
  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const p = pointer.current ?? { x: 0, y: 0 };
    camera.position.x += (p.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (5.2 - p.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

export default function ForgeRingScene() {
  const pointer = useRef({ x: 0, y: 0 });

  return (
    <div
      className="absolute inset-0"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
        };
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
      }}
    >
      <Canvas
        camera={{ position: [0, 5.2, 8.6], fov: 36 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={['#050505', 11, 22]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 3]} intensity={2.1} color="#dfeee7" />
        <pointLight position={[-3, 1, -2]} intensity={34} color="#2dff8a" distance={11} decay={2} />
        <pointLight position={[3, -1, 2]} intensity={16} color="#2dff8a" distance={9} decay={2} />
        {/* scaled to sit inside the frame at every aspect ratio */}
        <group scale={0.88}>
          <Bars pointer={pointer} />
          <CoreRings />
        </group>
        <Rig pointer={pointer} />
      </Canvas>
    </div>
  );
}
