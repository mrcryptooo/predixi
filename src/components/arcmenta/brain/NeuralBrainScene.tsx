"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildNeuralGeometry } from "./buildNeuralGeometry";
import { hemisphereGroupStore, splitState } from "./hemisphereGroupStore";

const BASE_COLOR   = new THREE.Color("#1652F0");
const ACTIVE_COLOR = new THREE.Color("#00C2FF");
const NODE_COLOR   = new THREE.Color("#3A7DFF");
// Split tint targets — violet for YES (left), amber for NO (right)
const LEFT_TINT    = new THREE.Color("#6B4EFF");
const RIGHT_TINT   = new THREE.Color("#F59E0B");

const STRAND_OPACITY_BASE   = 0.18;
const STRAND_OPACITY_ACTIVE = 0.55;

interface FiringState {
  strandIndex: number;
  progress: number;
  speed: number;
}

export function NeuralBrainScene({ reduced }: { reduced: boolean }) {
  const { gl } = useThree();
  const parallaxGroupRef = useRef<THREE.Group>(null!);
  const brainGroupRef    = useRef<THREE.Group>(null!);
  const leftGroupRef     = useRef<THREE.Group>(null!);
  const rightGroupRef    = useRef<THREE.Group>(null!);
  const bridgeGroupRef   = useRef<THREE.Group>(null!);

  const mouse    = useRef({ x: 0, y: 0 });
  const isMobile = gl.domElement.clientWidth < 768;

  const { nodes, strands } = useMemo(
    () => buildNeuralGeometry(isMobile),
    [isMobile],
  );

  // ── Node geometries — one per hemisphere group so nodes separate with the split ──
  const { leftNodeGeo, rightNodeGeo, bridgeNodeGeo } = useMemo(() => {
    const l: number[] = [], r: number[] = [], b: number[] = [];
    for (const n of nodes) {
      const arr = n.position.x < 0 ? l : n.position.x > 0 ? r : b;
      arr.push(n.position.x, n.position.y, n.position.z);
    }
    const makeGeo = (pos: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      return geo;
    };
    return { leftNodeGeo: makeGeo(l), rightNodeGeo: makeGeo(r), bridgeNodeGeo: makeGeo(b) };
  }, [nodes]);

  // ── Strand line objects bucketed by hemisphere ──
  const strandLines = useMemo(() =>
    strands.map((strand) => ({
      line: new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(strand.points),
        new THREE.LineBasicMaterial({
          color: BASE_COLOR.clone(),
          transparent: true,
          opacity: STRAND_OPACITY_BASE,
        }),
      ),
      fromSide: strand.fromSide,
    })),
    [strands],
  );

  // Material arrays bucketed by side — used in useFrame for per-hemisphere tinting
  const { leftMats, rightMats, bridgeMats } = useMemo(() => {
    const leftMats: THREE.LineBasicMaterial[]   = [];
    const rightMats: THREE.LineBasicMaterial[]  = [];
    const bridgeMats: THREE.LineBasicMaterial[] = [];
    for (const { line, fromSide } of strandLines) {
      const mat = line.material as THREE.LineBasicMaterial;
      if (fromSide === "left")        leftMats.push(mat);
      else if (fromSide === "right")  rightMats.push(mat);
      else                            bridgeMats.push(mat);
    }
    return { leftMats, rightMats, bridgeMats };
  }, [strandLines]);

  // Register hemisphere groups in module store for Phase 3+ GSAP access
  useEffect(() => {
    hemisphereGroupStore.leftGroup   = leftGroupRef.current;
    hemisphereGroupStore.rightGroup  = rightGroupRef.current;
    hemisphereGroupStore.bridgeGroup = bridgeGroupRef.current;
    return () => {
      hemisphereGroupStore.leftGroup   = null;
      hemisphereGroupStore.rightGroup  = null;
      hemisphereGroupStore.bridgeGroup = null;
    };
  }, []);

  // Mouse parallax — desktop only
  useEffect(() => {
    if (isMobile) return;
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isMobile]);

  const firingRef    = useRef<FiringState[]>([]);
  const nextFireRef  = useRef(0);

  // Shared node material — same color for all hemispheres (tinting is strand-only)
  const nodeMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: NODE_COLOR,
        size: isMobile ? 0.022 : 0.018,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
      }),
    [isMobile],
  );

  useFrame((_, delta) => {
    if (reduced) return;

    // ── 1. Idle rotation ──────────────────────────────────────────────────
    brainGroupRef.current.rotation.y += delta * 0.06;

    // ── 2. Mouse parallax (desktop only) ─────────────────────────────────
    if (!isMobile) {
      parallaxGroupRef.current.rotation.y +=
        (mouse.current.x * 0.18 - parallaxGroupRef.current.rotation.y) * 0.05;
      parallaxGroupRef.current.rotation.x +=
        (mouse.current.y * 0.12 - parallaxGroupRef.current.rotation.x) * 0.05;
    }

    // ── 3. Hemisphere split driven by GSAP splitState.progress ───────────
    const p = splitState.progress;
    leftGroupRef.current.position.x   = -0.95 * p;
    rightGroupRef.current.position.x  =  0.95 * p;

    // Color tint: 0 = BASE_COLOR, 1 = hemisphere tint
    const tintP = p * 0.75;
    for (const mat of leftMats)  mat.color.lerpColors(BASE_COLOR, LEFT_TINT,  tintP);
    for (const mat of rightMats) mat.color.lerpColors(BASE_COLOR, RIGHT_TINT, tintP);

    // Bridge strands fade as hemispheres pull apart (fully gone at p ≈ 0.72)
    const bridgeFade = Math.max(0, 1 - p * 1.4);
    for (const mat of bridgeMats) mat.opacity = STRAND_OPACITY_BASE * bridgeFade;

    // ── 4. Fire scheduler (disabled when split is mostly done) ────────────
    nextFireRef.current -= delta;
    if (nextFireRef.current <= 0 && strandLines.length > 0 && p < 0.6) {
      const idx = Math.floor(Math.random() * strandLines.length);
      firingRef.current.push({ strandIndex: idx, progress: 0, speed: 0.6 + Math.random() * 0.8 });
      nextFireRef.current = 0.08 + Math.random() * 0.18;
    }

    // ── 5. Active firing pulses (override tint — step 3 corrects next frame) ──
    firingRef.current = firingRef.current.filter((f) => {
      f.progress = Math.min(1, f.progress + delta * f.speed);
      const mat = strandLines[f.strandIndex].line.material as THREE.LineBasicMaterial;
      const env = Math.sin(f.progress * Math.PI);
      mat.color.lerpColors(BASE_COLOR, ACTIVE_COLOR, env);
      mat.opacity = STRAND_OPACITY_BASE + (STRAND_OPACITY_ACTIVE - STRAND_OPACITY_BASE) * env;
      if (f.progress >= 1) {
        // Don't reset color — step 3 corrects it on the next frame
        mat.opacity = STRAND_OPACITY_BASE;
        return false;
      }
      return true;
    });
  });

  return (
    <group ref={parallaxGroupRef}>
      <group ref={brainGroupRef}>
        {/* Left hemisphere — GSAP splitState drives position.x via useFrame */}
        <group ref={leftGroupRef}>
          {strandLines
            .filter((s) => s.fromSide === "left")
            .map((s, i) => <primitive key={`l-${i}`} object={s.line} />)}
          <points geometry={leftNodeGeo} material={nodeMat} />
        </group>

        {/* Right hemisphere */}
        <group ref={rightGroupRef}>
          {strandLines
            .filter((s) => s.fromSide === "right")
            .map((s, i) => <primitive key={`r-${i}`} object={s.line} />)}
          <points geometry={rightNodeGeo} material={nodeMat} />
        </group>

        {/* Bridge — cross-hemisphere strands that fade as hemispheres separate */}
        <group ref={bridgeGroupRef}>
          {strandLines
            .filter((s) => s.fromSide === "bridge")
            .map((s, i) => <primitive key={`b-${i}`} object={s.line} />)}
          <points geometry={bridgeNodeGeo} material={nodeMat} />
        </group>
      </group>
    </group>
  );
}
