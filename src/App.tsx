'use client';

import React from 'react';
import type { LandingCatalog } from './content/landing-catalog';
import OriginalLandingPage from './components/OriginalLandingPage';

export default function App({ catalog }: { catalog?: LandingCatalog }) {
  // The Next.js static page supplies this snapshot; never fabricate prices in the legacy SPA entry.
  if (!catalog) throw new Error('LANDING_CATALOG_REQUIRED');
  return <OriginalLandingPage catalog={catalog} />;
}
