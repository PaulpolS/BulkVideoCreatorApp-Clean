import React from 'react';

export function TrackingTab() {
  return (
    <div className="w-full h-[85vh] bg-transparent border-0 rounded-2xl overflow-hidden shadow-sm">
      <iframe 
        src="/tracking-dashboard.html" 
        className="w-full h-full border-0 bg-transparent"
        title="Sync Master Dashboard"
      />
    </div>
  );
}
