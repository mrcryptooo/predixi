import * as THREE from "three";

export interface NeuralNode {
  position: THREE.Vector3;
  side: "left" | "right" | "bridge";
}

export interface NeuralStrand {
  points: THREE.Vector3[];
  fromSide: "left" | "right" | "bridge";
  toSide: "left" | "right" | "bridge";
}

interface GeometryConfig {
  seedCount: number;
  maxConnections: number;
  distThreshold: number;
  curveSamples: number;
}

const DESKTOP_CONFIG: GeometryConfig = {
  seedCount: 85,
  maxConnections: 3,
  distThreshold: 0.78,
  curveSamples: 12,
};

const MOBILE_CONFIG: GeometryConfig = {
  seedCount: 55,
  maxConnections: 2,
  distThreshold: 0.70,
  curveSamples: 8,
};

function fibonacciSphere(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius));
  }
  return points;
}

function classifySide(x: number): "left" | "right" | "bridge" {
  if (x < -0.12) return "left";
  if (x > 0.12) return "right";
  return "bridge";
}

export function buildNeuralGeometry(mobile: boolean): {
  nodes: NeuralNode[];
  strands: NeuralStrand[];
} {
  const cfg = mobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
  const rawPositions = fibonacciSphere(cfg.seedCount);

  const nodes: NeuralNode[] = rawPositions.map((p) => ({
    position: p,
    side: classifySide(p.x),
  }));

  const strands: NeuralStrand[] = [];
  const connectionCount = new Array(nodes.length).fill(0);

  for (let i = 0; i < nodes.length; i++) {
    if (connectionCount[i] >= cfg.maxConnections) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      if (connectionCount[j] >= cfg.maxConnections) continue;
      const dist = nodes[i].position.distanceTo(nodes[j].position);
      if (dist > cfg.distThreshold) continue;

      // Organic mid-point with slight outward bow
      const mid = new THREE.Vector3()
        .addVectors(nodes[i].position, nodes[j].position)
        .multiplyScalar(0.5);
      const bowMag = 0.08 + Math.random() * 0.12;
      mid.addScaledVector(mid.clone().normalize(), bowMag);

      const curve = new THREE.QuadraticBezierCurve3(
        nodes[i].position,
        mid,
        nodes[j].position,
      );

      // Classify strand by geometry: only pure intra-hemisphere connections
      // belong to a hemisphere group. Cross-x=0 connections are bridge strands
      // that will fade out as the hemispheres separate.
      const aLeft = nodes[i].position.x < 0;
      const bLeft = nodes[j].position.x < 0;
      const strandSide: "left" | "right" | "bridge" =
        aLeft && bLeft ? "left" : !aLeft && !bLeft ? "right" : "bridge";

      strands.push({
        points: curve.getPoints(cfg.curveSamples),
        fromSide: strandSide,
        toSide: nodes[j].side,
      });

      connectionCount[i]++;
      connectionCount[j]++;
      if (connectionCount[i] >= cfg.maxConnections) break;
    }
  }

  return { nodes, strands };
}
