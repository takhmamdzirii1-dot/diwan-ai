import React from 'react';

type CreationWorkspaceProps = {
  controls: React.ReactNode;
  preview: React.ReactNode;
  previewLabel: string;
};

export default function CreationWorkspace({ controls, preview, previewLabel }: CreationWorkspaceProps) {
  return (
    <div className="studio-creation-scroll custom-scrollbar h-full overflow-y-auto bg-[var(--studio-bg)] text-white">
      <div className="studio-creation-workspace mx-auto grid min-h-full w-full grid-cols-1 items-start gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(400px,440px)_minmax(0,1fr)] lg:gap-7 lg:px-7 lg:py-7 2xl:max-w-[1560px] 2xl:gap-8 2xl:px-8 2xl:py-8">
        <section className="studio-creation-controls min-w-0 rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 sm:p-6 lg:p-7">
          {controls}
        </section>
        <section aria-label={previewLabel} className="studio-creation-preview flex min-h-[360px] min-w-0 items-start justify-center rounded-2xl border border-[var(--studio-border-subtle)] bg-white/[0.012] p-5 sm:min-h-[420px] sm:p-7 lg:sticky lg:top-0 lg:min-h-0 lg:p-8">
          {preview}
        </section>
      </div>
    </div>
  );
}
