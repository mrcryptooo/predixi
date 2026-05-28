"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NeuralBrainScene } from "./NeuralBrainScene";

interface Props {
  reduced: boolean;
}

export function NeuralBrainCanvas({ reduced }: Props) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const containerRef = useRef<HTMLDivElement>(null);

  // Pause rendering when tab is hidden
  useEffect(() => {
    const handler = () =>
      setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  if (reduced) return null;

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* CSS glow behind canvas — no Three.js postprocessing */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(22, 82, 240, 0.13) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "default",
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <NeuralBrainScene reduced={reduced} />
      </Canvas>
    </div>
  );
}
