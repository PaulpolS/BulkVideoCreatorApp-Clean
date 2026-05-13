export interface CharacterPromptBlock {
  id: string;
  characterLabel: string;
  sourceText: string;
  prompt: string;
}

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  timecode: string;
  thaiScript: string;
  imagePrompt: string;
  videoMotionPrompt: string;
}

const CHARACTER_SPLIT_PATTERN =
  /\n+|(?:^|\s)(?:ตัวละครที่|character)\s*\d+\s*[:：.-]\s*|[;；]|(?:\s+และ\s+|\s+กับ\s+|\s+and\s+)/gi;

const STORY_BEATS = [
  {
    label: 'Opening hook',
    thai: 'เปิดด้วยเหตุการณ์ชวนสงสัยที่ทำให้คนดูอยากรู้ต่อ',
    start: 'an establishing moment in the key location, the referenced character notices something unusual',
    end: 'the environment reveals the first clue and the mood shifts into curiosity',
    motion: 'slow dolly-in from a medium wide shot, natural ambient movement, gentle parallax, no sudden cuts',
  },
  {
    label: 'Inciting problem',
    thai: 'ปัญหาเล็กๆ เริ่มใหญ่ขึ้น และตัวละครต้องตัดสินใจ',
    start: 'the referenced character reacts to a clear problem in the scene, focused on gesture and blocking',
    end: 'the problem becomes more visible through objects, lighting, or environmental change',
    motion: 'handheld follow shot with soft stabilization, camera tracks the action while keeping physics grounded',
  },
  {
    label: 'First attempt',
    thai: 'ตัวละครลองแก้ปัญหาด้วยวิธีที่ดูง่าย แต่ผลลัพธ์ไม่เป็นอย่างคิด',
    start: 'the referenced character begins a simple action, surrounded by practical props and readable space',
    end: 'the attempted solution fails in a visually clear but gentle way',
    motion: 'side tracking movement, slight push-in at the moment of failure, realistic object motion and timing',
  },
  {
    label: 'Discovery',
    thai: 'มีเบาะแสสำคัญโผล่มา ทำให้เรื่องเปลี่ยนทิศ',
    start: 'a meaningful clue appears in the setting, framed clearly without focusing on physical identity details',
    end: 'the referenced character understands the clue and prepares for a better choice',
    motion: 'rack focus from foreground clue to the referenced character action, calm cinematic timing',
  },
  {
    label: 'Rising action',
    thai: 'จังหวะเร่งขึ้น ตัวละครลงมือทำสิ่งสำคัญเพื่อไปต่อ',
    start: 'the referenced character takes decisive action through the location, movement led by behavior and intent',
    end: 'the environment responds to the action and opens a path forward',
    motion: 'smooth forward tracking shot, controlled acceleration, physically believable momentum',
  },
  {
    label: 'Emotional turn',
    thai: 'ตัวละครหยุดคิด เห็นคุณค่าบางอย่าง และเลือกทำสิ่งที่ถูกต้อง',
    start: 'a quiet pause in the scene, action slows, props and lighting communicate the emotional decision',
    end: 'the referenced character commits to a kind or brave choice through visible action',
    motion: 'locked-off shot with subtle camera drift, soft environmental motion, natural breathing room',
  },
  {
    label: 'Resolution',
    thai: 'ปมคลี่คลายอย่างอบอุ่น เห็นผลลัพธ์ของการตัดสินใจ',
    start: 'the final action resolves the situation in the same story world, no physical character description',
    end: 'a satisfying visual result appears in the environment, leaving a warm closing image',
    motion: 'gentle crane-up or pull-back, stable composition, slow final reveal with grounded physics',
  },
  {
    label: 'Closing beat',
    thai: 'ปิดท้ายด้วยประโยคจำง่ายที่ทำให้เรื่องมีความหมาย',
    start: 'a clean final composition showing the resolved setting and the referenced character action',
    end: 'the scene settles into a memorable ending image with clear visual takeaway',
    motion: 'slow fade-like camera retreat, minimal motion, objects settle naturally, no extra character details',
  },
];

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const titleCaseLabel = (value: string, index: number) => {
  const clean = normalizeText(value);
  if (!clean) return `Character ${index + 1}`;
  return clean.length > 36 ? `Character ${index + 1}` : clean;
};

