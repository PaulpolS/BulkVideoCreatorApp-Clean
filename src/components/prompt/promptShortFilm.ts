export interface StoryArc {
  id: string;
  name: string;
  description: string;
  scenes: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
}

export const SHORT_FILM_ARCS: StoryArc[] = [
  {
    id: 'arc_1',
    name: "1. การติดเชื้อปริศนาแพร่กระจาย (Story Arc 1)",
    description: "A cohesive 5-scene sequence featuring การติดเชื้อปริศนาแพร่กระจาย with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_2',
    name: "2. กล่องปริศนาซ่อนอสูร (Story Arc 2)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_3',
    name: "3. สุสานโบราณถูกปลุก (Story Arc 3)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_4',
    name: "4. ประตูทะลุมิติทำงาน (Story Arc 4)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_5',
    name: "5. ตำนานป่าลึกลับ (Story Arc 5)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_6',
    name: "6. สุสานโบราณถูกปลุก (Story Arc 6)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_7',
    name: "7. ความผิดปกติใต้มหาสมุทร (Story Arc 7)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_8',
    name: "8. อสูรยักษ์บุกเมือง (Story Arc 8)",
    description: "A cohesive 5-scene sequence featuring อสูรยักษ์บุกเมือง with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_9',
    name: "9. ตำนานป่าลึกลับ (Story Arc 9)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_10',
    name: "10. กล่องปริศนาซ่อนอสูร (Story Arc 10)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "[SUBJECT] pauses time temporarily, then [REACTION], bending the space around itself.",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_11',
    name: "11. ประตูทะลุมิติทำงาน (Story Arc 11)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_12',
    name: "12. ตำนานป่าลึกลับ (Story Arc 12)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_13',
    name: "13. สัญญาณคุมคามจากท้องฟ้า (Story Arc 13)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_14',
    name: "14. ตำนานป่าลึกลับ (Story Arc 14)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_15',
    name: "15. สัตว์เลี้ยงจากต่างดาว (Story Arc 15)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_16',
    name: "16. ตำนานป่าลึกลับ (Story Arc 16)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_17',
    name: "17. สัตว์เลี้ยงจากต่างดาว (Story Arc 17)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_18',
    name: "18. ความผิดปกติใต้มหาสมุทร (Story Arc 18)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_19',
    name: "19. การไล่ล่าในตรอกมืด (Story Arc 19)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_20',
    name: "20. สัญญาณคุมคามจากท้องฟ้า (Story Arc 20)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_21',
    name: "21. สัตว์เลี้ยงจากต่างดาว (Story Arc 21)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_22',
    name: "22. อสูรยักษ์บุกเมือง (Story Arc 22)",
    description: "A cohesive 5-scene sequence featuring อสูรยักษ์บุกเมือง with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_23',
    name: "23. อสูรยักษ์บุกเมือง (Story Arc 23)",
    description: "A cohesive 5-scene sequence featuring อสูรยักษ์บุกเมือง with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_24',
    name: "24. กล่องปริศนาซ่อนอสูร (Story Arc 24)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_25',
    name: "25. สัญญาณคุมคามจากท้องฟ้า (Story Arc 25)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "[SUBJECT] pauses time temporarily, then [REACTION], bending the space around itself.",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_26',
    name: "26. สุสานโบราณถูกปลุก (Story Arc 26)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_27',
    name: "27. แขกไม่ได้รับเชิญในบ้าน (Story Arc 27)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_28',
    name: "28. สัญญาณคุมคามจากท้องฟ้า (Story Arc 28)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_29',
    name: "29. การไล่ล่าในตรอกมืด (Story Arc 29)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_30',
    name: "30. หลุดจากการทดลอง (Story Arc 30)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_31',
    name: "31. ความผิดปกติใต้มหาสมุทร (Story Arc 31)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_32',
    name: "32. แขกไม่ได้รับเชิญในบ้าน (Story Arc 32)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_33',
    name: "33. ตำนานป่าลึกลับ (Story Arc 33)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_34',
    name: "34. แขกไม่ได้รับเชิญในบ้าน (Story Arc 34)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_35',
    name: "35. กล่องปริศนาซ่อนอสูร (Story Arc 35)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_36',
    name: "36. สุสานโบราณถูกปลุก (Story Arc 36)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_37',
    name: "37. ตำนานป่าลึกลับ (Story Arc 37)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_38',
    name: "38. ซากวิหารสาบสูญ (Story Arc 38)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_39',
    name: "39. ความผิดปกติใต้มหาสมุทร (Story Arc 39)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_40',
    name: "40. กล่องปริศนาซ่อนอสูร (Story Arc 40)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_41',
    name: "41. ซากวิหารสาบสูญ (Story Arc 41)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_42',
    name: "42. ความผิดปกติใต้มหาสมุทร (Story Arc 42)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_43',
    name: "43. ความผิดปกติใต้มหาสมุทร (Story Arc 43)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_44',
    name: "44. สัตว์เลี้ยงจากต่างดาว (Story Arc 44)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_45',
    name: "45. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 45)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_46',
    name: "46. สัตว์เลี้ยงจากต่างดาว (Story Arc 46)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_47',
    name: "47. ประตูทะลุมิติทำงาน (Story Arc 47)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_48',
    name: "48. การไล่ล่าในตรอกมืด (Story Arc 48)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "[SUBJECT] pauses time temporarily, then [REACTION], bending the space around itself.",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_49',
    name: "49. หลุดจากการทดลอง (Story Arc 49)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_50',
    name: "50. แขกไม่ได้รับเชิญในบ้าน (Story Arc 50)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_51',
    name: "51. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 51)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "CCTV footage or bodycam POV walking through a destroyed [SETTING]. [PROTAGONIST] cautiously inspects [PROP].",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "[SUBJECT] pauses time temporarily, then [REACTION], bending the space around itself.",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_52',
    name: "52. สุสานโบราณถูกปลุก (Story Arc 52)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_53',
    name: "53. สุสานโบราณถูกปลุก (Story Arc 53)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_54',
    name: "54. ตำนานป่าลึกลับ (Story Arc 54)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_55',
    name: "55. หลุดจากการทดลอง (Story Arc 55)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "Fighter jets fly past the camera. A colossal [SUBJECT] [REACTION] in glorious cinematic grandeur.",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_56',
    name: "56. ซากวิหารสาบสูญ (Story Arc 56)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_57',
    name: "57. กล่องปริศนาซ่อนอสูร (Story Arc 57)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_58',
    name: "58. ความผิดปกติใต้มหาสมุทร (Story Arc 58)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_59',
    name: "59. สุสานโบราณถูกปลุก (Story Arc 59)",
    description: "A cohesive 5-scene sequence featuring สุสานโบราณถูกปลุก with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_60',
    name: "60. อสูรยักษ์บุกเมือง (Story Arc 60)",
    description: "A cohesive 5-scene sequence featuring อสูรยักษ์บุกเมือง with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_61',
    name: "61. ซากวิหารสาบสูญ (Story Arc 61)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_62',
    name: "62. การไล่ล่าในตรอกมืด (Story Arc 62)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_63',
    name: "63. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 63)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_64',
    name: "64. สัตว์เลี้ยงจากต่างดาว (Story Arc 64)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_65',
    name: "65. ซากวิหารสาบสูญ (Story Arc 65)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_66',
    name: "66. ซากวิหารสาบสูญ (Story Arc 66)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_67',
    name: "67. การติดเชื้อปริศนาแพร่กระจาย (Story Arc 67)",
    description: "A cohesive 5-scene sequence featuring การติดเชื้อปริศนาแพร่กระจาย with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_68',
    name: "68. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 68)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_69',
    name: "69. สัญญาณคุมคามจากท้องฟ้า (Story Arc 69)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_70',
    name: "70. ความผิดปกติใต้มหาสมุทร (Story Arc 70)",
    description: "A cohesive 5-scene sequence featuring ความผิดปกติใต้มหาสมุทร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_71',
    name: "71. ประตูทะลุมิติทำงาน (Story Arc 71)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_72',
    name: "72. สถานีอวกาศร้าง (Story Arc 72)",
    description: "A cohesive 5-scene sequence featuring สถานีอวกาศร้าง with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_73',
    name: "73. แขกไม่ได้รับเชิญในบ้าน (Story Arc 73)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_74',
    name: "74. สัญญาณคุมคามจากท้องฟ้า (Story Arc 74)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_75',
    name: "75. ประตูทะลุมิติทำงาน (Story Arc 75)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_76',
    name: "76. ตำนานป่าลึกลับ (Story Arc 76)",
    description: "A cohesive 5-scene sequence featuring ตำนานป่าลึกลับ with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_77',
    name: "77. การไล่ล่าในตรอกมืด (Story Arc 77)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_78',
    name: "78. แขกไม่ได้รับเชิญในบ้าน (Story Arc 78)",
    description: "A cohesive 5-scene sequence featuring แขกไม่ได้รับเชิญในบ้าน with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_79',
    name: "79. การไล่ล่าในตรอกมืด (Story Arc 79)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_80',
    name: "80. กล่องปริศนาซ่อนอสูร (Story Arc 80)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] slowly approaches the dropped [PROP] on the floor, inspecting it curiously. The camera runs entirely out of power, fading to black."
    }
  },
  {
    id: 'arc_81',
    name: "81. สัญญาณคุมคามจากท้องฟ้า (Story Arc 81)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] suddenly charges forward with terrifying momentum and [ACTION].",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] seamlessly leaves the frame, destroying a small piece of the environment realistically as it escapes. Cinematic ending."
    }
  },
  {
    id: 'arc_82',
    name: "82. การติดเชื้อปริศนาแพร่กระจาย (Story Arc 82)",
    description: "A cohesive 5-scene sequence featuring การติดเชื้อปริศนาแพร่กระจาย with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_83',
    name: "83. สัญญาณคุมคามจากท้องฟ้า (Story Arc 83)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "[SUBJECT] pauses time temporarily, then [REACTION], bending the space around itself.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_84',
    name: "84. สัญญาณคุมคามจากท้องฟ้า (Story Arc 84)",
    description: "A cohesive 5-scene sequence featuring สัญญาณคุมคามจากท้องฟ้า with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_85',
    name: "85. กล่องปริศนาซ่อนอสูร (Story Arc 85)",
    description: "A cohesive 5-scene sequence featuring กล่องปริศนาซ่อนอสูร with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] slowly opening [PROP] in the middle of [SETTING].",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "[SUBJECT] stares directly into the lens and violently [ACTION], shaking the physical environment.",
      4: "[PROTAGONIST] drops the flashlight slightly. [SUBJECT] [REACTION] in ultra slow-motion 120fps.",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_86',
    name: "86. ประตูทะลุมิติทำงาน (Story Arc 86)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "Low angle tracking shot. A menacing [SUBJECT] drops from the ceiling holding [PROP] and lands heavily on its feet.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_87',
    name: "87. ซากวิหารสาบสูญ (Story Arc 87)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "A cute, aesthetic vlog-style POV in [SETTING]. [PROTAGONIST] points excitedly at something shuffling on the ground.",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] slowly walks backwards into the deep fog/shadows, vanishing without breaking realistic rendering laws. The recording cuts out."
    }
  },
  {
    id: 'arc_88',
    name: "88. ซากวิหารสาบสูญ (Story Arc 88)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Fast-paced tracking shot following [PROTAGONIST] walking cautiously down a narrow corridor in [SETTING], searching for [PROP].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_89',
    name: "89. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 89)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "[SUBJECT] completely ignores the camera. Instead, it [ACTION].",
      4: "[SUBJECT] suddenly looks at the camera. [REACTION]. The environment physics deploy seamlessly.",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'arc_90',
    name: "90. สัตว์เลี้ยงจากต่างดาว (Story Arc 90)",
    description: "A cohesive 5-scene sequence featuring สัตว์เลี้ยงจากต่างดาว with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "The camera pans down to find a confused [SUBJECT] examining [PROP], wet and shaking aggressively.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] curls up next to [PROTAGONIST], resting organically. Warm, beautiful, and hyper-realistic emotional closing shot."
    }
  },
  {
    id: 'arc_91',
    name: "91. ซากวิหารสาบสูญ (Story Arc 91)",
    description: "A cohesive 5-scene sequence featuring ซากวิหารสาบสูญ with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "The camera attempts to focus over the shoulder of [PROTAGONIST]. We clearly see a [SUBJECT] standing organically among the environment.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "A sudden burst of static glitches the camera momentarily. When it clears, [SUBJECT] [REACTION].",
      5: "[SUBJECT] stands entirely still, blending into the environment perfectly until it becomes indistinguishable from the background."
    }
  },
  {
    id: 'arc_92',
    name: "92. การติดเชื้อปริศนาแพร่กระจาย (Story Arc 92)",
    description: "A cohesive 5-scene sequence featuring การติดเชื้อปริศนาแพร่กระจาย with continuity locking.",
    scenes: {
      1: "Helicopter/Drone aerial wide shot over [SETTING]. In the foreground, [PROTAGONIST] is running away in terror as the ground shakes.",
      2: "[SUBJECT] steps out of the shadows, revealing its intricate texture and breathtakingly realistic physical form.",
      3: "[SUBJECT] executes a perfect maneuver and [ACTION], looking incredibly lifelike.",
      4: "[PROTAGONIST] screams in terror. [SUBJECT] [REACTION] immediately in response.",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_93',
    name: "93. การไล่ล่าในตรอกมืด (Story Arc 93)",
    description: "A cohesive 5-scene sequence featuring การไล่ล่าในตรอกมืด with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_94',
    name: "94. อสูรยักษ์บุกเมือง (Story Arc 94)",
    description: "A cohesive 5-scene sequence featuring อสูรยักษ์บุกเมือง with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] jumps out of [PROP] onto the floor. It [ACTION] with flawless biomechanics.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] elegantly takes flight or leaps out of view, the camera struggling to track its immense speed. End."
    }
  },
  {
    id: 'arc_95',
    name: "95. หลุดจากการทดลอง (Story Arc 95)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "Super wide cinematic establishing shot of [SETTING]. [PROTAGONIST] is seen walking slowly towards [PROP].",
      2: "A colossal, imposing [SUBJECT] slowly rises from the background, displacing massive amounts of dust and debris.",
      3: "[SUBJECT] interacts with the surrounding objects and [ACTION], demonstrating perfect collision physics.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_96',
    name: "96. หลุดจากการทดลอง (Story Arc 96)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "Macro lens tracking shot of a tiny, adorable [SUBJECT] exploring its surroundings fluidly near [PROTAGONIST].",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "An alarm blares loudly overhead. [SUBJECT] [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_97',
    name: "97. หลุดจากการทดลอง (Story Arc 97)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "Video starts with an extreme close-up of [PROTAGONIST]\'s terrified eye reflecting a bright light in [SETTING].",
      2: "Over-the-shoulder POV of [PROTAGONIST]. A horrific [SUBJECT] emerges from the absolute darkness.",
      3: "[SUBJECT] turns to the light and [ACTION] showcasing extreme visual weight and physical presence. [PROTAGONIST] watches in fear.",
      4: "Suddenly, a loud noise off-screen triggers a response. [SUBJECT] [REACTION].",
      5: "[SUBJECT] grabs [PROP] and implodes into pure light, leaving only scorch marks on the ground."
    }
  },
  {
    id: 'arc_98',
    name: "98. พิธีกรรมโบราณอัญเชิญมาร (Story Arc 98)",
    description: "A cohesive 5-scene sequence featuring พิธีกรรมโบราณอัญเชิญมาร with continuity locking.",
    scenes: {
      1: "Dashcam footage driving slowly through [SETTING]. [PROTAGONIST] hits the brakes as something blocks the road ahead.",
      2: "A slow zoom-in on [SUBJECT] interacting with [PROP]. The rendering showcases profound subsurface scattering and physical weight.",
      3: "[SUBJECT] drops [PROP], takes its first few steps into the open and [ACTION].",
      4: "After interacting, [SUBJECT] is delighted and [REACTION].",
      5: "[SUBJECT] attacks the cameraman. The camera flies into the air, landing face-down. Total darkness."
    }
  },
  {
    id: 'arc_99',
    name: "99. ประตูทะลุมิติทำงาน (Story Arc 99)",
    description: "A cohesive 5-scene sequence featuring ประตูทะลุมิติทำงาน with continuity locking.",
    scenes: {
      1: "Nervous, shaky handheld smartphone POV running heavily through [SETTING]. [PROTAGONIST] stops abruptly as a silhouette is seen ahead.",
      2: "First-person POV from [PROTAGONIST] looking inside [PROP]. A hyper-realistic, highly detailed [SUBJECT] is curled up inside, perfectly shadowed.",
      3: "A towering [SUBJECT] dominates the skyline and [ACTION] causing realistic collateral shockwaves.",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "[SUBJECT] rapidly scales a vertical wall or bursts through a reinforced door, completely disappearing into the chaotic facility."
    }
  },
  {
    id: 'arc_100',
    name: "100. หลุดจากการทดลอง (Story Arc 100)",
    description: "A cohesive 5-scene sequence featuring หลุดจากการทดลอง with continuity locking.",
    scenes: {
      1: "Video starts with an intense 3-second hook: [PROTAGONIST] holding a flashlight, turning a corner into [SETTING] while trembling.",
      2: "The flashlight beam fully illuminates a [SUBJECT] actively holding [PROP] on the floor. Stunning lighting and macro details.",
      3: "The hand of [PROTAGONIST] reaches out. [SUBJECT] approaches cautiously and [ACTION].",
      4: "The lighting suddenly shifts to a harsh crimson tone. [SUBJECT] [REACTION].",
      5: "A colossal [SUBJECT] turns and slowly wades away into the hazy distance, its immense scale causing majestic slow-motion destruction."
    }
  },
  {
    id: 'master_arc_6',
    name: "6. Deep Space Station Horror",
    description: "เอเลี่ยนบุกสถานีอวกาศ ไซไฟระทึกขวัญในสภาพไร้แรงโน้มถ่วง",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Deep within the [SETTING], the [PROTAGONIST] breathes heavily, floating in zero gravity. The emergency red lights flash rhythmically. A glowing [PROP] slowly drifts past them.",
      2: "[CAMERA]. Suddenly, an unnatural metallic screech echoes through the hull. A grotesque [SUBJECT] violently bursts through the airlock door! [ACTION]. The [PROTAGONIST] scrambles, pushing off the wall in absolute zero-G panic.",
      3: "[CAMERA]. [AESTHETICS]. The [SUBJECT] pursues relentlessly, its horrifying mass contorting to fit through the narrow futuristic corridors. The [PROTAGONIST] [ACTION], helplessly sliding through the floating debris.",
      4: "[CAMERA]. Cornered at a blast door! The [PROTAGONIST] frantically uses the [PROP] to short-circuit the lock. [REACTION]. Sparks shower brilliantly across the oppressive darkness.",
      5: "[CAMERA]. The [SUBJECT] lunges with lethal precision. The blast door slams shut just fast enough, severing a terrifying biological appendage. [PROTAGONIST] collapses, gasping for air.",
      6: "[CAMERA]. [AESTHETICS]. The relief is temporary. The heavy metallic door violently bulges inward under the unimaginable physical strength of the [SUBJECT]. Structural integrity fails in slow motion.",
      7: "[CAMERA]. Explosive decompression! The room tears open into the vacuum of space. The [PROTAGONIST] grabs onto a railing, while the [SUBJECT] [REACTION], getting sucked towards the darkness.",
      8: "[CAMERA]. [AESTHETICS]. Flailing wildly, the [SUBJECT] anchors itself using massive claws, refusing to be expelled. It slowly pulls itself back towards the terrified [PROTAGONIST].",
      9: "[CAMERA]. In a daring move, [PROTAGONIST] throws the [PROP] directly into the [SUBJECT]'s gaping maw and activates the manual airlock override. [ACTION].",
      10: "[CAMERA]. [AESTHETICS]. Total vacuum. The [SUBJECT] is violently blown out into the infinite black abyss of space. The emergency forcefield engages. Pure silence returns. Cinematic fade to black."
    }
  },
  {
    id: 'master_arc_7',
    name: "7. Underwater Abyss Facility",
    description: "สถานีวิจัยลึกใต้มหาสมุทร กับอสูรกายน้ำลึกและความกดดันทะลุขีดจำกัด",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Miles below the ocean surface in the [SETTING], immense water pressure groans against the glass. The [PROTAGONIST] stares out into the pitch-black water, holding a [PROP].",
      2: "[CAMERA]. A massive shadow eclipses the exterior floodlights. The horrifying [SUBJECT] swims into view, its bioluminescent eyes locking onto the [PROTAGONIST]. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [SUBJECT] rams the reinforced glass with unbelievable force! The glass cracks. High-pressure water jets erupt into the room. The [PROTAGONIST] [REACTION].",
      4: "[CAMERA]. Frantic escape through flooding corridors! The icy water rises rapidly. The [PROTAGONIST] wades through the rising tide, looking back as the [SUBJECT] floods into the facility.",
      5: "[CAMERA]. [AESTHETICS]. Underwater pursuit. The [PROTAGONIST] swims desperately through submerged compartments. The [SUBJECT] glides effortlessly behind them, twisting like an aquatic nightmare.",
      6: "[CAMERA]. The [PROTAGONIST] ducks into an airtight maintenance shaft, sealing the hatch above. They gasp for air in the confined space, clutching the [PROP]. [REACTION].",
      7: "[CAMERA]. [AESTHETICS]. Absolute darkness inside the shaft. Suddenly, the metal walls begin to cave in as the [SUBJECT] wraps its colossal form around the exterior of the pipe.",
      8: "[CAMERA]. The [PROTAGONIST] activates the [PROP], sending a high-frequency acoustic shockwave echoing through the metal. The [SUBJECT] shrieks, releasing its grip in agonizing pain.",
      9: "[CAMERA]. [AESTHETICS]. The shaft plummets, breaking off from the main facility! The [PROTAGONIST] experiences intense zero-G free-fall as they sink deeper into the trench.",
      10: "[CAMERA]. The escape pod forcefully ejects and rocket-propels towards the surface, leaving the terrifying [SUBJECT] fading into the dark abyss. Epic upward trajectory shot."
    }
  },
  {
    id: 'master_arc_8',
    name: "8. Neon City Purge Survival",
    description: "การเอาชีวิตรอดในคืนล่าล้างประชากร กลางเมืองนีออนสายฝน",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. A rain-slicked, neon-lit [SETTING]. Sirens wail in the chaotic background. The [PROTAGONIST] hides behind a burning vehicle, firmly grasping a makeshift [PROP].",
      2: "[CAMERA]. From the shadows, a heavily armed and terrifying [SUBJECT] slowly emerges, dragging a bladed weapon that sparks against the concrete. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] bolts across the open intersection! The [SUBJECT] notices immediately and gives chase with terrifying, unrelenting mechanical speed. [REACTION].",
      4: "[CAMERA]. Brutal urban parkour! The [PROTAGONIST] vaults over chain-link fences and slides across rainy rooftops, while the [SUBJECT] smashes straight through the obstacles.",
      5: "[CAMERA]. [AESTHETICS]. Cornered in a dead-end alleyways. The [SUBJECT] raises its weapon for a lethal strike. The [PROTAGONIST] frantically uses the [PROP] to blind the attacker.",
      6: "[CAMERA]. A massive explosion rips through the adjacent building! Debris rains down in slow motion. The chaotic blast separates the [PROTAGONIST] from the [SUBJECT].",
      7: "[CAMERA]. [AESTHETICS]. Disoriented and bleeding, the [PROTAGONIST] crawls through the rubble. The [SUBJECT] marches through the flames completely unfazed, its silhouette terrifyingly stark.",
      8: "[CAMERA]. Desperate final stand. The [PROTAGONIST] triggers an environmental hazard, dropping a high-voltage neon sign directly onto the [SUBJECT]'s path. Epic electrical discharge! [ACTION].",
      9: "[CAMERA]. [AESTHETICS]. The [SUBJECT] convulses in a spectacular shower of violently bright sparks, finally collapsing. The [PROTAGONIST] limps away into the rainy night.",
      10: "[CAMERA]. High altitude wide sweep showing the entire burning city skyline. The sirens continue to wail. Cinematic title drop."
    }
  },
  {
    id: 'master_arc_9',
    name: "9. Demonic Possession Ritual",
    description: "พิธีกรรมไล่ผีสุดคลั่ง การต่อสู้ทางจิตวิญญาณสยองขวัญ",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Inside a decaying, candle-lit [SETTING]. A terrifying supernatural ritual has gone wrong. The [PROTAGONIST] slowly backs away, holding a holy [PROP].",
      2: "[CAMERA]. A horrifying [SUBJECT] levitates unnaturally in the center of the room, its bones cracking loudly as it contorts into an impossible geometric shape. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [SUBJECT] locks its empty gaze onto the [PROTAGONIST] and telekinetically launches heavy furniture across the room. The [PROTAGONIST] ducks violently! [REACTION].",
      4: "[CAMERA]. Sprints down the dark hallways as the lights systematically explode one by one behind the [PROTAGONIST]. The [SUBJECT] glides rapidly without moving its legs.",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] locks themselves inside the sanctuary. Total silence. Suddenly, black viscous liquid drips heavily from the ceiling right onto the [PROP].",
      6: "[CAMERA]. The [SUBJECT] doesn't break down the door—it simply phases through the solid wood, its horrifying face emerging inches from the [PROTAGONIST]'s face! Extreme jump scare.",
      7: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] thrusts the [PROP] forward, chanting desperately. Blinding, ethereal white light violently clashes with the [SUBJECT]'s pitch-black aura.",
      8: "[CAMERA]. Epic spiritual warfare! The sheer force of the energy battle tears the [SETTING]'s walls apart, revealing a stormy, thunderous sky outside. Slow motion divine intervention.",
      9: "[CAMERA]. [AESTHETICS]. The [SUBJECT] shrieks and violently implodes into ash, sucked back into the abyssal portal. A massive shockwave knocks the [PROTAGONIST] to the floor.",
      10: "[CAMERA]. Quiet, lingering shot. The dust settles in the ruined [SETTING]. The [PROTAGONIST] exhales a breath of cold air, utterly traumatized. Fade to white."
    }
  },
  {
    id: 'master_arc_10',
    name: "10. Arctic Research Base Parasite",
    description: "หนีตายปรสิตกลายพันธุ์ ท่ามกลางพายุหิมะและความโดดเดี่ยว",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Extreme blizzard conditions outside the isolated [SETTING]. Inside, the [PROTAGONIST] is shivering uncontrollably, holding a frozen, bio-hazardous [PROP].",
      2: "[CAMERA]. Under the flickering fluorescent lights, an infected crewmate morphs into a horrific biological anomaly. The [SUBJECT] roars, splitting its jaw open unnaturally. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. Disgusting, visceral chase! The [SUBJECT] crawls rapidly along the ceiling. The [PROTAGONIST] sprints desperately, slipping on the bloody ice-covered flooring.",
      4: "[CAMERA]. [REACTION]. The [PROTAGONIST] trips! The [SUBJECT] lunges, but misses by millimeters as the [PROTAGONIST] violently kicks a heavy equipment cart into its path.",
      5: "[CAMERA]. [AESTHETICS]. Trapped in the generator room. The [PROTAGONIST] desperately rips open fuel lines. The [SUBJECT] slowly stalks into the room, pulsating with horrible organic life.",
      6: "[CAMERA]. The [PROTAGONIST] strikes a flare. The [SUBJECT] recoils from the bright light, shrieking wildly in the terrifyingly cold environment. Extreme tension.",
      7: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] drops the flare into the fuel! The entire hallway erupts into a spectacular atmospheric fireball. The [SUBJECT] is engulfed in flames.",
      8: "[CAMERA]. Running just ahead of the explosion, the [PROTAGONIST] throws themselves out of the window into the freezing, blinding white blizzard outside. Slow-motion glass shattering.",
      9: "[CAMERA]. [AESTHETICS]. The burning facility illuminates the endless snowy wasteland. The [PROTAGONIST] collapses in the snow, watching the [SETTING] burn to the ground.",
      10: "[CAMERA]. Epic wide drone shot rising high into the blizzard. The tiny figure of the [PROTAGONIST] vanishes into the whiteout. Cinematic isolation."
    }
  },
  {
    id: 'master_arc_11',
    name: "11. Zombie Outbreak City Center",
    description: "หนีตายฝูงซอมบี้ดุร้ายและการทำลายล้างใจกลางเมือง",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Panic in the streets! The [SETTING] is engulfed in absolute chaos. Overturned cars burn fiercely. The [PROTAGONIST] desperately searches the wreckage for a [PROP].",
      2: "[CAMERA]. A terrifying, rabid [SUBJECT] vaults over a burning taxi, sprinting incredibly fast. It spots the [PROTAGONIST] and immediately shrieks in a bloodcurdling tone. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. Massive foot chase through grids of gridlocked traffic. The [PROTAGONIST] vaults over car hoods while hordes of the [SUBJECT] swarm from alleys like a tidal wave.",
      4: "[CAMERA]. The [PROTAGONIST] scrambles up a fire escape! The [SUBJECT] frantically tries to climb, tearing down the rusting metal structure in its mindless frenzy. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. Running across high-altitude rooftops. The [PROTAGONIST] leaps across a massive gap between buildings. The chasing [SUBJECT] leaps right after them!",
      6: "[CAMERA]. The [PROTAGONIST] barely lands on the edge! The [SUBJECT] misses the jump by an inch, plummeting violently down into the abyss of the infested streets below. Slow-motion fall.",
      7: "[CAMERA]. [AESTHETICS]. Exhausted, the [PROTAGONIST] reaches a barricaded rooftop survivor camp. They present the [PROP] as a bargaining chip to enter. Heavy rain starts to fall.",
      8: "[CAMERA]. Just as the gates open, a colossal, mutated version of the [SUBJECT] smashes through the rooftop barrier, completely destroying the safe zone! Explosive chaos.",
      9: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] performs a desperate slide underneath the mutated beast, triggering a massive C4 explosive charge attached to the roof.",
      10: "[CAMERA]. The building partially collapses in an epic cloud of dust. The [PROTAGONIST] ziplines away to a waiting helicopter as the [SETTING] falls to the horde. Masterpiece wide shot."
    }
  },
  {
    id: 'master_arc_12',
    name: "12. Dinosaur Park Escape",
    description: "การหลบหนีสัตว์ล้านปีดุร้ายขนาดยักษ์ในสวนสนุกแตก",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Torrential rain pours down on the ruined [SETTING]. A power outage has disabled the electric fences. The [PROTAGONIST] sits terrified in a stuck vehicle, holding a [PROP].",
      2: "[CAMERA]. A massive, earth-shaking footstep impacts the mud. Slowly, the colossal [SUBJECT] emerges from the dense tropical foliage, its reptilian eye staring straight into the vehicle. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [SUBJECT] violently flips the massive vehicle into the air! The [PROTAGONIST] tumbles out uncontrollably into the deep mud. Brutal chaotic momentum.",
      4: "[CAMERA]. Desperate sprint through the dense jungle! The [PROTAGONIST] weaves between giant ancient trees. The [SUBJECT] easily snaps massive trees in half as it pursues them.",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] slides down a steep muddy embankment, desperately hiding under a terrifyingly large waterfall. The [SUBJECT] sniffs the air intensely just above.",
      6: "[CAMERA]. The [PROTAGONIST] holds their breath underwater to avoid detection. Tense, completely silent underwater perspective. The monstrous silhouette of the [SUBJECT] passes overhead.",
      7: "[CAMERA]. [AESTHETICS]. Emerging from the water, the [PROTAGONIST] uses the [PROP] to attract the [SUBJECT] towards a highly explosive natural gas vent. High emotional stakes.",
      8: "[CAMERA]. A thrown flare ignites the vent! A spectacular wall of pure fire erupts, deeply burning the [SUBJECT]. The creature roars and defensively retreats into the dark jungle.",
      9: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] limps into the abandoned visitor center as dawn breaks. Sunbeams pierce through the shattered glass ceiling. Beautiful yet haunting.",
      10: "[CAMERA]. Epic wide establishing shot overlooking the sprawling, destroyed park. The distant roars of prehistoric nightmares echo through the majestic valley."
    }
  },
  {
    id: 'master_arc_13',
    name: "13. Futuristic Train Hijack",
    description: "ต่อสู้เดือดบนหลังคารถไฟความเร็วสูงสไตล์ไซเบอร์พังก์",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Searing wind rips past a bullet train traveling at Mach 1 through a neon wasteland [SETTING]. The [PROTAGONIST] violently fights for balance on the roof, securing a [PROP].",
      2: "[CAMERA]. A heavily cybernetic [SUBJECT] magnetically attaches to the side of the train, scaling up to confront the [PROTAGONIST]. Sparks grind aggressively against the metal. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. High-speed martial arts combat on the speeding roof! The [PROTAGONIST] parries a lethal strike. The background scenery blurs violently in hyper-kinetic motion.",
      4: "[CAMERA]. The [SUBJECT] unleashes a devastating energy blast! The [PROTAGONIST] narrowly dodges, the blast tearing a massive chunk out of the train's armor. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] slides down the shattered hole into the train's luxurious interior. Passengers scream. The [SUBJECT] drops down right after them, unyielding.",
      6: "[CAMERA]. Brutal close-quarters combat inside the narrow train cabin. The [PROTAGONIST] uses the [PROP] as an improvised shield. Intense choreography, shattered glass everywhere.",
      7: "[CAMERA]. [AESTHETICS]. The [SUBJECT] attempts to decouple the passenger cars. The [PROTAGONIST] tackles them out of a blown-out window. Both fall into the rushing desert winds!",
      8: "[CAMERA]. Free-falling parallel to the speeding train! The [PROTAGONIST] deploys an emergency magnetic tether, slamming brutally into the side of an adjacent train car.",
      9: "[CAMERA]. [AESTHETICS]. The [SUBJECT] entirely misses their grip, tumbling violently away into the dusty canyon below. Cinematic slow-motion fall of the antagonist.",
      10: "[CAMERA]. Breath-taking tracking shot running alongside the train. The [PROTAGONIST] lies exhausted but victorious on the side of the pristine train. Fade out."
    }
  },
  {
    id: 'master_arc_14',
    name: "14. Subterranean Monster Siege",
    description: "อสูรยักษ์ใต้พิภพ กับการถล่มทลายของถ้ำโบราณ",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Deep inside an obscure, crumbling [SETTING]. Complete isolation. The [PROTAGONIST] inspects a strange, pulsating [PROP] vibrating with low frequencies.",
      2: "[CAMERA]. The rock walls suddenly explode! A grotesque, blind subterranean [SUBJECT] bursts forth from the absolute darkness, driven by immense hunger. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] dives through a collapsing tunnel! The massive [SUBJECT] burrows right behind them, violently churning up tons of earth and debris.",
      4: "[CAMERA]. Intense claustrophobic crawl. The [PROTAGONIST] forces themselves through a gap too small for the [SUBJECT]. Tremendous pressure, the tunnel shakes violently. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. Emerging into a massive, ancient underground cathedral. The [PROTAGONIST] stands stunned. Suddenly, the monstrous [SUBJECT] drops massively from the ceiling above!",
      6: "[CAMERA]. The [PROTAGONIST] strikes a bundle of dynamite using the [PROP]. They hurl it directly into the [SUBJECT]'s gaping maw. Extreme athletic evasion slow-mo sequence.",
      7: "[CAMERA]. [AESTHETICS]. Epic confined explosion! The concussion wave blows the [PROTAGONIST] off their feet. The [SUBJECT] is blown to pieces in a shower of glowing gore.",
      8: "[CAMERA]. The structural integrity of the ancient cavern completely fails. Chunks of rock the size of houses plummet dramatically down. The [PROTAGONIST] races to the exit.",
      9: "[CAMERA]. [AESTHETICS]. The ground fully opens up. The [PROTAGONIST] violently rides a massive collapsing rock slab like a surfer, defying gravity towards a sliver of sunlight.",
      10: "[CAMERA]. Spectacular exit into a serene desert landscape. Dust violently billows out of the sinkhole. The [PROTAGONIST] completely collapses. Contrast of chaotic and calm."
    }
  },
  {
    id: 'master_arc_15',
    name: "15. The Time Loop Anomaly",
    description: "ฝ่าวิกฤติมิติลูปเวลาสุดหลอน ภาพบิดเบี้ยวเหนือจริง",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. A confusing, geometrically impossible [SETTING]. A clock violently ticks backward. The [PROTAGONIST] stares at a reality-warping [PROP] in total disbelief.",
      2: "[CAMERA]. Reality glitches aggressively. A terrifying, time-distorted [SUBJECT] stutters into the room, its movements heavily skipping frames in a deeply terrifying manner. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] runs through a door, only to emerge from a door behind them! The [SUBJECT] effortlessly bridges space to grab them. [REACTION].",
      4: "[CAMERA]. Mind-bending visual distortion. The [PROTAGONIST] is thrown violently across the room, but the fall is frozen in bullet-time. The [SUBJECT] slowly walks through the frozen scene.",
      5: "[CAMERA]. [AESTHETICS]. Using sheer willpower, the [PROTAGONIST] forces their hand (in real-time) to activate the [PROP]. The timeline violently shatters like glass!",
      6: "[CAMERA]. Extreme visual chaos. Multiple timelines visually overlay. The [PROTAGONIST] dodges an attack that hasn't happened yet! Fluid and mathematically impossible choreography.",
      7: "[CAMERA]. [AESTHETICS]. The [SUBJECT] shrieks in absolute agonizing distortion. The [PROTAGONIST] forces the [PROP] directly into the [SUBJECT]'s chest. Blinding light erupts.",
      8: "[CAMERA]. The environment violently rewinds in double-time. Broken objects repair, rain falls upwards. The [PROTAGONIST] stands perfectly still as the world spins around them.",
      9: "[CAMERA]. [AESTHETICS]. Reality aggressively snaps back to absolute normalcy. The serene [SETTING] is completely pristine. The terrifying [SUBJECT] never existed. Breathtaking silence.",
      10: "[CAMERA]. The [PROTAGONIST] exhales in deep relief, walking away. But the camera subtly tilts down: their reflection in a puddle is still screaming. Chilling final twist."
    }
  },
  {
    id: 'master_arc_16',
    name: "16. Cult Sacrifice Forest",
    description: "หนีตายลัทธิสยอง ในป่าลึกที่เต็มไปด้วยพิธีกรรมมืด",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. A dense, ancient forest [SETTING] illuminated only by burning torches. The [PROTAGONIST] discreetly spies on a bizarre ritual, clutching a crucial [PROP].",
      2: "[CAMERA]. The masked cultists abruptly stop. They all snap their heads directly towards the camera! A monstrous, summoned [SUBJECT] rises terrifyingly from a pool of blood. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. Heart-pounding chase through pitch-black woods. The [PROTAGONIST] smashes blindly through the thick brush. The supernatural [SUBJECT] teleports between trees silently.",
      4: "[CAMERA]. The [PROTAGONIST] falls into a deep muddy trench! The massive [SUBJECT] lands directly above them, its breathing echoing heavily. Intense, silent hiding sequence. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] uses the [PROP] to violently reflect moonlight, blinding the [SUBJECT]. They scramble out of the trench, sprinting with extreme desperation.",
      6: "[CAMERA]. Running across a treacherous, rotting suspension bridge. The [SUBJECT] leaps onto the bridge, tearing the wooden planks apart with ease! High-stakes vertigo shot.",
      7: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] savagely hacks the bridge ropes with a machete! The bridge dramatically snaps in slow motion. The [SUBJECT] roars as it falls into the deep gorge.",
      8: "[CAMERA]. Pulling themselves up to solid ground, the [PROTAGONIST] gasps heavily. The burning village of the cult is visible in the blurry distance. Gritty, realistic survival.",
      9: "[CAMERA]. [AESTHETICS]. A sudden flare of morning sunlight pierces the dense tree canopy, chasing away the oppressive shadows. The night of terror formally ends.",
      10: "[CAMERA]. Epic dramatic tracking shot moving away from the [PROTAGONIST] walking down a lonely dirt road, escaping perfectly into the misty dawn. Complete resolution."
    }
  },
  {
    id: 'master_arc_17',
    name: "17. Bio-Weapon Escaped",
    description: "ภารกิจหยุดยั้งอาวุธชีวภาพที่หลุดจากห้องแล็บใต้ดินสุดไฮเทค",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. A pristine, sterile underground laboratory [SETTING]. Alarm klaxons flash red. The [PROTAGONIST] is heavily armed, cautiously scanning with a [PROP] scanner.",
      2: "[CAMERA]. A reinforced containment glass violently shatters outward! A perfectly genetically engineered bio-[SUBJECT] leaps out, moving with terrifying predatory grace. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. Intense tactical firefight! The [PROTAGONIST] unloads heavy weaponry. The [SUBJECT] dodges bullets with impossible agility, deflecting them with hardened armor.",
      4: "[CAMERA]. The [SUBJECT] tackles the [PROTAGONIST] through a solid concrete wall. Brutal dust explosion. Hand-to-hand desperation sequence in the ruined adjacent armory. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] visually identifies a structural weakness. They lure the monstrous [SUBJECT] into the massive central particle accelerator chamber.",
      6: "[CAMERA]. Action packed dodge! The [SUBJECT] swings a massive claw. The [PROTAGONIST] slides underneath, wildly activating the accelerator mechanism with their [PROP].",
      7: "[CAMERA]. [AESTHETICS]. A blinding ring of concentrated energy violently spins up! The [SUBJECT] is caught terrifyingly in the center of the magnetic field, roaring in pain.",
      8: "[CAMERA]. The energy reaches critical mass. A spectacular inward implosion completely vaporizes the [SUBJECT], leaving only falling embers in the dramatic lighting.",
      9: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] leans heavily against the console, thoroughly exhausted and bloodied. The emergency bunker doors slowly grind open to the surface.",
      10: "[CAMERA]. Cinematic tracking back out of the lab. The facility officially locks down behind them in a massive show of brutalist architecture. Fade to military-style black."
    }
  },
  {
    id: 'master_arc_18',
    name: "18. Giant Kaiju in the City",
    description: "ไคจูยักษ์ถล่มเมือง การเอาชีวิตรอดระดับภัยพิบัติโลก",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Traffic is deadlocked on a bridge in the rainy [SETTING]. The [PROTAGONIST] steps out of their car to investigate alongside hundreds of others. They hold a [PROP].",
      2: "[CAMERA]. The ocean bay violently erupts! A skyscraper-sized amphibious [SUBJECT] slowly stands up, water cascading massively off its scales. A deafening cinematic roar erupts. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. Absolute widespread panic. The [PROTAGONIST] runs furiously against the fleeing crowd. The colossal [SUBJECT] casually steps on the bridge, snapping it instantly.",
      4: "[CAMERA]. Cars and debris rain down in extreme slow motion. The [PROTAGONIST] expertly parkours across falling slabs of concrete, defying gravity in breathtaking action choreography. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. Hiding in a crumbling office building high-rise. The massive, horrifying eye of the [SUBJECT] peers directly through the shattered glass windows, scanning inside.",
      6: "[CAMERA]. The [SUBJECT] spots them and rips the entire side of the building off! The [PROTAGONIST] literally slides down the collapsing floorboards, shooting wildly.",
      7: "[CAMERA]. [AESTHETICS]. Fighter jets roar overhead, unleashing a spectacular barrage of missiles directly into the [SUBJECT]'s face. Explosions light up the dark sky brilliantly.",
      8: "[CAMERA]. Distracted, the [SUBJECT] violently turns away towards the jets. The [PROTAGONIST] executes a terrifying leap from the collapsing building to a stable rooftop opposite.",
      9: "[CAMERA]. [AESTHETICS]. Landing brutally but safely. The [PROTAGONIST] watches as military forces deeply engage the massive [SUBJECT] in the glowing, burning skyline.",
      10: "[CAMERA]. Epic establishing masterpiece shot isolating the tiny [PROTAGONIST] against the backdrop of an apocalyptic monster war. Pure cinematic scale."
    }
  },
  {
    id: 'master_arc_19',
    name: "19. Dream Parasite",
    description: "การต่อสู้ในห้วงฝันร้ายที่สามารถควบคุมความเป็นจริงได้",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. Everything is surreal and floating in the dreamscape [SETTING]. Stairs lead to nowhere. The [PROTAGONIST] holds a glowing, subconscious [PROP].",
      2: "[CAMERA]. The geometry of the room violently folds inward. A shifting, nightmarish [SUBJECT] forms from the shadows, constantly changing its terrifying shape. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] realizes they are dreaming and attempts to fly away! The [SUBJECT] furiously stretches its limbs like black smoke, pursuing through the clouds.",
      4: "[CAMERA]. Nightmare physics! The [PROTAGONIST] runs down a hallway, but the walls turn to thick liquid, drastically slowing them down. The terrifying [SUBJECT] glides effortlessly. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] manifests a massive weapon from thin air using lucid dreaming. They stand their ground fearlessly in an epic hero pose.",
      6: "[CAMERA]. A spectacular surreal battle erupts! Reality shatters like mirrors with every impact. The [SUBJECT] strikes with psychological horror, but the [PROTAGONIST] parries with bright light.",
      7: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] forcefully jams the [PROP] directly into the [SUBJECT]'s core. A blinding explosion of pure consciousness engulfs the entire scene.",
      8: "[CAMERA]. The dream world violently collapses into abstract geometrical lines. The horrifying [SUBJECT] unravels into nothingness. Total sensory overload.",
      9: "[CAMERA]. [AESTHETICS]. Extreme close-up of an eye snapping open! The [PROTAGONIST] violently wakes up in a beautifully lit, realistic bedroom, sweating and panting heavily.",
      10: "[CAMERA]. Slow, calming dolly-pull out through the bedroom window. The morning sun gently rises, offering profound peace and safety. Masterpiece ending."
    }
  },
  {
    id: 'master_arc_20',
    name: "20. The Wilderness Hunt",
    description: "การล่าเดือดในป่าหิมะ ท่ามกลางสภาพอากาศพายุพัดโหมกระหน่ำ",
    scenes: {
      1: "[CAMERA]. [AESTHETICS]. A harsh, unforgiving mountainous [SETTING]. A blizzard is forming. The [PROTAGONIST] tracks bloody footprints in the snow, clutching a survival [PROP].",
      2: "[CAMERA]. A horrific, heavily camouflaged [SUBJECT] violently uncloaks from the snowbank instantly! It strikes with brutal, terrifying efficiency. [ACTION].",
      3: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] dodges and fiercely rolls down a steep snow embankment. An intense, brutal man-vs-nature physical brawl begins in the freezing powder.",
      4: "[CAMERA]. Tracking shot through the dense pines. The [PROTAGONIST] uses supreme woodland tactics, setting up a brutal trap. The [SUBJECT] stalks them with thermal precision. [REACTION].",
      5: "[CAMERA]. [AESTHETICS]. Extreme close-up of a tripwire snapping! A massive spiked log swings down from the canopy, violently impaling the terrifying [SUBJECT] mid-leap.",
      6: "[CAMERA]. The [SUBJECT] roars, ripping the log out in a spectacular display of raw power! It charges furiously, destroying the trees in its path.",
      7: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] stands fearlessly at the edge of a massive cliff. They ignite the [PROP]—a massive explosive charge buried in the snow.",
      8: "[CAMERA]. A spectacular avalanche is triggered! Millions of tons of snow roar down the mountain, completely sweeping the terrifying [SUBJECT] off the cliff edge.",
      9: "[CAMERA]. [AESTHETICS]. The [PROTAGONIST] holds desperately onto a firm, ancient pine tree as the catastrophic avalanche rushes past them in slow motion. Stunning visual power.",
      10: "[CAMERA]. The dust settles. The [PROTAGONIST] stands entirely victorious on the snowy peak, looking out over the majestic, silent white wilderness. Epic survival triumph."
    }
  }

];


