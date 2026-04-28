import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  { label: '📋 ตารางซ้อมสัปดาห์นี้', prompt: 'ช่วยแนะนำตารางซ้อม Bboy สำหรับสัปดาห์นี้ให้หน่อย แบ่งตามวัน จ-อา ให้ครอบคลุม Toprock, Footwork, Power Moves, Freeze' },
  { label: '🔄 วิธีฝึก Windmill', prompt: 'วิธีฝึก Windmill ตั้งแต่เริ่มต้นทีละ step อธิบายเป็นภาษาง่ายๆ พร้อมท่าเตรียมตัว' },
  { label: '💪 แผนเสริมกล้ามเนื้อ', prompt: 'แนะนำ workout สำหรับเสริมกล้ามเนื้อที่ใช้ในการเต้น Bboy เช่น core, shoulder, wrist strength' },
  { label: '🍎 แผนอาหาร', prompt: 'แนะนำแผนอาหารรายวันสำหรับ Bboy ที่ต้องการพลังงานสูงแต่ลดไขมัน' },
  { label: '🧘 ท่ายืดเหยียด', prompt: 'แนะนำท่ายืดเหยียดที่สำคัญสำหรับ Bboy ก่อนและหลังซ้อม ป้องกันบาดเจ็บ' },
  { label: '🎯 แผนฝึก 30 วัน', prompt: 'ช่วยวางแผนฝึก Bboy 30 วัน สำหรับคนที่เริ่มต้น อยากฝึกจริงจังให้เก่ง' },
];

