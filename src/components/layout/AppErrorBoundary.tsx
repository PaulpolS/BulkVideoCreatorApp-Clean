import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
}

const RECOVERY_KEYS = [
  'activeTab',
  'theme',
  'ai_content_stock',
  'api_global_profiles',
  'api_global_active_id',
  'yt_queue_state',
];

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] App crashed while rendering', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private resetAndReload = () => {
    RECOVERY_KEYS.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#08090a', color: '#f7f8f8' }}>
        <div className="w-full max-w-xl rounded-lg border p-6 shadow-2xl" style={{ background: '#0f1011', borderColor: 'rgba(255,255,255,0.12)' }}>
          <h1 className="text-xl font-bold mb-2">เปิดแอปไม่สำเร็จ</h1>
          <p className="text-sm mb-4" style={{ color: '#d0d6e0' }}>
            แอปเจอข้อมูลเก่าหรือ error ระหว่างโหลดหน้า ลองรีโหลดก่อน ถ้ายังขึ้นหน้านี้ให้กู้คืนค่าเริ่มต้น
          </p>
          <pre className="text-xs whitespace-pre-wrap rounded-md p-3 mb-4 max-h-40 overflow-auto" style={{ background: '#191a1b', color: '#ffb4b4' }}>
            {this.state.error.message || String(this.state.error)}
          </pre>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reload}
              className="px-4 py-2 rounded-md font-semibold"
              style={{ background: '#5e6ad2', color: '#fff' }}
            >
              รีโหลด
            </button>
            <button
              type="button"
              onClick={this.resetAndReload}
              className="px-4 py-2 rounded-md font-semibold"
              style={{ background: '#2a2a2a', color: '#f7f8f8' }}
            >
              กู้คืนค่าเริ่มต้น
            </button>
          </div>
        </div>
      </div>
    );
  }
}
