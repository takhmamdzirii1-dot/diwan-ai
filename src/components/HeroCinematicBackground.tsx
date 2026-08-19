'use client';

import React, { useEffect, useRef } from 'react';

export interface HeroCinematicBackgroundProps {
  className?: string;
  speed?: number;
  beamIntensity?: number;
}

export default function HeroCinematicBackground({
  className = '',
  speed = 1.0,
  beamIntensity = 1.3,
}: HeroCinematicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || 750;
    let time = 0;

    // Mouse interactive coordinates with lerp smoothing
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || 750;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left) / (width || 1) - 0.5;
      targetMouseY = (e.clientY - rect.top) / (height || 1) - 0.5;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    resize();

    // Quantum Wave Ribbons Config
    const waveCount = 5;
    const waveColors = [
      { r: 31, g: 216, b: 184, alpha: 0.65 * beamIntensity },  // Vantra Teal
      { r: 110, g: 107, b: 255, alpha: 0.58 * beamIntensity }, // Neural Violet
      { r: 0, g: 240, b: 255, alpha: 0.48 * beamIntensity },   // Electric Cyan
      { r: 245, g: 185, b: 66, alpha: 0.35 * beamIntensity },  // Gold Ember
      { r: 31, g: 216, b: 184, alpha: 0.55 * beamIntensity },  // Teal Glow
    ];

    // Floating Starlight Flecks
    const flecksCount = 45;
    const flecks = Array.from({ length: flecksCount }, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 700),
      size: Math.random() * 2.4 + 0.8,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      pulseSpeed: Math.random() * 0.04 + 0.015,
      phase: Math.random() * Math.PI * 2,
    }));

    // Main Render Loop
    const render = () => {
      time += 0.01 * speed;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Top-Center Quantum Light Beam / Aurora Cone
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const beamOriginX = width * 0.5 + mouseX * 120;
      const beamOriginY = -20;
      const beamRadius = Math.max(width * 0.7, 520);

      const beamGradient = ctx.createRadialGradient(
        beamOriginX,
        beamOriginY,
        15,
        beamOriginX,
        beamOriginY,
        beamRadius
      );
      beamGradient.addColorStop(0, `rgba(31, 216, 184, ${0.65 * beamIntensity})`);
      beamGradient.addColorStop(0.25, `rgba(110, 107, 255, ${0.45 * beamIntensity})`);
      beamGradient.addColorStop(0.55, `rgba(31, 216, 184, ${0.18 * beamIntensity})`);
      beamGradient.addColorStop(1, 'rgba(10, 11, 15, 0)');

      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.arc(beamOriginX, beamOriginY, beamRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Draw Multi-Layered Flowing Neural Waves
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < waveCount; i++) {
        const color = waveColors[i];
        const freq1 = 0.0022 + i * 0.0007;
        const freq2 = 0.0016 - i * 0.0003;
        const amp1 = 65 + i * 22;
        const amp2 = 42 + i * 15;
        const phaseOffset = i * 1.4;
        const baselineY = height * 0.44 + i * 26 + mouseY * 70;

        ctx.beginPath();
        ctx.moveTo(-40, height + 60);

        // Draw wave curve
        for (let x = -40; x <= width + 40; x += 10) {
          const normalizedX = x + mouseX * 90;
          const y =
            baselineY +
            Math.sin(normalizedX * freq1 + time + phaseOffset) * amp1 +
            Math.cos(normalizedX * freq2 - time * 0.75 + phaseOffset) * amp2;

          if (x === -40) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width + 40, height + 80);
        ctx.lineTo(-40, height + 80);
        ctx.closePath();

        // Gradient fill for wave body
        const waveGrad = ctx.createLinearGradient(0, baselineY - amp1, 0, height);
        waveGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha, 0.7)})`);
        waveGrad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha * 0.4})`);
        waveGrad.addColorStop(1, 'rgba(10, 11, 15, 0)');

        ctx.fillStyle = waveGrad;
        ctx.fill();

        // Glowing Wave Crest Line
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha * 1.5, 0.95)})`;
        ctx.stroke();
      }
      ctx.restore();

      // 3. Draw Floating Micro Energy Particles (Flecks)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      flecks.forEach((fleck) => {
        fleck.x += fleck.vx + mouseX * 0.6;
        fleck.y += fleck.vy + mouseY * 0.6;
        fleck.phase += fleck.pulseSpeed;

        // Wrap boundaries
        if (fleck.x < 0) fleck.x = width;
        if (fleck.x > width) fleck.x = 0;
        if (fleck.y < 0) fleck.y = height;
        if (fleck.y > height) fleck.y = 0;

        const currentAlpha = fleck.alpha * (0.65 + Math.sin(fleck.phase) * 0.35);

        ctx.shadowColor = '#1FD8B8';
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(31, 216, 184, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(fleck.x, fleck.y, fleck.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [speed, beamIntensity]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-hidden select-none z-0 ${className}`}
    >
      {/* 1. Cinematic Shader Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none z-0"
      />

      {/* 2. Top-Center Radiant Laser Beam / Aurora Glow Pill */}
      <div
        className="absolute -top-[140px] left-1/2 -translate-x-1/2 h-[420px] w-[85vw] max-w-5xl rounded-full blur-[100px] opacity-65 mix-blend-screen pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(31,216,184,0.7) 0%, rgba(110,107,255,0.45) 45%, rgba(10,11,15,0) 80%)',
        }}
      />

      {/* 3. Subtle Bottom Fade into Page Content */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0A0B0F] via-[#0A0B0F]/60 to-transparent pointer-events-none z-0" />
    </div>
  );
}

export { HeroCinematicBackground };
