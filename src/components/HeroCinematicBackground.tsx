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
  beamIntensity = 1.0,
}: HeroCinematicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let time = 0;
    let isVisible = true;

    // Mouse interactive coordinates with lerp smoothing
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleResize = () => {
      const parent = containerRef.current;
      if (!parent || !canvas) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left) / (rect.width || 1) - 0.5;
      targetMouseY = (e.clientY - rect.top) / (rect.height || 1) - 0.5;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    handleResize();

    // IntersectionObserver to pause rendering when scrolled out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    // Quantum Wave Ribbons Config
    const waveCount = 5;
    const waveColors = [
      { r: 31, g: 216, b: 184, alpha: 0.35 * beamIntensity }, // Vantra Teal
      { r: 110, g: 107, b: 255, alpha: 0.32 * beamIntensity }, // Neural Violet
      { r: 42, g: 187, b: 255, alpha: 0.25 * beamIntensity },  // Electric Cyan
      { r: 245, g: 185, b: 66, alpha: 0.18 * beamIntensity },  // Gold Ember
      { r: 31, g: 216, b: 184, alpha: 0.28 * beamIntensity },  // Teal Glow
    ];

    // Floating Starlight Flecks
    const flecksCount = 38;
    const flecks = Array.from({ length: flecksCount }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * 600,
      size: Math.random() * 2 + 0.6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.2,
      pulseSpeed: Math.random() * 0.03 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    // Main Render Loop
    const render = () => {
      if (isVisible) {
        time += 0.008 * speed;
        mouseX += (targetMouseX - mouseX) * 0.04;
        mouseY += (targetMouseY - mouseY) * 0.04;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Top-Center Quantum Light Beam / Aurora Cone
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const beamOriginX = width * 0.5 + mouseX * 100;
        const beamOriginY = -40;
        const beamRadius = Math.max(width * 0.65, 450);

        const beamGradient = ctx.createRadialGradient(
          beamOriginX,
          beamOriginY,
          10,
          beamOriginX,
          beamOriginY,
          beamRadius
        );
        beamGradient.addColorStop(0, `rgba(31, 216, 184, ${0.45 * beamIntensity})`);
        beamGradient.addColorStop(0.3, `rgba(110, 107, 255, ${0.25 * beamIntensity})`);
        beamGradient.addColorStop(0.65, `rgba(31, 216, 184, ${0.08 * beamIntensity})`);
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
          const freq1 = 0.0025 + i * 0.0008;
          const freq2 = 0.0018 - i * 0.0004;
          const amp1 = 55 + i * 18;
          const amp2 = 35 + i * 12;
          const phaseOffset = i * 1.35;
          const baselineY = height * 0.42 + i * 22 + mouseY * 60;

          ctx.beginPath();
          ctx.moveTo(-20, height);

          // Draw wave curve
          for (let x = -20; x <= width + 20; x += 12) {
            const normalizedX = x + mouseX * 80;
            const y =
              baselineY +
              Math.sin(normalizedX * freq1 + time + phaseOffset) * amp1 +
              Math.cos(normalizedX * freq2 - time * 0.8 + phaseOffset) * amp2;

            if (x === -20) {
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.lineTo(width + 20, height + 50);
          ctx.lineTo(-20, height + 50);
          ctx.closePath();

          // Gradient fill for wave
          const waveGrad = ctx.createLinearGradient(0, baselineY - amp1, 0, height);
          waveGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha})`);
          waveGrad.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha * 0.3})`);
          waveGrad.addColorStop(1, 'rgba(10, 11, 15, 0)');

          ctx.fillStyle = waveGrad;
          ctx.fill();

          // Glowing Wave Crest Line
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha * 1.4})`;
          ctx.stroke();
        }
        ctx.restore();

        // 3. Draw Floating Micro Energy Particles (Flecks)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        flecks.forEach((fleck) => {
          fleck.x += fleck.vx + mouseX * 0.5;
          fleck.y += fleck.vy + mouseY * 0.5;
          fleck.phase += fleck.pulseSpeed;

          // Wrap boundaries
          if (fleck.x < 0) fleck.x = width;
          if (fleck.x > width) fleck.x = 0;
          if (fleck.y < 0) fleck.y = height;
          if (fleck.y > height) fleck.y = 0;

          const currentAlpha = fleck.alpha * (0.6 + Math.sin(fleck.phase) * 0.4);

          ctx.fillStyle = `rgba(31, 216, 184, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(fleck.x, fleck.y, fleck.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (containerRef.current) observer.unobserve(containerRef.current);
    };
  }, [speed, beamIntensity]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none -z-10 ${className}`}
    >
      {/* 1. Cinematic Shader Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full mix-blend-screen opacity-90 transition-opacity duration-1000"
      />

      {/* 2. Top-Center Radiant Laser Beam / Aurora Glow Effect */}
      <div
        className="absolute -top-[120px] left-1/2 -translate-x-1/2 h-[380px] w-[80vw] max-w-4xl rounded-full blur-[110px] opacity-45 mix-blend-screen pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(31,216,184,0.6) 0%, rgba(110,107,255,0.4) 40%, rgba(10,11,15,0) 80%)',
        }}
      />

      {/* 3. Central Radial Mask & Contrast Vignette to Guarantee 100% Headline Readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(10,11,15,0.2) 0%, rgba(10,11,15,0.65) 55%, rgba(10,11,15,0.98) 100%)',
        }}
      />

      {/* 4. Smooth Bottom Fade into Page Content */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0A0B0F] via-[#0A0B0F]/70 to-transparent pointer-events-none" />
    </div>
  );
}

export { HeroCinematicBackground };
