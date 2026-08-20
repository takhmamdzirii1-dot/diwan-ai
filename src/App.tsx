'use client';

import React from 'react';
import OriginalLandingPage from './components/OriginalLandingPage';
import { ModalProvider } from './context/ModalContext';

export default function App() {
  return (
    <ModalProvider>
      <OriginalLandingPage />
    </ModalProvider>
  );
}
