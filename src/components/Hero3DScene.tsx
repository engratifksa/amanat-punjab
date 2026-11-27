import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function HexagonalEmeraldLantern() {
  const lanternRef = useRef<THREE.Group>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    if (lanternRef.current) {
      lanternRef.current.rotation.y += delta * 0.38;
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 2.6 + Math.sin(state.clock.elapsedTime * 2.4) * 0.45;
    }
  });

  const pillarAngles = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);
  const faceAngles = [0, 1, 2, 3, 4, 5].map((i) => ((i + 0.5) * Math.PI) / 3);

  const goldMat = (
    <meshStandardMaterial
      color="#EAB308"
      emissive="#92400E"
      emissiveIntensity={0.22}
      metalness={0.86}
      roughness={0.24}
    />
  );

  return (
    <Float speed={1.7} rotationIntensity={0.18} floatIntensity={0.42}>
      <group ref={lanternRef} scale={0.96} position={[0, -0.1, 0]}>
        {/* Inner glowing emerald-mint light bulb */}
        <pointLight ref={coreLightRef} position={[0, 0.05, 0]} color="#34D399" distance={4.5} intensity={2.8} />
        <mesh position={[0, 0.02, 0]}>
          <capsuleGeometry args={[0.26, 0.72, 12, 24]} />
          <meshStandardMaterial
            color="#A7F3D0"
            emissive="#10B981"
            emissiveIntensity={2.4}
            roughness={0.1}
          />
        </mesh>

        {/* Bottom Emerald Glass Plinth */}
        <mesh position={[0, -1.24, 0]}>
          <cylinderGeometry args={[0.96, 1.0, 0.24, 6]} />
          <meshPhysicalMaterial
            color="#059669"
            emissive="#047857"
            emissiveIntensity={0.55}
            roughness={0.12}
            metalness={0.1}
            transparent
            opacity={0.78}
          />
        </mesh>

        {/* Gold Base Collar */}
        <mesh position={[0, -1.04, 0]}>
          <cylinderGeometry args={[0.92, 1.02, 0.18, 6]} />
          {goldMat}
        </mesh>

        {/* 6 Gold Corner Pillars */}
        {pillarAngles.map((ang, idx) => (
          <mesh
            key={`pillar-${idx}`}
            position={[Math.cos(ang) * 0.84, 0, Math.sin(ang) * 0.84]}
          >
            <cylinderGeometry args={[0.065, 0.065, 1.98, 8]} />
            {goldMat}
          </mesh>
        ))}

        {/* 6 Translucent Glowing Emerald Glass Window Panels + Gold Diamond Accents */}
        {faceAngles.map((ang, idx) => {
          const r = 0.73;
          return (
            <group
              key={`panel-${idx}`}
              position={[Math.cos(ang) * r, 0, Math.sin(ang) * r]}
              rotation={[0, -ang + Math.PI / 2, 0]}
            >
              {/* Emerald Glass Pane */}
              <mesh>
                <boxGeometry args={[0.74, 1.84, 0.04]} />
                <meshPhysicalMaterial
                  color="#059669"
                  emissive="#10B981"
                  emissiveIntensity={0.62}
                  roughness={0.14}
                  metalness={0.08}
                  transparent
                  opacity={0.62}
                />
              </mesh>
              {/* Gold Diamond Inner Arch Frame */}
              <mesh position={[0, 0, 0.032]} rotation={[0, 0, Math.PI / 4]}>
                <ringGeometry args={[0.25, 0.295, 4]} />
                {goldMat}
              </mesh>
            </group>
          );
        })}

        {/* Upper Gold Cornice */}
        <mesh position={[0, 1.04, 0]}>
          <cylinderGeometry args={[1.02, 0.9, 0.18, 6]} />
          {goldMat}
        </mesh>

        {/* Sloped Hexagonal Emerald Glass Dome */}
        <mesh position={[0, 1.48, 0]}>
          <cylinderGeometry args={[0.24, 0.86, 0.72, 6]} />
          <meshPhysicalMaterial
            color="#059669"
            emissive="#059669"
            emissiveIntensity={0.55}
            roughness={0.15}
            transparent
            opacity={0.74}
          />
        </mesh>

        {/* 6 Gold Dome Ribs */}
        {pillarAngles.map((ang, idx) => (
          <mesh
            key={`rib-${idx}`}
            position={[Math.cos(ang) * 0.54, 1.48, Math.sin(ang) * 0.54]}
            rotation={[0, -ang, 0.68]}
          >
            <boxGeometry args={[0.06, 0.94, 0.06]} />
            {goldMat}
          </mesh>
        ))}

        {/* Top Finial Cap & Hanging Ring */}
        <mesh position={[0, 1.9, 0]}>
          <cylinderGeometry args={[0.14, 0.26, 0.16, 6]} />
          {goldMat}
        </mesh>
        <mesh position={[0, 2.15, 0]}>
          <torusGeometry args={[0.19, 0.045, 14, 36]} />
          {goldMat}
        </mesh>
      </group>
    </Float>
  );
}

export default function Hero3DScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.25, 5.2], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      className="h-full w-full"
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 5]} intensity={1.7} color="#FEF3C7" />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#6EE7B7" />
      <HexagonalEmeraldLantern />
      <Sparkles count={32} scale={4.2} size={2.2} speed={0.35} color="#FDE68A" />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI / 1.75}
        minPolarAngle={Math.PI / 3}
      />
    </Canvas>
  );
}
