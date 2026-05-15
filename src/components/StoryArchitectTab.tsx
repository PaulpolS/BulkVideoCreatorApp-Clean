import React, { useState } from 'react';
import { BookOpen, Clapperboard, Images, PenTool, Sparkles } from 'lucide-react';
import { CharacterModule } from './CharacterModule';
import { MagicalPetPlayModule } from './MagicalPetPlayModule';
import { StoryboardModule } from './StoryboardModule';

type StoryArchitectView = 'character' | 'storyboard' | 'refStoryboard' | 'magicPet';

const VIEWS: {
  id: StoryArchitectView;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'character',
    label: 'Character Reference',
    description: 'Step 1',
    icon: <PenTool className="h-4 w-4" />,
  },
  {
    id: 'storyboard',
    label: 'Storyboard Generator',
    description: 'Step 2',
    icon: <Clapperboard className="h-4 w-4" />,
  },
  {
    id: 'refStoryboard',
    label: 'REF Storyboard',
    description: 'Step 2 Pro',
    icon: <Images className="h-4 w-4" />,
  },
  {
    id: 'magicPet',
    label: 'Magical Pet POV',
    description: 'Play Clips',
    icon: <Sparkles className="h-4 w-4" />,
  },
];

export function StoryArchitectTab() {
  const [activeView, setActiveView] = useState<StoryArchitectView>('character');

  return (
    <div className="story-architect min-h-full px-4 py-5 font-kanit sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="sa-panel p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="sa-kicker">
                <Sparkles className="h-4 w-4" />
                AI Video Storyboard Architect
              </div>
              <h1 className="sa-title mt-3 text-2xl font-black sm:text-3xl">
                Character Reference & Storyboard Prompt Suite
              </h1>
              <p className="sa-muted mt-2 max-w-3xl text-sm leading-6">
                เครื่องมือสร้าง prompt สำหรับงาน Image-to-Video: เริ่มจาก reference sheet ที่คุมตัวละครให้ชัด แล้วต่อด้วย scene cards แบบ 8 วินาทีต่อฉาก
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {VIEWS.map(view => {
                const active = activeView === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveView(view.id)}
                    className={`sa-tab ${active ? 'sa-tab-active' : ''}`}
                  >
                    <span className="sa-tab-icon">
                      {view.icon}
                    </span>
                    <span>
                      <span className="sa-muted block text-xs font-bold uppercase tracking-wide">{view.description}</span>
                      <span className="block text-sm font-bold">{view.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="sa-panel p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="sa-title text-sm font-bold">Workflow</h2>
                <p className="sa-muted text-xs">Reference first, storyboard second</p>
              </div>
            </div>
          </div>
          <div className="sa-panel p-4">
            <h2 className="sa-title text-sm font-bold">Scene Timing</h2>
            <p className="sa-muted mt-1 text-xs leading-5">ทุก scene ถูกออกแบบเป็น 8 วินาที: 1 image prompt สำหรับรูปตั้งต้น และ 1 video prompt สำหรับขยับรูปนั้น</p>
          </div>
          <div className="sa-panel p-4">
            <h2 className="sa-title text-sm font-bold">Character Safety</h2>
            <p className="sa-muted mt-1 text-xs leading-5">แท็บ REF Storyboard แยก Character REF หลักออกจาก Shot/Style REF ส่วน Magical Pet POV ทำช็อตเล่นกับสัตว์วิเศษจากมือถือ</p>
          </div>
        </section>

        {activeView === 'character'
          ? <CharacterModule />
          : activeView === 'magicPet'
            ? <MagicalPetPlayModule />
          : activeView === 'refStoryboard'
            ? <StoryboardModule splitReferenceMode />
            : <StoryboardModule />}
      </div>
    </div>
  );
}
