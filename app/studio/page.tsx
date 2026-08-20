'use client';

import React from 'react';
import StudioWorkspace from '../../src/components/studio/StudioWorkspace';
import { ModalProvider } from '../../src/context/ModalContext';

export default function StudioPage() {
  return (
    <ModalProvider>
      <StudioWorkspace />
    </ModalProvider>
  );
}
