import React from 'react';
import AmbientMotionBackground from '../src/components/AmbientMotionBackground';
import '../src/globals.css';

export interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="dark bg-[#0A0B0F] text-[#F5F6F8] antialiased min-h-screen relative selection:bg-[#1FD8B8] selection:text-[#0A0B0F]">
      <AmbientMotionBackground />
      {children}
    </div>
  );
}
