import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';

interface SlideViewerModalProps {
  courseTitle: string;
  epTitle: string;
  markdownContent: string;
  onClose: () => void;
}

interface ParsedSlide {
  title: string;
  bullets: string[];
  notes: string;
  layout: 'hero' | 'split-left' | 'split-right' | 'cards' | 'timeline';
  themeColor: string;
}

const THEMES = [
  'from-indigo-500 to-cyan-400',
  'from-purple-500 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-red-500'
];

function parseSlides(markdownText: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  const parts = markdownText.split(/(?=## )/g);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.trim()) continue;
    
    let title = '';
    let notes = '';
    let bullets: string[] = [];

    const lines = part.split('\n');
    if (lines[0].startsWith('## ')) {
       title = lines[0].replace(/##\s*(Slide \d+:?)?/i, '').replace(/\*\*/g, '').trim();
       lines.shift();
    }
    
    let content = lines.join('\n');
    
    const notesRegex = /\*\*(Speaker Notes?|สคริปต์พูด|Note)s?:?\*\*(.*)/is;
    const notesMatch = content.match(notesRegex);
    if (notesMatch) {
       notes = notesMatch[2].trim();
       content = content.replace(notesRegex, '').trim();
    }

    const bulletLines = content.split('\n').filter(l => l.trim().match(/^[*-]\s/) || l.trim().match(/^\d+\.\s/));
    bullets = bulletLines.map(l => l.replace(/^[*-]\s/, '').replace(/^\d+\.\s/, '').trim());
    
    if (bullets.length === 0 && content.trim()) {
      bullets = [content.trim()];
    }

    bullets = bullets.map(b => b.replace(/\*\*(.*?)\*\*/g, '<b class="text-white">$1</b>'));
    bullets = bullets.map(b => b.replace(/^(Title|Subtitle|คำโปรย|หัวข้อ):\s*/i, ''));

    const MAX_BULLETS = 4;
    
    if (bullets.length > MAX_BULLETS) {
      for (let j = 0; j < bullets.length; j += MAX_BULLETS) {
        const chunk = bullets.slice(j, j + MAX_BULLETS);
        const isContinued = j > 0;
        const slideTitle = isContinued ? `${title} (ต่อ)` : title;
        
        let layout: ParsedSlide['layout'] = 'split-left';
        if (chunk.length >= 2 && chunk.length <= 4 && chunk.some(b => b.length < 150)) layout = 'cards';
        else layout = (slides.length % 2 === 0) ? 'split-right' : 'split-left';
        
        slides.push({
           title: slideTitle,
           bullets: chunk,
           notes: isContinued ? '' : notes,
           layout,
           themeColor: THEMES[slides.length % THEMES.length]
        });
      }
    } else {
      let layout: ParsedSlide['layout'] = 'split-left';
      if (i === 0) layout = 'hero'; 
      else if (bullets.length === 0) layout = 'hero';
      else if (bullets.length >= 2 && bullets.length <= 4 && bullets.some(b => b.length < 150)) layout = 'cards';
      else if (bullets.length > 4) layout = 'timeline'; // Won't be reached due to chunking, but kept for logic
      else layout = slides.length % 2 === 0 ? 'split-right' : 'split-left';

      slides.push({
         title,
         bullets,
         notes,
         layout,
         themeColor: THEMES[slides.length % THEMES.length]
      });
    }
  }
  return slides;
}

export function SlideViewerModal({ courseTitle, epTitle, markdownContent, onClose }: SlideViewerModalProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slides = useMemo(() => parseSlides(markdownContent), [markdownContent]);

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      for (let i = 0; i < slides.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: '#0f172a',
          useCORS: true
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Slide-${i + 1}.png`;
        link.href = dataUrl;
        link.click();
        
        setDownloadProgress(Math.round(((i + 1) / slides.length) * 100));
        await new Promise(r => setTimeout(r, 500)); // slight delay to let browser handle downloads
      }
    } catch (err) {
      console.error('Error downloading slides', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดสไลด์');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (slides.length === 0) return null;

  const AbstractIllustration = ({ type, colorClass }: { type: 'left' | 'right' | 'hero', colorClass: string }) => {
    const isLeft = type === 'left';
    return (
      <div className={`relative w-full h-full min-h-[300px] flex items-center justify-center ${isLeft ? 'pr-8' : 'pl-8'}`}>
        <div className="absolute inset-0 bg-gradient-to-br opacity-20 blur-3xl rounded-full" />
        <div className={`relative z-10 w-64 h-64 md:w-80 md:h-80 rounded-[2rem] bg-gradient-to-br ${colorClass} opacity-80 shadow-[0_0_50px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden transform ${isLeft ? '-rotate-3' : 'rotate-3'} hover:rotate-0 transition-transform duration-700 border border-white/20`}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />
          <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <svg className="w-32 h-32 text-white opacity-90 drop-shadow-2xl relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {type === 'left' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            ) : type === 'right' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            )}
          </svg>
        </div>
        <div className={`absolute top-10 ${isLeft ? 'right-10' : 'left-10'} w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 animate-bounce shadow-2xl`} style={{ animationDuration: '3s' }} />
        <div className={`absolute bottom-10 ${isLeft ? 'left-10' : 'right-10'} w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/30 animate-pulse shadow-2xl transform rotate-12`} style={{ animationDuration: '4s' }} />
      </div>
    );
  };

  const renderLayout = (currentSlide: ParsedSlide) => {
    switch (currentSlide.layout) {
      case 'hero':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full px-8 lg:px-12 relative z-10 w-full">
            <div className={`inline-block px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white font-bold tracking-widest text-xs lg:text-sm mb-6 lg:mb-10 shadow-lg backdrop-blur-sm shrink-0`}>
              {courseTitle} — {epTitle}
            </div>
            <h1 className={`text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} mb-6 lg:mb-8 leading-tight drop-shadow-2xl shrink-0 tracking-tight max-w-5xl`}>
              {currentSlide.title || epTitle}
            </h1>
            {currentSlide.bullets.length > 0 && (
              <div className="text-xl lg:text-2xl text-slate-200 max-w-4xl mx-auto opacity-95 leading-relaxed font-light bg-black/20 p-6 lg:p-8 rounded-3xl border border-white/10 backdrop-blur-md" dangerouslySetInnerHTML={{ __html: currentSlide.bullets[0] }} />
            )}
          </div>
        );

      case 'split-left':
        return (
          <div className="flex flex-col md:flex-row h-full items-center gap-8 lg:gap-12 px-8 lg:px-12 relative z-10 w-full">
            <div className="w-full md:w-2/5 h-full flex items-center justify-center shrink-0">
              <AbstractIllustration type="left" colorClass={currentSlide.themeColor} />
            </div>
            <div className="w-full md:w-3/5 h-full flex flex-col justify-center py-6 lg:py-8 min-h-0">
              <h2 className={`text-4xl lg:text-5xl font-black mb-6 lg:mb-8 text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} shrink-0 tracking-tight drop-shadow-lg leading-tight`}>
                {currentSlide.title}
              </h2>
              <ul className="space-y-4 lg:space-y-5 flex-1 flex flex-col justify-center min-h-0">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i} className="flex items-start text-lg lg:text-xl text-slate-200 leading-snug bg-white/5 p-4 lg:p-5 rounded-3xl border border-white/10 shadow-xl backdrop-blur-sm hover:bg-white/10 hover:-translate-y-1 transition-all duration-300">
                    <span className={`flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br ${currentSlide.themeColor} flex items-center justify-center text-white font-bold text-base lg:text-lg mr-4 lg:mr-5 shadow-[0_0_20px_rgba(255,255,255,0.2)]`}>{i+1}</span>
                    <span className="flex-1" dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'split-right':
        return (
          <div className="flex flex-col md:flex-row h-full items-center gap-8 lg:gap-12 px-8 lg:px-12 relative z-10 w-full">
            <div className="w-full md:w-3/5 h-full flex flex-col justify-center py-6 lg:py-8 min-h-0">
              <h2 className={`text-4xl lg:text-5xl font-black mb-6 lg:mb-8 text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} shrink-0 tracking-tight drop-shadow-lg leading-tight`}>
                {currentSlide.title}
              </h2>
              <ul className="space-y-4 lg:space-y-5 flex-1 flex flex-col justify-center min-h-0">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i} className="flex items-start text-lg lg:text-xl text-slate-200 leading-snug bg-white/5 p-4 lg:p-5 rounded-3xl border border-white/10 shadow-xl backdrop-blur-sm hover:bg-white/10 hover:-translate-y-1 transition-all duration-300">
                    <span className={`flex-shrink-0 flex items-center justify-center w-2 h-full mr-4 lg:mr-5 mt-2 lg:mt-3`}>
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${currentSlide.themeColor} shadow-[0_0_15px_rgba(255,255,255,0.5)] ring-4 ring-white/20`}></span>
                    </span>
                    <span className="flex-1" dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-2/5 h-full flex items-center justify-center shrink-0">
              <AbstractIllustration type="right" colorClass={currentSlide.themeColor} />
            </div>
          </div>
        );

      case 'cards':
        return (
          <div className="flex flex-col h-full px-8 lg:px-12 justify-center relative z-10 w-full py-8">
            <h2 className={`text-4xl lg:text-5xl font-black mb-8 lg:mb-10 shrink-0 text-center text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} tracking-tight drop-shadow-lg leading-tight`}>
              {currentSlide.title}
            </h2>
            <div className={`grid gap-4 lg:gap-6 flex-1 min-h-0 w-full items-center ${currentSlide.bullets.length === 2 ? 'grid-cols-2 max-w-4xl mx-auto' : currentSlide.bullets.length === 3 ? 'grid-cols-3 max-w-6xl mx-auto' : 'grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto'}`}>
              {currentSlide.bullets.map((b, i) => (
                <div key={i} className="bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-5 lg:p-6 rounded-[1.5rem] shadow-2xl hover:-translate-y-2 hover:border-white/40 transition-all duration-500 group flex flex-col items-center text-center h-full justify-center min-h-[200px]">
                  <div className={`w-14 h-14 lg:w-16 lg:h-16 shrink-0 rounded-2xl bg-gradient-to-br ${currentSlide.themeColor} flex items-center justify-center text-white text-2xl lg:text-3xl font-black mb-4 lg:mb-5 shadow-[0_0_30px_rgba(255,255,255,0.3)] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 border border-white/20`}>
                    0{i+1}
                  </div>
                  <div className="text-base lg:text-lg text-slate-200 leading-snug font-medium line-clamp-6" dangerouslySetInnerHTML={{ __html: b }} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="flex flex-col h-full px-8 lg:px-12 py-8 lg:py-10 justify-center relative z-10 w-full">
            <h2 className={`text-4xl lg:text-5xl font-black mb-6 lg:mb-8 shrink-0 text-center text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} tracking-tight drop-shadow-lg leading-tight`}>
              {currentSlide.title}
            </h2>
            <div className="relative max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center min-h-0">
              <div className="absolute left-[31px] lg:left-[39px] top-6 bottom-6 w-1 lg:w-1.5 bg-gradient-to-b from-white/20 via-white/10 to-transparent rounded-full hidden sm:block"></div>
              
              <div className="space-y-4 lg:space-y-5 relative w-full flex-1 flex flex-col justify-center min-h-0">
                {currentSlide.bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-5 lg:gap-8 group">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-[1.25rem] lg:rounded-[1.5rem] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 flex-shrink-0 hidden sm:flex items-center justify-center shadow-2xl relative z-10 group-hover:scale-110 transition-all duration-300`}>
                      <span className={`text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br ${currentSlide.themeColor} drop-shadow-md`}>
                        {i+1}
                      </span>
                    </div>
                    <div className="flex-1 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-4 lg:p-6 rounded-3xl shadow-xl text-lg lg:text-xl text-slate-200 group-hover:bg-white/10 group-hover:border-white/30 transition-all duration-300 leading-snug font-medium" dangerouslySetInnerHTML={{ __html: b }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0B0F19] overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <div className="h-20 shrink-0 bg-black/40 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-8 relative z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all text-xl"
          >
            ←
          </button>
          <div className="text-white font-bold text-lg tracking-wide">
            {courseTitle} <span className="text-white/40 mx-2">/</span> {epTitle}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowNotes(!showNotes)}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 ${showNotes ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
          >
            <span>🎙️</span> {showNotes ? 'ซ่อนสคริปต์' : 'เปิดสคริปต์พูด'}
          </button>
          <button 
            onClick={handleDownloadAll}
            disabled={isDownloading}
            className="px-6 py-2 rounded-xl font-bold text-sm transition-all border border-indigo-500/50 bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50"
          >
            {isDownloading ? `⏳ โหลด... ${downloadProgress}%` : '📥 โหลดสไลด์ทั้งหมด (PNG)'}
          </button>
        </div>
      </div>

      {/* Scrolling Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 py-12 scroll-smooth">
        <div className="flex flex-col gap-24 items-center max-w-[1920px] mx-auto pb-24">
          {slides.map((slide, idx) => (
            <div key={idx} className="w-full flex flex-col items-center">
              
              {/* Note Bubble (if enabled) */}
              {showNotes && slide.notes && (
                <div className="w-full max-w-[calc((100vh-200px)*16/9)] mb-6 px-8">
                  <div className="p-6 bg-amber-950/60 backdrop-blur-xl border border-amber-500/40 rounded-3xl shadow-2xl">
                    <h4 className="font-bold text-amber-400 mb-3 flex items-center gap-2 text-xl">
                      <span>🎙️</span> Speaker Notes (สไลด์ {idx+1})
                    </h4>
                    <p className="text-amber-100/90 text-xl leading-relaxed whitespace-pre-wrap">{slide.notes}</p>
                  </div>
                </div>
              )}

              {/* The 16:9 Slide Card */}
              <div 
                ref={(el) => (slideRefs.current[idx] = el)}
                className="aspect-video w-full max-w-[calc((100vh-200px)*16/9)] bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
              >
                {/* Dynamic Background per slide */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  <div className={`absolute -top-[30%] -left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-br ${slide.themeColor} opacity-10 blur-[150px]`} />
                  <div className={`absolute -bottom-[30%] -right-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-tl ${slide.themeColor} opacity-10 blur-[150px]`} />
                  <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
                </div>

                {renderLayout(slide)}
                
                {/* Slide Number */}
                <div className="absolute bottom-8 right-12 text-white/30 font-bold text-xl tracking-widest z-50">
                  {idx + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
