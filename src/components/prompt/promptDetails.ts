export type Option = { label: string; value: string };

export const DETAIL_CATEGORIES: Option[] = [
  { label: '🐲 สัตว์ประหลาด/สัตว์บก (Monster/Beast Traits)', value: 'monster' },
  { label: '🧑‍🎤 บุคคล/ตัวละคร (Human/Character Traits)', value: 'human' },
  { label: '✨ ออร่า/เอฟเฟกต์เวทมนตร์ (Aura & Effects)', value: 'aura' },
  { label: '🎒 พร็อพ/เครื่องประดับ (Props & Accessories)', value: 'props' },
  { label: 'ทั่วไป (General/Others)', value: 'others' }
];

// 1. Monster/Beast Details
export const MONSTER_DETAILS: Option[] = [
  { label: '1. เกล็ดสีเทา ขนปุกปุย (Grey scales & furry)', value: 'covered in grey scales with furry details' },
  { label: '2. ผิวตกสะเก็ดหิวโหย (Emaciated, cracked skin)', value: 'with terrifyingly emaciated and cracked dry skin' },
  { label: '3. มีหลายตา (Multiple glowing eyes)', value: 'featuring multiple glowing eyes scattered across its body' },
  { label: '4. มีหนวดปลาหมึกชอนไช (Writhing tentacles)', value: 'with writhing, slimy cephalopod tentacles' },
  { label: '5. ฟันฉลามแหลมคมหลายชั้น (Multiple rows of shark teeth)', value: 'revealing multiple rows of razor-sharp shark teeth' },
  { label: '6. ผิวสไลม์กรดเหนียวหนืด (Acidic slime dripping)', value: 'dripping with viscous, neon green acidic slime' },
  { label: '7. เขี้ยวยาวโค้งน่ากลัว (Massive curved tusks)', value: 'sporting massive, menacing curved ivory tusks' },
  { label: '8. ขนหนาฟูเหมือนนกฮูก (Fluffy owl-like feathers)', value: 'covered in extremely thick, soft owl-like feathers' },
  { label: '9. มีเขางอกตามกระดูกสันหลัง (Spikes along the spine)', value: 'with sharp jagged bone spikes running down its spine' },
  { label: '10. ผิวโลหะชีวะ (Biomechanical metallic plates)', value: 'covered in biomechanical metallic armor plates' },
  { label: '11. ครีบปลาเรืองแสง (Glowing aquatic fins)', value: 'featuring bioluminescent aquatic fins' },
  { label: '12. มีปีกหนังค้างคาวขาดๆ (Torn leathery bat wings)', value: 'possessing torn and scarred leathery bat wings' },
  { label: '13. ปลายหางเป็นลูกตุ้มหนาม (Spiked club tail)', value: 'with a heavy spiked club at the end of its tail' },
  { label: '14. ตัวอ้วนกลมปุ๊กลุก (Chubby and extremely round)', value: 'with a comedically chubby, spherical body' },
  { label: '15. มีเหงือกเต้นตุบๆ ที่คอ (Pulsating gills on neck)', value: 'with openly pulsating and breathing gills on its neck' },
  { label: '16. ผิวขรุขระเหมือนหินภูเขาไฟ (Volcanic rock skin)', value: 'textured completely like porous dark black volcanic rock' },
  { label: '17. แมลงไต่ตามตัว (Covered in crawling insects)', value: 'unnervingly covered in tiny crawling scarab beetles' },
  { label: '18. หูยาวตกดุจกระต่าย (Long drooping rabbit ears)', value: 'with adorably long, droopy rabbit-like ears' },
  { label: '19. ผิวสะท้อนแสงเหมือนเหลือบแมลง (Iridescent beetle shell)', value: 'covered in an iridescent exoskeleton reflecting multiple colors' },
  { label: '20. คอยาวผิดปกติ (Unnervingly long serpentine neck)', value: 'possessing an impossibly long and flexible serpentine neck' },
  { label: '21. อุ้งเท้าใหญ่ยักษ์ (Oversized massive paws)', value: 'with disproportionately giant, soft fluffy paws' },
  { label: '22. เกล็ดลอกคราบครึ่งตัว (Shedding old skin)', value: 'caught halfway through aggressively shedding its old skin' },
  { label: '23. ตามีต้อกระจก 뿌มัว (Blind milky-white eyes)', value: 'with entirely cloudy, blind milky-white cataracts' },
  { label: '24. หัวโตตัวเล็ก (Huge head, tiny body)', value: 'having a massive bobblehead-style head on a tiny body' },
  { label: '25. ปากแยกเป็นสี่แฉก (Four-part mandibles)', value: 'with an insectoid mouth splitting into four distinct mandibles' },
  { label: 'ระบุเอง (Custom)', value: 'custom' }
];

