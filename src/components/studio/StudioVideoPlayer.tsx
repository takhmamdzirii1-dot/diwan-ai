'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { captureSessionThumbnail } from './MediaResultRail';

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default function StudioVideoPlayer({ src, label, onThumbnail }: {
  src: string;
  label: string;
  onThumbnail?: (value: string | null) => void;
}) {
  const t = useTranslations('studio.mediaViewer');
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedSource = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const clearHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const reveal = useCallback(() => {
    setVisible(true);
    clearHide();
    if (videoRef.current && !videoRef.current.paused) hideTimer.current = setTimeout(() => setVisible(false), 2000);
  }, [clearHide]);
  useEffect(() => {
    setPlaying(false); setVisible(true); setCurrentTime(0); setDuration(0);
    capturedSource.current = null;
    clearHide();
    return clearHide;
  }, [src, clearHide]);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setVisible(true));
    else video.pause();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement === frameRef.current) void document.exitFullscreen();
    else if (frameRef.current?.requestFullscreen) void frameRef.current.requestFullscreen();
    else (videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | null)?.webkitEnterFullscreen?.();
  };
  const controlsVisible = visible || !playing;
  const progress = duration > 0 ? Math.min(100, currentTime / duration * 100) : 0;
  return <div ref={frameRef} tabIndex={0} role="group" aria-label={label}
    onPointerEnter={reveal} onPointerMove={reveal} onPointerDown={reveal} onFocusCapture={reveal}
    onKeyDown={(event) => { if (event.target === frameRef.current && (event.key === ' ' || event.key.toLowerCase() === 'k')) { event.preventDefault(); togglePlay(); } }}
    className="group relative flex h-full min-h-[300px] w-full items-center justify-center overflow-hidden rounded-xl bg-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">
    <video ref={videoRef} key={src} src={src} playsInline preload="metadata" aria-label={label}
      className="h-full max-h-full w-full object-contain"
      onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onLoadedData={(event) => {
        if (capturedSource.current === src) return;
        capturedSource.current = src;
        onThumbnail?.(captureSessionThumbnail(event.currentTarget));
      }}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => { setPlaying(true); reveal(); }}
      onPause={() => { setPlaying(false); setVisible(true); clearHide(); }}
      onEnded={() => { setPlaying(false); setVisible(true); clearHide(); }}
      onVolumeChange={(event) => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }} />
    <button type="button" onClick={togglePlay} aria-label={playing ? t('pause') : t('play')}
      className={`absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/65 text-white transition-[opacity,background-color,transform] duration-200 hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ms-0.5 h-6 w-6 fill-current" />}
    </button>
    <div className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-9 transition-opacity duration-200 sm:px-4 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <div className="relative mb-3 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/35"><div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} /></div>
        <input type="range" min={0} max={duration || 1} step="0.01" value={Math.min(currentTime, duration || 1)}
          onChange={(event) => { const next = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = next; setCurrentTime(next); }}
          aria-label={t('seek')} className="studio-media-range studio-media-scrub absolute inset-0 w-full cursor-pointer bg-transparent" />
      </div>
      <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums sm:gap-4">
        <button type="button" onClick={togglePlay} aria-label={playing ? t('pause') : t('play')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white">{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button>
        <span dir="ltr" className="shrink-0">{timeLabel(currentTime)} / {timeLabel(duration)}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }} aria-label={muted ? t('unmute') : t('mute')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white">{muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <input type="range" min={0} max={1} step="0.05" value={muted ? 0 : volume}
          onChange={(event) => { if (videoRef.current) { videoRef.current.volume = Number(event.target.value); videoRef.current.muted = false; } }}
          aria-label={t('volume')} className="studio-media-range hidden w-20 cursor-pointer accent-white sm:block" />
        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? t('exitFullscreen') : t('fullscreen')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white">{fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>
      </div>
    </div>
  </div>;
}
