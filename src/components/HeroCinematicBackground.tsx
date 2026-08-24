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
  beamIntensity = 0.95,
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

    // Dual-tone calm quantum waves (Teal & Violet only)
    const waveCount = 4;
    const waveColors = [
      { r: 31, g: 216, b: 184, alpha: 0.45 * beamIntensity },  // Vantra Teal
      { r: 110, g: 107, b: 255, alpha: 0.38 * beamIntensity }, // Soft Violet
      { r: 31, g: 216, b: 184, alpha: 0.32 * beamIntensity },  // Muted Teal
      { r: 110, g: 107, b: 255, alpha: 0.25 * beamIntensity }, // Ambient Violet
    ];

    const flecksCount = 30;
    const flecks = Array.from({ length: flecksCount }, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 700),
      size: Math.random() * 2.0 + 0.6,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.2,
      pulseSpeed: Math.random() * 0.03 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      time += 0.008 * speed;
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // 1. Quiet Top-Center Quantum Light Beam
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const beamOriginX = width * 0.5 + mouseX * 100;
      const beamOriginY = -20;
      const beamRadius = Math.max(width * 0.65, 480);

      const beamGradient = ctx.createRadialGradient(
        beamOriginX,
        beamOriginY,
        15,
        beamOriginX,
        beamOriginY,
        beamRadius
      );
      beamGradient.addColorStop(0, `rgba(31, 216, 184, ${0.45 * beamIntensity})`);
      beamGradient.addColorStop(0.3, `rgba(110, 107, 255, ${0.30 * beamIntensity})`);
      beamGradient.addColorStop(0.65, `rgba(31, 216, 184, ${0.10 * beamIntensity})`);
      beamGradient.addColorStop(1, 'rgba(5, 5, 6, 0)');

      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.arc(beamOriginX, beamOriginY, beamRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Flowing Waves
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < waveCount; i++) {
        const color = waveColors[i];
        const freq1 = 0.002 + i * 0.0006;
        const freq2 = 0.0014 - i * 0.0002;
        const amp1 = 50 + i * 18;
        const amp2 = 32 + i * 12;
        const phaseOffset = i * 1.5;
        const baselineY = height * 0.46 + i * 28 + mouseY * 50;

        ctx.beginPath();
        ctx.moveTo(-40, height + 60);

        for (let x = -40; x <= width + 40; x += 12) {
          const normalizedX = x + mouseX * 70;
          const y =
            baselineY +
            Math.sin(normalizedX * freq1 + time + phaseOffset) * amp1 +
            Math.cos(normalizedX * freq2 - time * 0.7 + phaseOffset) * amp2;

          ctx.lineTo(x, y);
        }

        ctx.lineTo(width + 40, height + 80);
        ctx.lineTo(-40, height + 80);
        ctx.closePath();

        const waveGrad = ctx.createLinearGradient(0, baselineY - amp1, 0, height);
        waveGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha, 0.5)})`);
        waveGrad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha * 0.3})`);
        waveGrad.addColorStop(1, 'rgba(5, 5, 6, 0)');

        ctx.fillStyle = waveGrad;
        ctx.fill();

        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha * 1.3, 0.75)})`;
        ctx.stroke();
      }
      ctx.restore();

      // 3. Starlight Micro-particles
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      flecks.forEach((fleck) => {
        fleck.x += fleck.vx + mouseX * 0.4;
        fleck.y += fleck.vy + mouseY * 0.4;
        fleck.phase += fleck.pulseSpeed;

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none z-0"
      />

      <div
        className="absolute -top-[140px] left-1/2 -translate-x-1/2 h-[380px] w-[80vw] max-w-4xl rounded-full blur-[90px] opacity-45 mix-blend-screen pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(31,216,184,0.5) 0%, rgba(110,107,255,0.3) 45%, rgba(5,5,6,0) 80%)',
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#050506] via-[#050506]/60 to-transparent pointer-events-none z-0" />
    </div>
  );
}

export { HeroCinematicBackground };
