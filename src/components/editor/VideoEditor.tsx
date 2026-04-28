import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import html2canvas from 'html2canvas';
import { ContentIdea } from '../../hooks/useContentStock';

interface EditorProps {
    selectedItems: ContentIdea[];
    onRendered: (ids: string[]) => void;
}

export function VideoEditor({ selectedItems, onRendered }: EditorProps) {
    const [ffmpegLoading, setFfmpegLoading] = useState(false);
    const [ffmpegReady, setFfmpegReady] = useState(false);
    const [rendering, setRendering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string>('');
    const [currentRenderIndex, setCurrentRenderIndex] = useState(0);
    const [totalRender, setTotalRender] = useState(0);

    // Assets
    const [footageFiles, setFootageFiles] = useState<File[]>([]);
    const [musicFiles, setMusicFiles] = useState<File[]>([]);
    const [selectedMusicIdx, setSelectedMusicIdx] = useState(0);
    const [creditFile, setCreditFile] = useState<File | null>(null);
    
    // Settings
    const [duration, setDuration] = useState(15);
    const [fontFamily, setFontFamily] = useState('font-prompt');
    const [titleSize, setTitleSize] = useState(24);
    const [bodySize, setBodySize] = useState(16);
    const [marginTop, setMarginTop] = useState(40);
    const [marginBottom, setMarginBottom] = useState(40);

    const ffmpegRef = useRef<FFmpeg>(new FFmpeg());
    const previewRef = useRef<HTMLDivElement>(null);
    
    const fonts = [
        { id: 'font-prompt', name: 'Prompt (Google)' },
        { id: 'font-kanit', name: 'Kanit (Google)' },
        { id: 'font-sarabun', name: 'Sarabun (Google)' },
        { id: 'font-itim', name: 'Itim (Google)' },
        { id: 'font-niramit', name: 'Niramit (Google)' },
        { id: 'font-mali', name: 'Mali (Google)' },
    ];

    const durations = [
        { value: 10, label: '10 วินาที' },
        { value: 15, label: '15 วินาที' },
        { value: 20, label: '20 วินาที' },
        { value: 30, label: '30 วินาที' },
        { value: 45, label: '45 วินาที' },
        { value: 60, label: '60 วินาที' },
    ];

    // Preview item = first selected item
    const previewItem = selectedItems.length > 0 ? selectedItems[0] : null;

    // Load FFMPEG
    const loadFFmpeg = async () => {
        if (ffmpegReady || ffmpegLoading) return;
        setFfmpegLoading(true);
        setLog('กำลังโหลด FFMPEG engine (ครั้งแรกอาจช้า ~30MB)...');

        const ffmpeg = ffmpegRef.current;
        ffmpeg.on('log', ({ message }) => {
            setLog(message);
        });
        ffmpeg.on('progress', ({ progress: p }) => {
            setProgress(Math.round(p * 100));
        });

        try {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            const { toBlobURL } = await import('@ffmpeg/util');
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            setFfmpegReady(true);
            setLog('✅ FFMPEG พร้อมใช้งาน!');
        } catch (e: any) {
            setLog('❌ โหลด FFMPEG ไม่สำเร็จ: ' + e.message);
        } finally {
            setFfmpegLoading(false);
        }
    };

    useEffect(() => {
        loadFFmpeg();
    }, []);

    // Get random footage file
    const getRandomFootage = (): File | null => {
        if (footageFiles.length === 0) return null;
        return footageFiles[Math.floor(Math.random() * footageFiles.length)];
    };

    // Render single item
    const renderSingleItem = async (item: ContentIdea, index: number): Promise<Uint8Array | null> => {
        const ffmpeg = ffmpegRef.current;
        setCurrentRenderIndex(index + 1);

        // 1. Get footage (random from folder or blank)
        const footage = getRandomFootage();
        if (footage) {
            const videoData = await fetchFile(footage);
            await ffmpeg.writeFile('input_video.mp4', videoData);
        }

        // 2. Capture text overlay using html2canvas
        if (previewRef.current) {
            // Temporarily update preview content for this item
            const canvas = await html2canvas(previewRef.current, {
                backgroundColor: '#000',
                width: 1080,
                height: 1920,
                scale: 3,
            });
            const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve as any, 'image/png'));
            const overlayData = new Uint8Array(await blob.arrayBuffer());
            await ffmpeg.writeFile('overlay.png', overlayData);
        }

        // 3. Build FFmpeg command
        const args: string[] = [];
        
        if (footage) {
            // Video with text overlay
            args.push('-i', 'input_video.mp4', '-i', 'overlay.png');
            args.push('-filter_complex', `[0:v]scale=1080:1920,setsar=1[bg];[1:v]scale=1080:1920[ol];[bg][ol]overlay=0:0:format=auto`);
            args.push('-t', String(duration));
        } else {
            // Image only (no video input)
            args.push('-loop', '1', '-i', 'overlay.png');
            args.push('-vf', 'scale=1080:1920');
            args.push('-t', String(duration));
        }

        // Audio
        const music = musicFiles.length > 0 ? musicFiles[selectedMusicIdx] || musicFiles[0] : null;
        if (music) {
            const audioData = await fetchFile(music);
            await ffmpeg.writeFile('bg_music.mp3', audioData);
            args.push('-i', 'bg_music.mp3', '-shortest');
        }

        args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', `output_${index}.mp4`);

        setLog(`🎬 กำลัง render คลิป ${index + 1}...`);
        await ffmpeg.exec(args);

        // 4. If credit clip exists, concat
        if (creditFile) {
            const creditData = await fetchFile(creditFile);
            await ffmpeg.writeFile('credit.mp4', creditData);
            
            // Create concat file
            await ffmpeg.writeFile('concat.txt', `file 'output_${index}.mp4'\nfile 'credit.mp4'\n`);
            await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-y', `final_${index}.mp4`]);
            
            const data = await ffmpeg.readFile(`final_${index}.mp4`);
            return data as Uint8Array;
        } else {
            const data = await ffmpeg.readFile(`output_${index}.mp4`);
            return data as Uint8Array;
        }
    };

    // Bulk render
    const handleBulkRender = async () => {
        if (selectedItems.length === 0) {
            alert('กรุณาเลือก content ก่อนนะครับ');
            return;
        }
        if (!ffmpegReady) {
            alert('FFMPEG ยังโหลดไม่เสร็จ กรุณารอสักครู่');
            return;
        }

        setRendering(true);
        setTotalRender(selectedItems.length);
        const renderedIds: string[] = [];

        try {
            for (let i = 0; i < selectedItems.length; i++) {
                setProgress(0);
                const item = selectedItems[i];
                const result = await renderSingleItem(item, i);
                
                if (result) {
                    // Download each clip
                    const blob = new Blob([result], { type: 'video/mp4' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `clip_${i + 1}_${item.topic.slice(0, 20).replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.mp4`;
                    a.click();
                    URL.revokeObjectURL(url);
                    renderedIds.push(item.id);
                }
            }

            onRendered(renderedIds);
            setLog(`🎉 render เสร็จทั้งหมด ${renderedIds.length} คลิป!`);
            alert(`🎉 render สำเร็จ ${renderedIds.length}/${selectedItems.length} คลิป!`);
        } catch (e: any) {
            setLog('❌ Error: ' + e.message);
            alert('เกิดข้อผิดพลาด: ' + e.message);
        } finally {
            setRendering(false);
            setCurrentRenderIndex(0);
            setTotalRender(0);
            setProgress(0);
        }
    };

    const sidebarBox: React.CSSProperties = { backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' };
    const labelStyle: React.CSSProperties = { color: 'var(--text-muted)' };
    const inputStyle: React.CSSProperties = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' };

    return (
        <div className="flex-1 flex gap-6 h-full">
                <div 
                  className="flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-4"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                   <div className="flex gap-4">
                        {/* 9:16 Preview Box */}
                        <div 
                            ref={previewRef}
                            style={{ width: '360px', height: '640px' }} 
                            className={`bg-black/90 rounded-lg relative overflow-hidden shadow-2xl border border-gray-700 mx-auto ${fontFamily}`}
                        >
                            {/* Video BG placeholder */}
                            {footageFiles.length > 0 && (
                                <video 
                                   src={URL.createObjectURL(footageFiles[0])} 
                                   className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none" 
                                   autoPlay loop muted 
                                />
                            )}
                            
                            {previewItem ? (
                                <div 
                                  className="absolute inset-0 flex flex-col justify-center gap-5 text-white z-10 w-full"
                                  style={{ paddingTop: `${marginTop}px`, paddingBottom: `${marginBottom}px`, paddingLeft: '24px', paddingRight: '24px' }}
                                >
                                    <h1 
                                        className="text-center font-bold bg-gradient-to-br from-black/80 to-black/60 p-5 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm"
                                        style={{ fontSize: `${titleSize}px`, lineHeight: 1.3 }}
                                    >
                                        {previewItem.topic}
                                    </h1>
                                    <div className="bg-gradient-to-br from-black/80 to-black/60 p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm w-full">
                                        <p className="font-medium leading-relaxed" style={{ fontSize: `${bodySize}px`, color: '#e2e8f0' }}>
                                            {previewItem.body[0]}
                                        </p>
                                    </div>
                                    {creditFile && (
                                      <p className="text-center text-[10px] opacity-50">+ เครดิตจบ</p>
                                    )}
                                </div>
                            ) : (
                                <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: '#64748b' }}>
                                    {ffmpegLoading ? '⏳ Loading FFMPEG engine...' : '← เลือก Content Stock ก่อน'}
                                </p>
                            )}
                        </div>
                   </div>

                </div>

                {/* Right Settings Sidebar */}
                <div className="w-[320px] pl-5 flex flex-col gap-4 overflow-y-auto pr-1" style={{ borderLeft: '1px solid var(--border-color)' }}>
                     
                     {/* Assets Section */}
                     <div className="p-3 rounded-xl border space-y-3" style={sidebarBox}>
                        <h3 className="font-semibold text-sm flex justify-between items-center" style={labelStyle}>
                            <span>🎬 Assets</span>
                            {ffmpegReady ? <span className="text-[10px] text-green-500">✅ Ready</span> : <span className="text-[10px] text-yellow-500">⏳ Loading...</span>}
                        </h3>
                        
                        {/* Footage */}
                        <div>
                            <label className="text-xs font-medium flex justify-between" style={labelStyle}>
                              📁 Footage พื้นหลัง
                              {footageFiles.length > 0 && <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{footageFiles.length} ไฟล์</span>}
                            </label>
                            <input 
                              type="file" accept="video/mp4" multiple
                              onChange={e => { if(e.target.files) setFootageFiles(Array.from(e.target.files)) }} 
                              className="w-full text-[10px] mt-1 block" 
                            />
                            <p className="text-[9px] mt-0.5" style={labelStyle}>เลือกหลายไฟล์ได้ (จะสุ่มให้แต่ละคลิป)</p>
                        </div>

                        {/* Music */}
                        <div>
                            <label className="text-xs font-medium flex justify-between" style={labelStyle}>
                              🎵 เพลงพื้นหลัง
                              {musicFiles.length > 0 && <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{musicFiles.length} ไฟล์</span>}
                            </label>
                            <input 
                              type="file" accept="audio/*" multiple
                              onChange={e => { if(e.target.files) setMusicFiles(Array.from(e.target.files)) }} 
                              className="w-full text-[10px] mt-1 block" 
                            />
                            {musicFiles.length > 0 && (
                              <select 
                                value={selectedMusicIdx} 
                                onChange={e => setSelectedMusicIdx(Number(e.target.value))}
                                className="w-full mt-1 p-1.5 rounded border text-[11px]"
                                style={inputStyle}
                              >
                                {musicFiles.map((f, i) => (
                                  <option key={i} value={i}>🎵 {f.name}</option>
                                ))}
                              </select>
                            )}
                        </div>

                        {/* End Credit */}
                        <div>
                            <label className="text-xs font-medium" style={labelStyle}>🎬 คลิปเครดิตจบ</label>
                            <input 
                              type="file" accept="video/mp4"
                              onChange={e => { if(e.target.files?.[0]) setCreditFile(e.target.files[0]) }} 
                              className="w-full text-[10px] mt-1 block" 
                            />
                            {creditFile && <p className="text-[9px] mt-0.5" style={{ color: 'var(--accent)' }}>✅ {creditFile.name}</p>}
                        </div>
                     </div>

                     {/* Typography & Layout */}
                     <div className="p-3 rounded-xl border space-y-3" style={sidebarBox}>
                        <h3 className="font-semibold text-sm" style={labelStyle}>✍️ Typography & Layout</h3>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium" style={labelStyle}>ฟอนต์</label>
                            <select 
                                value={fontFamily} 
                                onChange={e => setFontFamily(e.target.value)}
                                className="w-full mt-0.5 p-1.5 rounded border text-[11px]"
                                style={inputStyle}
                            >
                                {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium" style={labelStyle}>⏱️ ความยาว</label>
                            <select 
                                value={duration} 
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full mt-0.5 p-1.5 rounded border text-[11px]"
                                style={inputStyle}
                            >
                                {durations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium flex justify-between" style={labelStyle}>
                                หัวข้อ <span>{titleSize}px</span>
                            </label>
                            <input type="range" min="16" max="48" value={titleSize} onChange={e => setTitleSize(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--accent)' }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium flex justify-between" style={labelStyle}>
                                เนื้อหา <span>{bodySize}px</span>
                            </label>
                            <input type="range" min="10" max="32" value={bodySize} onChange={e => setBodySize(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--accent)' }} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium flex justify-between" style={labelStyle}>
                                ↕ Margin บน <span>{marginTop}px</span>
                            </label>
                            <input type="range" min="0" max="120" value={marginTop} onChange={e => setMarginTop(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--accent)' }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium flex justify-between" style={labelStyle}>
                                ↕ Margin ล่าง <span>{marginBottom}px</span>
                            </label>
                            <input type="range" min="0" max="120" value={marginBottom} onChange={e => setMarginBottom(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--accent)' }} />
                          </div>
                        </div>
                     </div>

                     {/* Render Section */}
                     <div className="mt-auto space-y-2">
                         {/* Selected count */}
                         <div className="text-xs text-center py-1 rounded" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                           {selectedItems.length > 0 
                             ? <span>🎯 เลือก <strong style={{ color: 'var(--accent)' }}>{selectedItems.length}</strong> คลิปพร้อม render</span>
                             : <span>← เลือก content จาก Stock ก่อน</span>
                           }
                         </div>

                         {rendering && (
                            <>
                            <p className="text-xs text-center font-medium" style={{ color: 'var(--accent)' }}>
                              กำลัง render {currentRenderIndex}/{totalRender}...
                            </p>
                            <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                                <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: 'var(--accent)' }}></div>
                            </div>
                            </>
                         )}
                         <p className="text-[10px] line-clamp-1 h-4" style={labelStyle}>{log}</p>

                         <button 
                            disabled={rendering || !ffmpegReady || selectedItems.length === 0}
                            onClick={handleBulkRender}
                            className="w-full py-3 text-white rounded-xl hover:shadow-xl transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: `linear-gradient(135deg, var(--accent), #7c3aed)` }}
                         >
                            {rendering 
                              ? `⏳ กำลัง render ${currentRenderIndex}/${totalRender}...` 
                              : `⚡ Render ${selectedItems.length > 0 ? selectedItems.length + ' คลิป' : 'วิดีโอ'}`
                            }
                         </button>
                     </div>
                </div>
        </div>
    )
}
