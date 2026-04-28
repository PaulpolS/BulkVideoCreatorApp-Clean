import React from 'react';
import { SceneBuilder } from './SceneBuilder';
import { OutputFolderConfig } from './OutputFolderConfig';

export function FinancialDocumentaryTab() {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12">
      <OutputFolderConfig />
      <SceneBuilder />
    </div>
  );
}
