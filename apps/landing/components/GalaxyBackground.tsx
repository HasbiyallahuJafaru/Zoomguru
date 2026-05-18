'use client';

import dynamic from 'next/dynamic';

const Galaxy = dynamic(() => import('./Galaxy'), { ssr: false });

export default function GalaxyBackground() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      background: '#080808',
      pointerEvents: 'none',
    }}>
      <Galaxy
        saturation={0}
        density={1.5}
        glowIntensity={0.45}
        twinkleIntensity={0.4}
        rotationSpeed={0.03}
        speed={0.8}
        mouseRepulsion={false}
        mouseInteraction={false}
        transparent={false}
      />
    </div>
  );
}