// 2. Human/Character Details
export const HUMAN_DETAILS: Option[] = [
  { label: '1. รอยแผลเป็นบากที่ตา (Deep scar across the eye)', value: 'with a deep rugged diagonal scar across one eye' },
  { label: '2. รอยสักยันต์เวทมนตร์ (Glowing arcane tattoos)', value: 'covered in glowing, intricate arcane sigil tattoos' },
  { label: '3. หน้าเลอะเขม่าควันดินปืน (Soot and ash covered face)', value: 'with a face heavily smudged with black gunpowder soot and ash' },
  { label: '4. ดวงตาสองสี (Heterochromia - two different colored eyes)', value: 'with striking heterochromia, one blue eye and one red eye' },
  { label: '5. ร้องไห้เป็นสายเลือด (Weeping blood)', value: 'quietly weeping, with thin streaks of blood running down their cheeks' },
  { label: '6. รอยคล้ำใต้ตาอดนอน (Heavy dark circles under eyes)', value: 'with extremely dark, exhausted bags under their eyes' },
  { label: '7. สีผมครึ่งขาวครึ่งดำ (Split black and white hair)', value: 'with striking hair neatly parted, half stark white and half pitch black' },
  { label: '8. ผิวซีดเผือดเหมือนศพ (Deathly pale skin)', value: 'having unsettlingly pale, almost translucent porcelain skin' },
  { label: '9. รอยยิ้มฉีกกว้างน่ากลัว (Unnaturally wide grin)', value: 'wearing an impossibly wide, psychotic grinning expression' },
  { label: '10. ไซบอร์กแขนจักรกล (Mechanical cyborg arm)', value: 'featuring a sleek futuristic mechanical cyborg left arm' },
  { label: '11. หน้าแดงเขินอาย (Blushing heavily, embarrassed)', value: 'blushing profusely with a highly flustered expression' },
  { label: '12. ปากคาบซิการ์มวนโต (Chomping on a large thick cigar)', value: 'aggressively chomping on a large, smoking lit cigar' },
  { label: '13. มีแผลบอบช้ำเลือดกำเดาไหล (Bruised with a bloody nose)', value: 'heavily bruised with a steadily bleeding nose' },
  { label: '14. คิ้วขมวดจริงจัง (Furrowed intense eyebrows)', value: 'with deeply furrowed eyebrows and an intensely serious glare' },
  { label: '15. ผมเปียกชุ่มลู่หน้า (Soaking wet hair covering face)', value: 'with dripping wet hair plastered messily across their face' },
  { label: '16. ผิวไหม้แดดเกรียม (Heavily sunburnt skin)', value: 'with painfully red, heavily sunburnt skin peeling slightly' },
  { label: '17. นัยน์ตาไร้แวว (Empty, dead eyes)', value: 'staring blankly with empty, soulless and completely dead eyes' },
  { label: '18. มีเขาปีศาจหักหนึ่งข้าง (One broken demon horn)', value: 'with one sharp demon horn intact and the other violently snapped off' },
  { label: '19. ฟันเหยินน่ารัก (Cute snaggletooth/yaeba)', value: 'smiling warmly to reveal a cute, slightly misaligned canine snaggletooth' },
  { label: '20. เคราเฟิ้มไม่ได้โกน (Unkempt untidy beard)', value: 'sporting a very messy, overgrown and untidy thick beard' },
  { label: '21. รอยกระเต็มแก้ม (Freckles splashed across cheeks)', value: 'with a heavy dusting of cute brown freckles entirely across their nose and cheeks' },
  { label: '22. หลับตาพริ้มสงบเงียบ (Eyes peacefully closed)', value: 'with their eyes gently and peacefully closed in deep meditation' },
  { label: '23. เส้นผมพลิ้วไหวแรงลม (Hair blowing wildly in the wind)', value: 'with their hair being blown wildly back by a powerful magic wind' },
  { label: '24. เต็มไปด้วยเหงื่อพรั่งพรู (Drenched in nervous sweat)', value: 'completely drenched in a cold, nervous anxious sweat' },
  { label: '25. ปีกนางฟ้าครึ่งหลัง (Single asymmetrical angel wing)', value: 'possessing only a single, beautiful white angel wing on their back' },
  { label: 'ระบุเอง (Custom)', value: 'custom' }
];