const splitCharacterInputs = (description: string) => {
  const lines = description
    .split(CHARACTER_SPLIT_PATTERN)
    .map(part => normalizeText(part.replace(/^[-*•\d.)\s]+/, '')))
    .filter(Boolean);

  if (lines.length <= 1) return [normalizeText(description)];
  return lines;
};

export function generateCharacterReferencePrompts(description: string): CharacterPromptBlock[] {
  const trimmed = normalizeText(description);
  if (!trimmed) return [];

  return splitCharacterInputs(trimmed).map((character, index) => {
    const label = titleCaseLabel(character, index);
    const prompt = [
      `Create a professional character reference sheet of ${character}.`,
      'The sheet uses a clean, neutral plain grey background with subtle grid lines and is presented as a high-fidelity 3D technical model turnaround.',
      'Strictly isolate this single character only; do not blend traits, outfits, silhouettes, props, colors, or personality cues from any other character.',
      'Top row: four full-body orthographic views arranged left to right: front view, three-quarter view, side view, and back view, consistent proportions across every view.',
      'Bottom row: three portrait studies: neutral expression, expressive hero expression, and close-up detail portrait for face readability.',
      'Use consistent studio lighting, realistic material definition, production-ready surface details, crisp silhouette readability, accurate scale, and clean spacing.',
      'No scene background, no extra characters, no typography labels, no watermark, no cinematic camera angle, no action pose.',
    ].join(' ');

    return {
      id: `character-${index + 1}`,
      characterLabel: label,
      sourceText: character,
      prompt,
    };
  });
}

const safeStoryConcept = (context: string) => {
  const clean = normalizeText(context);
  if (!clean) return 'a short Thai fable with a clear emotional lesson';
  return clean.length > 180 ? `${clean.slice(0, 180).trim()}...` : clean;
};

const buildThaiLine = (context: string, sceneNumber: number, totalScenes: number) => {
  const concept = safeStoryConcept(context);
  const beat = STORY_BEATS[(sceneNumber - 1) % STORY_BEATS.length];
  const ending = sceneNumber === totalScenes ? 'จำไว้นะ บางครั้งความกล้าก็เริ่มจากใจเล็กๆ' : 'แล้วเรื่องก็เปลี่ยนไปในวินาทีนั้น';
  return `ฉากที่ ${sceneNumber}: ${beat.thai} "${ending}"`;
};

export function buildStoryboardScenes(context: string, sceneCount: number): StoryboardScene[] {
  const totalScenes = Math.min(Math.max(Math.round(sceneCount || 1), 1), 24);
  const concept = safeStoryConcept(context);

  return Array.from({ length: totalScenes }, (_, index) => {
    const sceneNumber = index + 1;
    const beat = STORY_BEATS[index % STORY_BEATS.length];
    const startSecond = index * 8;
    const endSecond = startSecond + 8;
    const continuity = `Story concept for context only: "${concept}". Use the uploaded character reference image for all identity details.`;
    const exclusion =
      'Exclude physical character descriptions completely: no clothes, hair, face, body shape, species, age, colors, or anatomy. Focus only on behavior, location, props, action, atmosphere, framing, and camera.';

    return {
      id: `scene-${sceneNumber}`,
      sceneNumber,
      timecode: `${startSecond}-${endSecond}s`,
      thaiScript: buildThaiLine(context, sceneNumber, totalScenes),
      imagePrompt: [
        `Scene ${sceneNumber} image prompt for an 8-second image-to-video shot.`,
        continuity,
        exclusion,
        `Visual beat: ${beat.start}; the shot should clearly imply this result by the end of the motion: ${beat.end}.`,
        'High-fidelity image-to-video source image, clean cinematic composition, readable action, stable continuity, no text on screen.',
      ].join(' '),
      videoMotionPrompt: [
        `8-second image-to-video motion for Scene ${sceneNumber}: ${beat.motion}.`,
        'Preserve character identity from the uploaded reference image only.',
        'Do not add or invent physical character traits; animate behavior, timing, camera motion, environmental physics, and prop interaction.',
      ].join(' '),
    };
  });
}

export function buildStoryboardExportText(scenes: StoryboardScene[]) {
  return scenes
    .map(scene => [
      `Scene ${scene.sceneNumber} (${scene.timecode})`,
      `Thai Script/Dialogue: ${scene.thaiScript}`,
      `Image Prompt: ${scene.imagePrompt}`,
      `Video Motion Prompt: ${scene.videoMotionPrompt}`,
    ].join('\n'))
    .join('\n\n---\n\n');
}