export function AICoach() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_coach_history')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {});

    fetch('/api/get-app-data?key=bboy_coach_settings')
      .then(r => r.json())
      .then(data => { if (data && data.apiKey) setApiKey(data.apiKey); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessages = (msgs: ChatMessage[]) => {
    setMessages(msgs);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_coach_history', data: msgs }) });
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_coach_settings', data: { apiKey: key } }) });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    const updatedMsgs = [...messages, userMsg];
    saveMessages(updatedMsgs);
    setInput('');
    setIsLoading(true);

    try {
      if (!apiKey) {
        // Mock response when no API key
        await new Promise(r => setTimeout(r, 1000));
        const mockResponse = getMockResponse(text);
        const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: mockResponse, timestamp: new Date().toISOString() };
        saveMessages([...updatedMsgs, aiMsg]);
      } else {
        // Real API call (OpenAI compatible)
        const systemPrompt = `คุณเป็น Bboy Coach ผู้เชี่ยวชาญการเต้น Breakdance / Breaking มาหลายปี คุณให้คำแนะนำเรื่องการฝึกซ้อม ท่าเต้น การออกกำลังกาย โภชนาการ และการป้องกันการบาดเจ็บ ตอบเป็นภาษาไทยที่เข้าใจง่าย ใช้ emoji ประกอบ`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...updatedMsgs.slice(-10).map(m => ({ role: m.role, content: m.content })),
            ],
            max_tokens: 1000,
          }),
        });

        const data = await response.json();
        const aiContent = data.choices?.[0]?.message?.content || 'ขอโทษ ไม่สามารถตอบได้ในตอนนี้';
        const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent, timestamp: new Date().toISOString() };
        saveMessages([...updatedMsgs, aiMsg]);
      }
    } catch (err) {
      const errMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', timestamp: new Date().toISOString() };
      saveMessages([...updatedMsgs, errMsg]);
    }

    setIsLoading(false);
  };

  const clearChat = () => { saveMessages([]); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, height: 'calc(100vh - 200px)', minHeight: 500 }}>
      {/* Chat Area */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Bboy AI Coach</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                {apiKey ? '🟢 เชื่อมต่อ OpenAI แล้ว' : '🟡 โหมด Demo (ใส่ API Key เพื่อใช้จริง)'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowSettings(!showSettings)} style={iconBtnStyle} title="ตั้งค่า">⚙️</button>
            <button onClick={clearChat} style={iconBtnStyle} title="ล้างแชท">🗑️</button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{ padding: '12px 20px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.5 }}>OpenAI API Key</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => { saveApiKey(apiKey); setShowSettings(false); }} style={{
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}>บันทึก</button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🕺</div>
              <div style={{ fontSize: '0.9rem' }}>สวัสดีครับ! ผม AI Coach Bboy</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>ถามเรื่องการฝึก ท่าเต้น หรืออะไรก็ได้เลย</div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #ef4444, #f97316)'
                  : 'var(--bg-main)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-main)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 20px', borderRadius: '16px 16px 16px 4px',
                background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                fontSize: '0.9rem',
              }}>
                <span className="animate-pulse" style={{ opacity: 0.5 }}>🤔 กำลังคิด...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: 8,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="ถามอะไรก็ได้..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 20px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff',
              cursor: isLoading ? 'wait' : 'pointer', fontWeight: 700,
              opacity: isLoading || !input.trim() ? 0.5 : 1,
            }}
          >📤</button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          borderRadius: 20, padding: 20, color: '#fff',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 4 }}>🤖 AI Coach</div>
          <div style={{ fontSize: '0.78rem', opacity: 0.8, lineHeight: 1.5 }}>
            ถาม AI เรื่องการฝึกเต้น ออกกำลังกาย โภชนาการ หรือแผนการซ้อม
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 16,
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700 }}>⚡ คำถามด่วน</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {QUICK_PROMPTS.map((qp, i) => (
              <button
                key={i}
                onClick={() => sendMessage(qp.prompt)}
                style={{
                  padding: '8px 12px', borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'transparent', cursor: 'pointer',
                  color: 'var(--text-main)', fontSize: '0.78rem',
                  textAlign: 'left', transition: 'all 0.15s ease',
                  fontWeight: 500,
                }}
              >{qp.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMockResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('ตาราง') || q.includes('สัปดาห์')) {
    return `📋 แนะนำตารางซ้อม Bboy สัปดาห์นี้:

🔵 จันทร์ — Toprock & Footwork (60 นาที)
- Indian Step, Cross Over, Kick Out
- 6-Step, CC, 3-Step

🔴 อังคาร — Power Moves (90 นาที)
- Backspin drill, Baby Freeze → Chair Freeze
- Windmill progression

🟢 พุธ — วันพัก + Stretch (30 นาที)

🟡 พฤหัสบดี — Freeze & Foundation (60 นาที)
- Air Chair, Nike, Headstand
- Toprock combinations

🔴 ศุกร์ — Power Moves + Transitions (90 นาที)
- Windmill, Flare basics
- Link everything together

🟠 เสาร์ — freestyle + battle practice (60 นาที)

🟢 อาทิตย์ — Active recovery + stretch

💡 เริ่มต้นทุก session ด้วย warm up 10 นาที!`;
  }
  if (q.includes('windmill') || q.includes('วินด์มิลล์')) {
    return `🔄 วิธีฝึก Windmill ตั้งแต่เริ่มต้น:

1️⃣ **ท่าเตรียม** — ฝึก Backspin ให้คล่องก่อน
2️⃣ **Baby Freeze** — ฝึก balance บน floor
3️⃣ **Shoulder Roll** — นอนหลังแล้วกลิ้งไปมา
4️⃣ **Open Legs** — เปิดขากว้างเวลา roll
5️⃣ **Full Windmill** — รวมทุกอย่างเข้าด้วยกัน

⚠️ สำคัญ: ฝึกบนพื้นเรียบ ใช้ Beanie ป้องกันหัว
💪 ท่าเสริม: Push-up, Plank, Shoulder Press`;
  }
  if (q.includes('อาหาร') || q.includes('โภชนาการ')) {
    return `🍎 แผนอาหารสำหรับ Bboy:

🌅 **เช้า**: ไข่ต้ม 2-3 ฟอง + ข้าวโอ๊ต + กล้วย
🌞 **กลางวัน**: อกไก่/ปลา + ข้าวกล้อง + ผักรวม
🌙 **เย็น**: สลัดไก่ย่าง + ถั่ว + ผลไม้

💧 ดื่มน้ำ 2-3 ลิตร/วัน
🥛 Whey Protein หลังซ้อม
🚫 ลดน้ำตาล ของทอด ฟาสต์ฟูด

เป้าหมาย: Protein 1.5g/kg น้ำหนักตัว`;
  }
  return `🕺 Bboy AI Coach พร้อมช่วย!

ตอนนี้คุณถามเรื่อง: "${query.slice(0, 50)}..."

💡 ผมสามารถช่วยได้เรื่อง:
- 📋 วางตารางซ้อม
- 🔄 เทคนิคท่าเต้น
- 💪 แผนออกกำลังกาย
- 🍎 โภชนาการ
- 🧘 การยืดเหยียด

⚙️ ใส่ OpenAI API Key เพื่อใช้ AI จริง → กดปุ่มเกียร์ (⚙️) ด้านบน`;
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-color)',
  borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem',
};
const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border-color)', background: 'var(--bg-main)',
  color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};