export interface StoryArc15 {
  id: string;
  name: string;
  description: string;
  scenes: {
    1: string; 2: string; 3: string; 4: string; 5: string;
    6: string; 7: string; 8: string; 9: string; 10: string;
    11: string; 12: string; 13: string; 14: string; 15: string;
  };
}

export const SHORT_FILM_15_ARCS: StoryArc15[] = [
  {
    id: 'master_arc_1',
    name: "1. The Monster Hunt (Alpha Predator)",
    description: "แอคชั่นฮอลลีวูด ล่ามอนสเตอร์ เน้นการติดตามปะทะเดือด (15 ฉากเต็ม)",
    scenes: {
      1: "Cinematic drone establishing shot. [PROTAGONIST] gears up with heavy weapons in a derelict [SETTING]. Gritty, high-contrast action movie lighting.",
      2: "Low-angle Steadicam tracking. [PROTAGONIST] strides forward aggressively, tracking fresh giant footprints of the [SUBJECT].",
      3: "Extreme Close-Up (ECU) of tracking device pinging rapidly. Rack focus to the shadows.",
      4: "Sudden crash zoom! The monstrous [SUBJECT] drops from the ceiling, roaring violently.",
      5: "Dynamic Dutch Angle. [PROTAGONIST] barrel-rolls out of the way just as the [SUBJECT] smashes the ground. Slow-motion debris.",
      6: "Medium wide shot. [PROTAGONIST] unleashes a barrage of fire from their [PROP] at the beast. High rate of fire, muzzle flashes lighting the dark.",
      7: "Over-the-shoulder tracking. The [SUBJECT] charges right through the fire, shrugging off the attacks. Pure unstoppable force.",
      8: "Frantic handheld camera. [PROTAGONIST] sprints down a narrow corridor away from the enraged [SUBJECT]. Motion blur.",
      9: "High-angle claustrophobic shot. [PROTAGONIST] slides beneath a heavy blast door. The [SUBJECT]’s claws scrape the metal furiously.",
      10: "Quiet tension. MCU of [PROTAGONIST] reloading the [PROP], sweat pouring down. Silence before the storm.",
      11: "Wall explodes! The [SUBJECT] bursts through adjacent wall. Aggressive crash zoom. Wood and concrete fly everywhere.",
      12: "Slow-motion heroic leap. [PROTAGONIST] dives through mid-air, firing the [PROP] point-blank into the [SUBJECT]’s weak point.",
      13: "Low-angle shot. The [SUBJECT] reels back in agony, stumbling and destroying structural pillars of the [SETTING].",
      14: "Cinematic Wide Shot. The entire ceiling begins to collapse exactly on top of the [SUBJECT]. Massive dust cloud.",
      15: "Epic wide profile shot. [PROTAGONIST] walking away from the collapsing [SETTING] in slow motion without looking back. Fade to black."
    }
  },
  {
    id: 'master_arc_2',
    name: "2. The Relentless Pursuit",
    description: "การวิ่งไล่ล่าหนีตายแบบ Parkour หนีสัตว์ประหลาด",
    scenes: {
      1: "Tight OTS shot. [PROTAGONIST] catches breath in the ruins of [SETTING]. A low growl echoes.",
      2: "Whip pan to the darkness. The terrifying [SUBJECT] sprints into full view with terrifying speed.",
      3: "Frantic low-angle tracking. [PROTAGONIST] breaks into a full sprint. Camera aggressively tracks following their rapid feet.",
      4: "Action Parkour shot. [PROTAGONIST] vaults over an obstacle seamlessly. The [SUBJECT] smashes straight through it behind them.",
      5: "Dolly-zoom (Vertigo effect) down a seemingly endless corridor. The distance feels impossibly long while the beast closes in.",
      6: "Cinematic Slow-mo. [PROTAGONIST] leaps across a massive gap between rooftops. The camera glides alongside them in mid-air.",
      7: "Extreme low angle looking up. The [SUBJECT] leaps directly over the camera lens in pursuit, blocking out the sky.",
      8: "Handheld chaos. [PROTAGONIST] crashes through a glass window into an abandoned building. Shards of glass flying in slow-mo.",
      9: "Tight focused tracking shot. [PROTAGONIST] scrambling across a narrow beam, trying not to fall.",
      10: "The [SUBJECT] lands heavily behind them, shaking the entire structure. Dust falls from the ceiling.",
      11: "Rack focus from [PROTAGONIST]'s terrified face to a high-tension cable holding a heavy load above.",
      12: "Quick cut. [PROTAGONIST] throws their [PROP] to slice the cable. The heavy load plummets.",
      13: "Wide shot. The massive payload crushes the [SUBJECT] precisely as it lunges. Massive explosive impact.",
      14: "Steadicam push-in on the pile of rubble. The [SUBJECT] is completely incapacitated.",
      15: "Slow pan upwards to [PROTAGONIST] standing victorious but exhausted against the sunset skyline. Epic fade out."
    }
  },
  {
    id: 'master_arc_3',
    name: "3. The Hive Infiltration",
    description: "บุกรังอสูร หนังแอคชั่นระเบิดภูเขาเผากระท่อมเดือดปุดๆ",
    scenes: {
      1: "Cinematic drone push-in. A terrifying hive structure in the [SETTING]. [PROTAGONIST] stands ready with a glowing [PROP].",
      2: "Close-up of boots kicking the door open. Dust flies. Dramatic silhouette backlighting.",
      3: "Fast pan. Multiple smaller [SUBJECT]s turn their heads towards the intruder. Neon and gritty atmosphere.",
      4: "Gun-Fu style wide shot. [PROTAGONIST] engaging multiple enemies with fluid, lethal efficiency. Sparks and explosions.",
      5: "Dynamic dolly ring. Camera circles around [PROTAGONIST] as they hold their ground against a swarm.",
      6: "Sudden heavy impact! A massive brute [SUBJECT] enters the fray, knocking [PROTAGONIST] backward in slow motion.",
      7: "Low-angle heroic recovery. [PROTAGONIST] rolls up onto their feet, cracking their neck. Gritty determination.",
      8: "Crash zoom targeting the glowing core of the huge [SUBJECT].",
      9: "Handheld sprint. [PROTAGONIST] charges directly towards the giant [SUBJECT], dodging incoming attacks.",
      10: "Extreme close-up. [PROTAGONIST] violently thrusts the [PROP] straight into the beast's core.",
      11: "Blinding flash of energy. Wide shot. The beast detonates in a massive wave of plasma energy.",
      12: "The hive awakens! A deafening roar shakes the camera. The real Alpha [SUBJECT] emerges from the ground.",
      13: "Desperate OTS tracking shot. [PROTAGONIST] sets explosive charges on the walls and sprints for the exit.",
      14: "Extreme wide shot. Massive sequential explosions ripple through the [SETTING]. The Alpha [SUBJECT] is engulfed in fire.",
      15: "Epic slow-motion walk. [PROTAGONIST] emerges from the inferno unscathed. Heat distortion ripples the air. Fade out."
    }
  },
  {
    id: 'master_arc_4',
    name: "4. The Escort Mission",
    description: "คุ้มกันของสำคัญ ฝ่าดงสัตว์ประหลาด",
    scenes: {
      1: "Medium wide shot. Rainy [SETTING]. [PROTAGONIST] tightly clutching a highly valuable [PROP] glowing faintly.",
      2: "Fast tilt-up. A pack of terrifying [SUBJECT]s descends from the high ground like predators.",
      3: "Adrenaline shaky cam. [PROTAGONIST] begins sprinting down a flooded street, water splashing in slow motion.",
      4: "Over-the-shoulder tracking. A [SUBJECT] lunges from the side! [PROTAGONIST] seamlessly dodges without losing momentum.",
      5: "Close up of the [PROP] reacting to the danger, glowing intensely blue.",
      6: "Wide dynamic shot. [PROTAGONIST] slides under a crashing debris pillar as a [SUBJECT] fails its attack.",
      7: "Dutch tilt. [PROTAGONIST] is cornered in a dead end. Heavy rain, moody cinematic lighting.",
      8: "The alpha [SUBJECT] steps forward from the shadows slowly, savoring the kill.",
      9: "Extreme close up. [PROTAGONIST] activates a hidden feature inside the [PROP].",
      10: "Flash cut! The [PROP] projects a massive sonic energy shield. The [SUBJECT]s are violently pushed back.",
      11: "Steadicam following. [PROTAGONIST] uses the shield push to break the enemy line and sprint to an extraction zone.",
      12: "Low angle looking up. A massive extraction vehicle/chopper hovers above, shining a spotlight.",
      13: "Slow-motion leap. [PROTAGONIST] jumps toward the hovering ramp. The alpha [SUBJECT] lunges for their feet.",
      14: "Cinematic macro shot. The [SUBJECT]'s jaws snap shut literally an inch away from the boots.",
      15: "Wide establishing shot pulling away. The vehicle escapes into the clouds leaving the enraged [SUBJECT]s behind."
    }
  },
  {
    id: 'master_arc_5',
    name: "5. Close Quarters Combat (CQC)",
    description: "ซัดกันนัวในที่แคบ ชนแหลก สายบวกล้วนๆ (อารมณ์ John Wick เจอสัตว์ประหลาด)",
    scenes: {
      1: "Cinematic Low-key lighting. Inside a claustrophobic elevator shaft [SETTING]. [PROTAGONIST] is bloodied but breathing steadily.",
      2: "The elevator roof caves in! The terrifying [SUBJECT] lands heavily inside the small space. Dust explodes.",
      3: "Violent handheld close-up. Immediate brutal hand-to-hand combat. [PROTAGONIST] using the environmental walls to dodge.",
      4: "Fast shutter speed action. [PROTAGONIST] grabs a broken pipe [PROP] and strikes the beast with immense force.",
      5: "Extreme close-up on the [SUBJECT]'s enraged, terrifying red eyes.",
      6: "It counterattacks, slamming [PROTAGONIST] against the glass. Camera shakes violently on impact.",
      7: "OTS shot. The glass shatters outwards into the night sky. High altitude wind rushes in.",
      8: "Rack focus. [PROTAGONIST] notices the elevator cable snapping.",
      9: "Freefall! The elevator drops. Zero-gravity slow-motion aesthetic. Both [PROTAGONIST] and [SUBJECT] float mid-air.",
      10: "Mid-air scramble! [PROTAGONIST] kicks off the wall, tackling the [SUBJECT] out of the shattered window into the void.",
      11: "Epic tracking falling shot. [PROTAGONIST] and [SUBJECT] wrestling as they plummet down the side of a skyscraper.",
      12: "Quick cut. [PROTAGONIST] violently shoves the [PROP] directly into the beast's eye during freefall.",
      13: "Wide shot. [PROTAGONIST] deploys a high-tech rapid parachute. The [SUBJECT] continues plummeting to the ground.",
      14: "Massive impact far below. Dust cloud erupts from the concrete in the distance.",
      15: "Heroic glide. [PROTAGONIST] lands safely on a nearby rooftop, the beast vanquished. Slow majestic pan out."
    }
  }
  ,{
    id: 'master_arc_6',
    name: "6. The Desert Wasteland Ambush",
    description: "ซุ่มโจมตีเดือดกลางทะเลทราย (อารมณ์ Mad Max รถซิ่งหนีตาย)",
    scenes: {
      1: "Epic wide shot. Blistering hot sun over sand dunes. [PROTAGONIST] accelerates a heavily modified buggy across the wasteland.",
      2: "Low tracking shot near the tires. Sand kicks up into the camera lens.",
      3: "Sudden tremor! A colossal [SUBJECT] erupts from beneath the sand right in the vehicle's path.",
      4: "Frantic over-the-shoulder wide angle. [PROTAGONIST] wildly swerves the wheel, drifting to avoid the beast.",
      5: "Dynamic roll shot. The buggy flips over a dune, landing hard. [PROTAGONIST] kicks open the jammed door.",
      6: "Medium close-up. [PROTAGONIST] pulls a heavy sniper rifle from the wreckage.",
      7: "Rack focus. The towering [SUBJECT] roars, shaking the desert sand, and charges.",
      8: "Slow-motion deep focus. [PROTAGONIST] calmly aims down the scope while the beast closes the distance.",
      9: "Extreme close-up on the trigger pull. Flash of gunpowder.",
      10: "Tracking the bullet. The high-caliber round strikes the beast's armor, deflecting wildly.",
      11: "Fast pan. The [SUBJECT] retaliates, sweeping a massive appendage. [PROTAGONIST] slides beneath the attack.",
      12: "Handheld chaos. [PROTAGONIST] abandons the rifle, drawing a crackling energy [PROP] from their back.",
      13: "Low angle. The [SUBJECT] dives back underground, causing a localized sandstorm.",
      14: "Cinematic tension. Silence. [PROTAGONIST] stands perfectly still, listening for the vibrations.",
      15: "Explosive finale! The beast bursts up right beneath them! [PROTAGONIST] plunges the [PROP] downward into the sand! Fade to white."
    }
  },
  {
    id: 'master_arc_7',
    name: "7. The Deep Ocean Abomination",
    description: "สยองขวัญแอคชั่นใต้น้ำ แสงวับวาบ หลบหนีจากความมืดมิด",
    scenes: {
      1: "Eerie wide shot. Deep underwater. Faint bioluminescence. [PROTAGONIST] in a heavy diving suit repairing an unlit structure.",
      2: "Close-up on [PROTAGONIST]'s helmet. The radar begins pinging aggressively.",
      3: "Slow pan into the abyss. Two massive glowing eyes of a [SUBJECT] appear in the pitch black.",
      4: "Claustrophobic POV inside helmet. Breathing heavily. [PROTAGONIST] immediately boosts the jetpack upward.",
      5: "Tracking shot from beneath. The massive [SUBJECT] shoots vertically like a torpedo after them.",
      6: "Underwater dutch angle. [PROTAGONIST] fires a heavy harpoon gun downward, creating a jet stream.",
      7: "Macro shot of bubbles rushing past the lens. The [SUBJECT] effortlessly swats the harpoon away.",
      8: "Wide establishing shot. [PROTAGONIST] reaches a submerged industrial airlock, frantically twisting the emergency wheel.",
      9: "Over-the-shoulder tension. The beast opens its terrifying maw right behind them.",
      10: "Fast action cut. The wheel clicks! [PROTAGONIST] tumbles into the airlock as the heavy steel doors slam shut.",
      11: "Violent camera shake. The [SUBJECT] rams the airlock door from the outside. Metal groans and contorts.",
      12: "Red emergency lighting strobes intensely. [PROTAGONIST] pulls a high-explosive [PROP] from their belt.",
      13: "Water begins leaking rapidly through the cracking door seal.",
      14: "Extreme close-up of [PROTAGONIST]'s determined face setting the timer.",
      15: "Cinematic wide interior. The door gives way! As the beast rushes in, [PROTAGONIST] slams the [PROP] into its jaw and dives into the inner facility. Explosive shockwave!"
    }
  },
  {
    id: 'master_arc_8',
    name: "8. The Heavily Armored Beast",
    description: "อาวุธหนักปะทะมอนสเตอร์สายหุ้มเกราะ ระเบิดภูเขาเผากระท่อม",
    scenes: {
      1: "Military drone view. A war-torn urban [SETTING]. Smoke billows from shattered buildings.",
      2: "Low-angle hero shot. [PROTAGONIST] steps out of an armored transport carrying a massive, glowing Gatling gun.",
      3: "Earthquake-level camera shake. A heavily armored [SUBJECT] crushes a tank effortlessly.",
      4: "Aggressive push-in. [PROTAGONIST] locks eyes with the beast and revs up the heavy weapon.",
      5: "Insane rapid-fire muzzle flashes. The camera is blinded by the barrage of tracer rounds.",
      6: "Slow-motion tracking shot. Hundreds of bullets ricochet uselessly off the [SUBJECT]'s armor plating.",
      7: "Whip pan. The beast charges through the gunfire, bulldozing concrete pillars.",
      8: "Parkour POV. [PROTAGONIST] drops the heavy gun, sprinting up a collapsed staircase for high ground.",
      9: "Overhead shot. The [SUBJECT] smashes the entire base of the building, causing it to structurally fail.",
      10: "Dutch tilt freefall! [PROTAGONIST] surfs the sliding debris downward as the building collapses.",
      11: "Mid-air cinematic freeze-frame. [PROTAGONIST] draws a concentrated laser [PROP] targeting a weak joint on the beast.",
      12: "Violent crash landing. Dust obscures everything in a thick gray fog.",
      13: "Quiet, tense silence. A piercing blue beam from the [PROP] cuts through the dust.",
      14: "The [SUBJECT] screams in agony, an armor plate cleanly sliced off.",
      15: "Epic hero framing. The dust clears. [PROTAGONIST] stands victorious over the beast, the [PROP] smoking."
    }
  },
  {
    id: 'master_arc_9',
    name: "9. The Vertical Escape",
    description: "วิ่งไต่หอคอยหนีตาย ปีนป่ายปาร์กัวร์สุดหวาดเสียว",
    scenes: {
      1: "Extreme low angle looking up a towering, crumbling spiral staircase. Silence.",
      2: "Sudden crash! [PROTAGONIST] bursts through a door at the bottom, sprinting up the stairs.",
      3: "High-angle looking down the center of the staircase. A swarming, terrifying [SUBJECT] floods in from below.",
      4: "Handheld tracking shot running behind [PROTAGONIST]. Breathing is ragged to the sounds of screeching.",
      5: "The stairs begin collapsing! [PROTAGONIST] leaps across a massive gap in slow motion.",
      6: "Macro shot of [PROTAGONIST]'s fingers barely gripping the crumbling stone edge.",
      7: "Looking down. The [SUBJECT] is climbing the walls with terrifying, spider-like agility.",
      8: "Fast tilt-up. [PROTAGONIST] pulls themselves up and utilizes a grappling [PROP] to swing higher.",
      9: "Mid-swing wide shot. They swing directly over the gnashing jaws of the pursuing horde.",
      10: "Crash landing through a wooden floorboard into the belfry of the tower.",
      11: "Cinematic high-contrast moonlight streaming through the belfry openings.",
      12: "The horde breaks through the floorboards! [PROTAGONIST] furiously kicks the massive bell mechanism.",
      13: "Extreme close-up of the ancient gears grinding loudly to life.",
      14: "Epic wide shot. The colossal bronze bell unhinges and drops straight down the tower interior.",
      15: "God's eye view. The massive bell plummets down the shaft, absolutely crushing the climbing [SUBJECT]s beneath it. Dust plumes outward."
    }
  },
  {
    id: 'master_arc_10',
    name: "10. The Sniper's Nest",
    description: "พลซุ่มยิงบนตึกสูง ปะทะนักล่าล่องหน พลิกมาเป็นระยะประชิด",
    scenes: {
      1: "Tense establishing panning shot across a dark, rain-slicked city skyline. [SETTING].",
      2: "Extreme close-up of an eye looking calmly through a high-tech thermal scope.",
      3: "Over-the-shoulder POV. [PROTAGONIST] scans the abandoned streets below. Nothing but rain.",
      4: "The thermal scope violently glitches! A massive, invisible [SUBJECT] suddenly materializes completely bypassing thermal right below them.",
      5: "Whip pan to the rooftop access door. It violently blows off its hinges in slow-motion.",
      6: "Quick push-in on [PROTAGONIST]'s shocked face as they abandon the sniper.",
      7: "Handheld chaotic tracking. The invisible beast strikes, sending [PROTAGONIST] flying across the wet roof.",
      8: "Low angle slide. [PROTAGONIST] recovers mid-slide and draws a sparking electric [PROP] baton.",
      9: "A sudden splash in a puddle reveals the invisible [SUBJECT]'s footprint approaching rapidly.",
      10: "Lightning flash illuminates the horrifying silhouette of the beast mid-leap!",
      11: "Dynamic parry! [PROTAGONIST] blocks the massive invisible claw with the [PROP], sending sparks flying.",
      12: "Vicious close-quarters struggle on the edge of the rooftop. Camera tilts dangerously towards the drop.",
      13: "Macro detail shot. [PROTAGONIST] forces the electric [PROP] deeply into a gap in the beast's camouflage.",
      14: "Screeching static feedback! The [SUBJECT]'s invisibility short-circuits and shatters like glass.",
      15: "Epic wide angle. The fully visible monster stumbles back and plummets off the skyscraper. [PROTAGONIST] breathes heavily, looking down."
    }
  },
  {
    id: 'master_arc_11',
    name: "11. The Abandoned Train",
    description: "สู้บนรถไฟร้างความเร็วสูง โหนสลิง โดดข้ามโบกี้ ทุลักทุเลสุดมันส์",
    scenes: {
      1: "High-speed drone tracking shot. A rusty, runaway train tearing through a snowy landscape at night.",
      2: "Interior claustrophobic tracking. [PROTAGONIST] walks cautiously through a dark passenger car holding a tactical flashlight.",
      3: "Sudden bump! The camera jerks. The roof of the train cars above is denting heavily, step by step.",
      4: "Dutch angle point-up. A terrifying [SUBJECT] tears open the metal roof like tin foil, screaming.",
      5: "Fast reaction shot. [PROTAGONIST] dives backwards as deadly claws rake the aisle where they stood.",
      6: "Running retreat! Over-the-shoulder tracking as [PROTAGONIST] bursts through the door into the connecting gangway.",
      7: "Extreme wind noise. The gangway is torn. [PROTAGONIST] struggles against the freezing blizzard outside.",
      8: "The beast bursts through the door! [PROTAGONIST] kicks off the platform, grasping a trailing cable [PROP].",
      9: "Cinematic wide profile. [PROTAGONIST] swinging outside the speeding train car, barely holding on.",
      10: "The [SUBJECT] climbs out onto the side of the train, crawling terrifyingly fast toward the dangling human.",
      11: "Low angle from the tracks. [PROTAGONIST] swings violently, kicking the beast squarely in the face.",
      12: "The beast snarls, grabbing the [PROP] cable to yank [PROTAGONIST] into its jaws.",
      13: "Extreme close-up. [PROTAGONIST] pulls a survival knife and firmly slices the cable [PROP].",
      14: "Slow-motion freefall away from the train. [PROTAGONIST] drops safely into a deep snowdrift.",
      15: "Tracking the train. The [SUBJECT] roars in frustration as the runaway train disappears into a dark tunnel."
    }
  },
  {
    id: 'master_arc_12',
    name: "12. The Aerial Dogfight",
    description: "ต่อสู้กลางอากาศด้วย Jetpack ดิ่งพสุธาแบบไร้แรงโน้มถ่วง",
    scenes: {
      1: "Breathtaking wide aerial shot above the clouds. Golden hour lighting.",
      2: "Push-in on [PROTAGONIST] soaring through the sky using an advanced jetpack rig.",
      3: "Sudden shadow envelopes the camera. A colossal flying [SUBJECT] dives from the sun above.",
      4: "Violent mid-air collision! The camera spins out of control. [PROTAGONIST] loses altitude fast.",
      5: "High G-force POV. The ground is approaching rapidly. Wind howling loudly.",
      6: "Extreme close-up of [PROTAGONIST] overriding the broken thrusters manually.",
      7: "Vicious divebomb! The [SUBJECT] tucks its wings, rocketing down toward the helpless human.",
      8: "Wide tracking shot falling together. [PROTAGONIST] draws a heavy aerodynamic [PROP] cannon mid-fall.",
      9: "Intense recoil! The [PROP] fires a massive energy slug, pushing [PROTAGONIST] backwards.",
      10: "The [SUBJECT] dodges flawlessly with a barrel roll, closing the distance to zero.",
      11: "Violent mid-air grapple. The beast's talons rip into the jetpack armor. Sparks spray wildly.",
      12: "Claustrophobic wide angle facing [PROTAGONIST]'s screaming visor. They violently rip a fuel line from their pack.",
      13: "Slow-motion tension. [PROTAGONIST] shoves the leaking fuel line directly into the beast's mouth.",
      14: "Quick cut. [PROTAGONIST] ignites the thruster and instantly unbuckles from the rig.",
      15: "Massive cinematic explosion! The jetpack and the beast detonate in the sky. [PROTAGONIST] deploys a wingsuit beneath the fireball."
    }
  },
  {
    id: 'master_arc_13',
    name: "13. Bio-Hazard Containment Breach",
    description: "ห้องแล็บปิดตาย ไฟแดงฉุกเฉิน หนีการกลายพันธุ์สุดโหด",
    scenes: {
      1: "Immersive steady pan across a state-of-the-art bio-lab [SETTING]. Alarms blaring. Red strobe lights flashing.",
      2: "Medium shot. [PROTAGONIST] frantically typing on a cracked terminal, drenched in nervous sweat.",
      3: "A deafening thud against the reinforced glass behind them. The horrific [SUBJECT] presses its face against it.",
      4: "Tracking shot on the glass. The glass fractures instantly under the beast's unnatural strength.",
      5: "Exploding glass! [PROTAGONIST] dives under the console cover as shrapnel flies everywhere.",
      6: "Handheld low angle from beneath the desk. The beast prowls the room, sniffing the air.",
      7: "Extreme close-up on [PROTAGONIST] holding breath. A drop of sweat falls loudly to the floor.",
      8: "Whip pan! The [SUBJECT] flips the entire reinforced desk over with one hand, exposing them.",
      9: "Desperate action. [PROTAGONIST] sprays a liquid nitrogen [PROP] canister directly into its eyes.",
      10: "The beast thrashes wildly, blindly destroying the laboratory servers in a rage.",
      11: "Over-the-shoulder tracking. [PROTAGONIST] sprints for the heavy blast doors slowly closing.",
      12: "The beast recovers, leaping entirely across the room to block the exit.",
      13: "Cinematic slide. [PROTAGONIST] slides between its legs, throwing the frozen [PROP] canister at the beast's chest.",
      14: "One well-placed gunshot. [PROTAGONIST] shoots the canister, causing a massive cryogenic explosion.",
      15: "The blast doors seal flawlessly behind [PROTAGONIST] as they catch their breath in the pristine white hallway."
    }
  },
  {
    id: 'master_arc_14',
    name: "14. The Silent Stalker",
    description: "ซุ่มซ่อนในป่าดงดิบ สายลับลอบสังหารเจอมอนสเตอร์ พลิกบทบาทผู้ล่าเป็นผู้ถูกล่า",
    scenes: {
      1: "Slow, creeping pan through thick, foggy jungle undergrowth [SETTING].",
      2: "Macro shot of a heavily camouflaged boot stepping absolutely silently onto a wet leaf.",
      3: "Low-angle profile. [PROTAGONIST] in full stealth gear, slowly nocking a high-tech explosive arrow into a bow.",
      4: "A terrifyingly fast shadow darts through the canopy above. The [SUBJECT] moves with zero sound.",
      5: "Sudden pull-out wide shot. The [PROTAGONIST] realizes they are completely surrounded by the beast's afterimages.",
      6: "Violent ambush! The [SUBJECT] drops from the trees directly behind them.",
      7: "Instinctive parry. [PROTAGONIST] spins, blocking a vicious swipe with a carbon-fiber [PROP].",
      8: "Handheld chaos tracking through dense foliage as [PROTAGONIST] sprints wildly, abandoning stealth.",
      9: "Over-the-shoulder view. The beast effortlessly breaks through massive tree trunks in relentless pursuit.",
      10: "Dutch tilt tracking back. [PROTAGONIST] slides down a muddy embankment, covered in dirt.",
      11: "They hit the bottom, turning to face the beast diving rapidly from the hill above.",
      12: "Epic slow-motion low angle. [PROTAGONIST] draws the bow while lying in the mud, aiming straight up.",
      13: "Extreme close-up on the protagonist's completely calm, focused eye. Release.",
      14: "Tracking the explosive arrow right into the [SUBJECT]'s open screaming mouth mid-air.",
      15: "Cinematic God's ray lighting. The beast detonates in a shower of foliage. [PROTAGONIST] slowly stands up into the light."
    }
  },
  {
    id: 'master_arc_15',
    name: "15. The Final Sacrifice",
    description: "ยืนหยัดสู้ตาย ปกป้องจุดศูนย์กลาง อารมณ์วีรบุรุษก่อนระเบิดพลีชีพ",
    scenes: {
      1: "Epic wide sweeping shot over a glowing energy core reactor [SETTING].",
      2: "Heroic low-angle push-in. [PROTAGONIST] stands alone on the defensive bridge, reloading a massive plasma cannon.",
      3: "The massive blast doors buckle and rip open. An unstoppable armored [SUBJECT] marches through.",
      4: "Tracking shot from behind the beast, looking down at the lone human defender.",
      5: "Unflinching resolve. [PROTAGONIST] unloads the entire plasma cannon. Searing bright beams fill the screen.",
      6: "Slow-motion tracking. The plasma burns off armor plates, but the [SUBJECT] marches relentlessly through the fire.",
      7: "Violent whip pan. The beast effortlessly swats the massive cannon away, shattering it.",
      8: "Handheld impact shot. [PROTAGONIST] is thrown violently against the reactor core terminal.",
      9: "Close-up on a blinking red self-destruct [PROP] detonator clutched in a bloody fist.",
      10: "The towering [SUBJECT] grabs [PROTAGONIST] by the throat, hoisting them helplessly into the air.",
      11: "Claustrophobic low-angle. The beast's jaws open wide, preparing for the finishing bite.",
      12: "Extreme close-up on [PROTAGONIST]'s face. A bloody, defiant smirk.",
      13: "Macro detail shot. The thumb slams totally down on the detonator [PROP] firmly.",
      14: "Total silence. Time freezes. The reactor core behind them glows impossibly, blindingly bright white.",
      15: "Absolute cinematic destruction. A silent, blindingly white shockwave expands outward, turning everything to ash. Fade to pure white."
    }
  }

];