// 3. Aura & Effects
export const AURA_DETAILS: Option[] = [
  { label: '1. มีไฟลุกท่วมตัว (Engulfed in roaring flames)', value: 'completely engulfed in a roaring magical campfire-like aura' },
  { label: '2. ลำตัวโปร่งแสงจางหาย (Fading into transparency)', value: 'slowly glitching and fading in and out of transparency' },
  { label: '3. ละอองแสงหิ่งห้อยลอยล่อง (Floating firefly embers)', value: 'surrounded by peacefully floating, glowing golden firefly embers' },
  { label: '4. ควันสีดำทะมึนแผ่ซ่าน (Oozing dark shadow mist)', value: 'actively oozing a thick, terrifying pitch-black shadow mist' },
  { label: '5. ประกายสายฟ้าแลบ (Crackling with lightning arcs)', value: 'constantly crackling with chaotic blue arcs of static electricity' },
  { label: '6. ออร่าสีรุ้งเหลือบแสง (Iridescent rainbow aura)', value: 'radiating a soft, shimmering iridescent rainbow chromatic aura' },
  { label: '7. หิมะและเกล็ดน้ำแข็งร่วงโปรย (Snow flurries circling)', value: 'having a localized micro-climate of falling snow circling them constantly' },
  { label: '8. แตกสลายเป็นเศษกระดาษ (Dissolving into paper confetti)', value: 'magically dissolving into hundreds of floating origami paper pieces' },
  { label: '9. เลือดสีทองหยดติ๋งๆ (Dripping golden ichor/blood)', value: 'bleeding and actively dripping a glowing divine gold liquid' },
  { label: '10. ซ้อนทับร่างเงา (Overlapping glitching shadow clones)', value: 'leaving a trail of visually glitching, stuttering shadow afterimages' },
  { label: '11. ร่างกายกลายเป็นลาวา (Melting into magma)', value: 'slowly melting from the bottom up into glowing, searing magma' },
  { label: '12. มีอักษรคำสาปลอยวน (Circling cursed floating texts)', value: 'surrounded by three rotating rings of glowing crimson ancient text' },
  { label: '13. ผลึกคริสตัลกำลังงอก (Crystals aggressively growing out)', value: 'with sharp amethyst crystals actively sprouting and growing from their skin' },
  { label: '14. เสียงสะท้อนภาพลวงตา (Distorted mirage heat waves)', value: 'surrounded by intense, distorting heat-wave mirage ripples' },
  { label: '15. กลายเป็นหินจากปลายนิ้ว (Petrifying into solid stone)', value: 'halfway petrified into solid grey stone, starting from the extremities' },
  { label: 'ระบุเอง (Custom)', value: 'custom' }
];

// 4. Props & Accessories
export const PROP_DETAILS: Option[] = [
  { label: '1. สวมมงกุฎหนาม (Wearing a crown of thorns)', value: 'wearing a painful-looking crown woven from sharp, dark thorns' },
  { label: '2. โดนโซ่ล่ามที่คอและแขน (Bound by heavy iron chains)', value: 'heavily restricted and bound by thick, rusty iron chains' },
  { label: '3. ถือถ้วยชาจิ๋ว (Holding a tiny porcelain teacup)', value: 'delicately gripping an impossibly tiny, painted porcelain teacup' },
  { label: '4. คาบดอกกุหลาบสด (Biting a fresh red rose)', value: 'romantically clenching a vibrant, fresh red rose in their teeth' },
  { label: '5. สวมหมวกพ่อมดใบโต (Oversized floppy wizard hat)', value: 'struggling under the weight of a comically oversized floppy wizard hat' },
  { label: '6. สะพายดาบยักษ์พังๆ (Carrying a broken massive Buster Sword)', value: 'effortlessly carrying an impractically giant, half-shattered fantasy broadsword' },
  { label: '7. ผ้าพันคอถักสีแดงพันหลายรอบ (Wrapped in a long red scarf)', value: 'cozily wrapped in an incredibly long, loosely knit red winter scarf' },
  { label: '8. ใส่แว่นตากลมสไตล์แฮร์รี่ (Round wire-rimmed glasses)', value: 'wearing cracked, circular wire-rimmed reading glasses' },
  { label: '9. ถือกะโหลกสัตว์ (Holding an animal skull)', value: 'ominously caressing a bleached, clean horned animal skull' },
  { label: '10. ซ่อนตัวใต้ร่มกระดาษ (Holding a traditional paper umbrella)', value: 'elegantly holding a brightly painted traditional Japanese paper umbrella' },
  { label: '11. คาบปลาทูสด (Holding a raw fish in mouth)', value: 'hilariously holding a fresh, raw slippery mackerel fish in its jaws' },
  { label: '12. มีดาบปักหลังเลือดอาบ (Pierced in the back by arrows/swords)', value: 'tragically having three glowing magical arrows pierced directly into their back' },
  { label: '13. สวมชุดเกราะอัศวินที่แตกกระจาย (Wearing shattered plate armor)', value: 'wearing an intricately carved silver plate armor that is heavily dented and shattered' },
  { label: '14. ถือคทาวิเศษยอดคริสตัล (Wielding a tall crystal staff)', value: 'gripping a tall, gnarled wooden staff topped with a floating glowing crystal' },
  { label: '15. มีพลาสเตอร์ยาน่ารักแปะที่แก้ม (Cute band-aid on cheek)', value: 'wearing a cute cartoon-patterned physical band-aid horizontally across the cheek' },
  { label: 'ระบุเอง (Custom)', value: 'custom' }
];

export const OTHER_DETAILS: Option[] = [
  { label: 'ไม่มีรายละเอียด (No details)', value: '' },
  { label: 'สะท้อนแสงบางส่วน (Partial reflection)', value: 'highly reflective in certain areas' },
  { label: 'ระบุเอง (Custom)', value: 'custom' }
];

