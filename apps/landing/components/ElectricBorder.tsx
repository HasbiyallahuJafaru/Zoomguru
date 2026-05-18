'use client';

import { useEffect, useRef, useCallback } from 'react';
import './ElectricBorder.css';

interface ElectricBorderProps {
  children: React.ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ElectricBorder = ({
  children,
  color = '#5227FF',
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style,
}: ElectricBorderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const random = useCallback((x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1, []);

  const noise2D = useCallback((x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const a = random(i + j * 57), b = random(i + 1 + j * 57);
    const c = random(i + (j + 1) * 57), d = random(i + 1 + (j + 1) * 57);
    const ux = fx * fx * (3.0 - 2.0 * fx), uy = fy * fy * (3.0 - 2.0 * fy);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }, [random]);

  const octavedNoise = useCallback((x: number, octaves: number, lacunarity: number, gain: number, baseAmplitude: number, baseFrequency: number, time: number, seed: number, baseFlatness: number) => {
    let y = 0, amplitude = baseAmplitude, frequency = baseFrequency;
    for (let i = 0; i < octaves; i++) {
      y += (i === 0 ? amplitude * baseFlatness : amplitude) * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return y;
  }, [noise2D]);

  const getCornerPoint = useCallback((cx: number, cy: number, r: number, startAngle: number, arcLength: number, progress: number) => ({
    x: cx + r * Math.cos(startAngle + progress * arcLength),
    y: cy + r * Math.sin(startAngle + progress * arcLength),
  }), []);

  const getRoundedRectPoint = useCallback((t: number, left: number, top: number, width: number, height: number, radius: number) => {
    const sw = width - 2 * radius, sh = height - 2 * radius;
    const ca = (Math.PI * radius) / 2;
    const total = 2 * sw + 2 * sh + 4 * ca;
    const dist = t * total;
    let acc = 0;
    if (dist <= acc + sw) return { x: left + radius + (dist - acc) / sw * sw, y: top };
    acc += sw;
    if (dist <= acc + ca) return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (dist - acc) / ca);
    acc += ca;
    if (dist <= acc + sh) return { x: left + width, y: top + radius + (dist - acc) / sh * sh };
    acc += sh;
    if (dist <= acc + ca) return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (dist - acc) / ca);
    acc += ca;
    if (dist <= acc + sw) return { x: left + width - radius - (dist - acc) / sw * sw, y: top + height };
    acc += sw;
    if (dist <= acc + ca) return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (dist - acc) / ca);
    acc += ca;
    if (dist <= acc + sh) return { x: left, y: top + height - radius - (dist - acc) / sh * sh };
    acc += sh;
    return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (dist - acc) / ca);
  }, [getCornerPoint]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const borderOffset = 60;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width + borderOffset * 2, h = rect.height + borderOffset * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      return { width: w, height: h };
    };

    let { width, height } = updateSize();

    const draw = (currentTime: number) => {
      if (!canvas || !ctx) return;
      const delta = (currentTime - lastFrameTimeRef.current) / 1000;
      timeRef.current += delta * speed;
      lastFrameTimeRef.current = currentTime;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      const left = borderOffset, top = borderOffset;
      const bw = width - 2 * borderOffset, bh = height - 2 * borderOffset;
      const radius = Math.min(borderRadius, Math.min(bw, bh) / 2);
      const perimeter = 2 * (bw + bh) + 2 * Math.PI * radius;
      const samples = Math.floor(perimeter / 2);
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const p = i / samples;
        const pt = getRoundedRectPoint(p, left, top, bw, bh, radius);
        const nx = octavedNoise(p * 8, 10, 1.6, 0.7, chaos, 10, timeRef.current, 0, 0);
        const ny = octavedNoise(p * 8, 10, 1.6, 0.7, chaos, 10, timeRef.current, 1, 0);
        const x = pt.x + nx * 60, y = pt.y + ny * 60;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => { const s = updateSize(); width = s.width; height = s.height; });
    ro.observe(container);
    animationRef.current = requestAnimationFrame(draw);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); ro.disconnect(); };
  }, [color, speed, chaos, borderRadius, octavedNoise, getRoundedRectPoint]);

  return (
    <div
      ref={containerRef}
      className={`electric-border ${className ?? ''}`}
      style={{ '--electric-border-color': color, borderRadius, ...style } as React.CSSProperties}
    >
      <div className="eb-canvas-container"><canvas ref={canvasRef} className="eb-canvas" /></div>
      <div className="eb-layers">
        <div className="eb-glow-1" />
        <div className="eb-glow-2" />
        <div className="eb-background-glow" />
      </div>
      <div className="eb-content">{children}</div>
    </div>
  );
};

export default ElectricBorder;

