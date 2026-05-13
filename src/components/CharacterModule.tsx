import React, { useMemo, useState } from 'react';
import { Check, Clipboard, Copy, Sparkles, UserRound, Wand2 } from 'lucide-react';
import { CharacterPromptBlock, generateCharacterReferencePrompts } from '../lib/prompt-engine';

const DEFAULT_CHARACTER = 'เป็ดใส่เสื้อฮู้ดสีเทา';

interface CopyButtonProps {
  text: string;
  label?: string;
}

function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="sa-copy-button disabled:cursor-not-allowed disabled:opacity-50"
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function PromptCard({ block }: { block: CharacterPromptBlock }) {
  return (
    <article className="sa-panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
            <UserRound className="h-4 w-4" />
            Character Reference
          </div>
          <h3 className="sa-title mt-1 text-lg font-bold">{block.characterLabel}</h3>
          <p className="sa-muted mt-1 text-sm">{block.sourceText}</p>
        </div>
        <CopyButton text={block.prompt} label="Copy Prompt" />
      </div>
      <div className="sa-output p-4">
        <p className="whitespace-pre-wrap text-sm leading-7">{block.prompt}</p>
      </div>
    </article>
  );
}

export function CharacterModule() {
  const [description, setDescription] = useState(DEFAULT_CHARACTER);
  const [hasGenerated, setHasGenerated] = useState(false);

  const promptBlocks = useMemo(
    () => (hasGenerated ? generateCharacterReferencePrompts(description) : []),
    [description, hasGenerated],
  );

  const allPrompts = promptBlocks.map(block => block.prompt).join('\n\n---\n\n');

  const handleGenerate = () => {
    setHasGenerated(true);
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
      <div className="sa-panel p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="sa-title text-xl font-bold">Character Reference Creator</h2>
            <p className="sa-muted text-sm">Step 1: สร้าง prompt สำหรับ reference sheet</p>
          </div>
        </div>

        <label className="sa-label mt-6 block text-sm font-bold" htmlFor="character-description">
          Describe your character
        </label>
        <textarea
          id="character-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="sa-input mt-2 min-h-[180px] w-full resize-y p-4 text-sm leading-6"
          placeholder="เช่น เป็ดใส่เสื้อฮู้ดสีเทา หรือใส่หลายตัวละครแยกบรรทัด"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
          <button
            type="button"
            onClick={handleGenerate}
            className="sa-primary-button"
          >
            <Sparkles className="h-4 w-4" />
            Generate Ref Sheet Prompt
          </button>
          <CopyButton text={allPrompts} label="Copy All" />
        </div>

        <div className="sa-note mt-5 p-4 text-sm leading-6">
          แยกตัวละครด้วยบรรทัดใหม่, semicolon, “และ”, “กับ” หรือ “and” เพื่อสร้าง prompt แยกชุด ลดการปนลักษณะตัวละครในภาพเดียวกัน
        </div>
      </div>

      <div className="sa-workspace min-h-[360px] p-4">
        {promptBlocks.length > 0 ? (
          <div className="space-y-4">
            {promptBlocks.map(block => <PromptCard key={block.id} block={block} />)}
          </div>
        ) : (
          <div className="sa-empty flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <Clipboard className="h-10 w-10 opacity-50" />
            <h3 className="sa-title mt-3 text-lg font-bold">Prompt output will appear here</h3>
            <p className="sa-muted mt-1 max-w-md text-sm leading-6">
              ใส่รายละเอียดตัวละคร แล้วกด Generate เพื่อสร้าง professional 3D technical model turnaround prompt
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
