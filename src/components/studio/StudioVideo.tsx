'use client';

import React, { useState } from 'react';
import {
  Video,
  Download,
  Film,
  Loader2,
} from 'lucide-react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { getModelCost } from '../../config/pricing';

const CAMERA_MOTIONS = [
  'Cinematic Drone Flyover',
  'Smooth 360° Orbit',
  'Dynamic Forward Push',
  'Slow Motion Pan',
  'Static Master Shot',
];

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  posterUrl: string;
  prompt: string;
  duration: string;
  model: string;
  cost: number;
  timestamp: string;
}

export default function StudioVideo() {
  const { user, balance, refreshBalance } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'kling-ai-1-5' | 'runway-gen-3'>('kling-ai-1-5');
  const [duration, setDuration] = useState<'5s' | '10s'>('5s');
  const [cameraMotion, setCameraMotion] = useState('Cinematic Drone Flyover');
  const [isGenerating, setIsGenerating] = useState(false);

  const baseCost = getModelCost(model) || 240;
  const cost = baseCost * (duration === '10s' ? 2 : 1);

  const [videos, setVideos] = useState<GeneratedVideo[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!user) {
      openAuthModal('signin');
      return;
    }
    if (balance < cost) {
      openTopUpModal();
      return;
    }
    setIsGenerating(true);

    // Simulate video generation pipeline (wire to provider API when available)
    await new Promise((r) => setTimeout(r, 3000));

    const newVid: GeneratedVideo = {
      id: `vid-${Date.now()}`,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      prompt: prompt,
      duration: `${duration} (1080p)`,
      model: model === 'kling-ai-1-5' ? 'Kling AI 1.5 HD' : 'Runway Gen-3 Alpha',
      cost: cost,
      timestamp: 'Just now',
    };

    setVideos((prev) => [newVid, ...prev]);
    setIsGenerating(false);
    if (user) {
      refreshBalance();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050506] overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
      {/* Header */}
      <div className="max-w-4xl mx-auto w-full space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8]">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-white tracking-tight font-heading"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Kling AI 1.5 & Runway Gen-3 Video Studio
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Direct cinematic 1080p AI video scenes with camera motion parameters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModel('kling-ai-1-5')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                model === 'kling-ai-1-5'
                  ? 'bg-[#1FD8B8]/15 border-[#1FD8B8] text-[#1FD8B8] font-bold'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/70'
              }`}
            >
              Kling AI 1.5 ({getModelCost('kling-ai-1-5') || 240} pts)
            </button>
            <button
              type="button"
              onClick={() => setModel('runway-gen-3')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                model === 'runway-gen-3'
                  ? 'bg-[#1FD8B8]/15 border-[#1FD8B8] text-[#1FD8B8] font-bold'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/70'
              }`}
            >
              Runway Gen-3 ({getModelCost('runway-gen-3') || 280} pts)
            </button>
          </div>
        </div>
      </div>

      {/* Video Generation Form */}
      <div className="max-w-4xl mx-auto w-full rounded-3xl border border-white/[0.1] bg-[#0E1016] p-6 space-y-6 shadow-2xl">
        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white">Cinematic Scene Prompt</label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the action and environment (e.g., Drone flying through coastal mountains of Béjaïa overlooking azure waters with realistic waves and seagulls...)"
            className="w-full rounded-2xl border border-white/[0.1] bg-[#050608] p-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#1FD8B8] focus:ring-1 focus:ring-[#1FD8B8]"
          />
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#CBD5E1]">Duration</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDuration('5s')}
                className={`py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  duration === '5s'
                    ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 text-[#1FD8B8]'
                    : 'border-white/[0.08] bg-[#050608] text-[#94A3B8]'
                }`}
              >
                5 Seconds (1080p)
              </button>
              <button
                type="button"
                onClick={() => setDuration('10s')}
                className={`py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  duration === '10s'
                    ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 text-[#1FD8B8]'
                    : 'border-white/[0.08] bg-[#050608] text-[#94A3B8]'
                }`}
              >
                10 Seconds (Extended)
              </button>
            </div>
          </div>

          {/* Camera Motion */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#CBD5E1]">Camera Trajectory</label>
            <select
              value={cameraMotion}
              onChange={(e) => setCameraMotion(e.target.value)}
              className="w-full h-10 rounded-xl border border-white/[0.08] bg-[#050608] px-3 text-xs text-white outline-none focus:border-[#1FD8B8]"
            >
              {CAMERA_MOTIONS.map((motion) => (
                <option key={motion} value={motion} className="bg-[#0E1016]">
                  {motion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] flex-wrap gap-3">
          <div className="text-xs text-[#64748B]">
            Cost:{' '}
            <span className="font-mono font-bold text-[#1FD8B8]">{cost} Points / Scene</span>
            {!user && <span className="ms-2 text-white/40">· Sign in required</span>}
            {user && balance < cost && (
              <span className="ms-2 text-red-400">· Insufficient balance</span>
            )}
          </div>

          <button
            type="button"
            disabled={!prompt.trim() || isGenerating}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-6 h-11 rounded-2xl bg-[#1FD8B8] hover:bg-[#34e2c2] text-[#050506] font-bold text-sm shadow-[0_4px_20px_rgba(31,216,184,0.35)] transition cursor-pointer disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#050506]" />
                <span>Synthesizing Video...</span>
              </>
            ) : (
              <>
                <Video className="h-4 w-4 text-[#050506]" />
                <span>Generate Scene ({cost} pts)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video Outputs Showcase */}
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
          Production Scenes
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.length === 0 ? (
            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-20 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-sm font-medium text-white/70">No videos generated yet</p>
              <p className="text-xs text-white/40 mt-1">Your cinematic scenes will appear here.</p>
            </div>
          ) : (
            videos.map((vid) => (
            <div
              key={vid.id}
              className="rounded-3xl overflow-hidden border border-white/[0.1] bg-[#0E1016] shadow-xl space-y-3 p-3"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/60">
                <video
                  src={vid.videoUrl}
                  poster={vid.posterUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-2 space-y-2">
                <p className="text-xs text-white/90 line-clamp-2">
                  "{vid.prompt}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1">
                  <span>{vid.model} • {vid.duration}</span>
                  <a
                    href={vid.videoUrl}
                    download="vantra-video.mp4"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#1FD8B8] hover:underline cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}
