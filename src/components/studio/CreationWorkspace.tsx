import React from 'react';

type CreationWorkspaceProps = {
  controls: React.ReactNode;
  preview: React.ReactNode;
  previewLabel: string;
};

export default function CreationWorkspace({ controls, preview, previewLabel }: CreationWorkspaceProps) {
  return (
    <div className="studio-creation-scroll custom-scrollbar h-full overflow-y-auto bg-[var(--studio-canvas)] text-[var(--studio-text-primary)]">
      <div className="studio-creation-workspace mx-auto grid min-h-full w-full grid-cols-1 items-start gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(350px,390px)_minmax(0,1fr)] lg:gap-5 lg:px-6 lg:py-6 2xl:max-w-[1640px] 2xl:gap-6 2xl:px-8 2xl:py-8">
        <section className="studio-creation-controls min-w-0 rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 sm:p-6 lg:p-6">
          {controls}
        </section>
        <section aria-label={previewLabel} className="studio-creation-preview flex min-h-[360px] min-w-0 items-stretch justify-center rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-recessed)] p-4 sm:min-h-[440px] sm:p-5 lg:sticky lg:top-0 lg:h-[calc(100dvh-112px)] lg:min-h-[500px] lg:p-5">
          {preview}
        </section>
      </div>
    </div>
  );
}
