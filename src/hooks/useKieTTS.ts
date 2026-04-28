import { useState } from 'react';

export interface TTSRequestOptions {
  text: string;
  voiceId?: string;
  stability?: number;
  apiKey: string;
  onLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function useKieTTS() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAudio = async ({ text, voiceId = 'Bob', stability = 0.5, apiKey, onLog }: TTSRequestOptions) => {
    setIsGenerating(true);
    setError(null);

    try {
      if (voiceId.startsWith('mac_')) {
        const macVoice = voiceId.split('_')[1];
        onLog?.(`เรียกใช้ระบบเสียง Apple MacOS Local ฟรี (นักพากย์: ${macVoice})...`, 'info');
        
        const res = await fetch(`/api/mac-tts?text=${encodeURIComponent(text)}&voice=${macVoice}`);
        const data = await res.json();
        
        if (!res.ok || data.error) {
           throw new Error(`Mac TTS Error: ${data.error} (คำแนะนำ: ถ้าเป็นเสียงผู้ชาย/เสียงพรีเมียม คุณต้องเข้าไปโหลดนักพากย์คนนั้นใน System Settings > Accessibility > Spoken Content ตามชื่อนักพากย์ก่อนนะบอส!)`);
        }
        
        onLog?.(`✅ เจาะระบบดึงเสียง macOS ${macVoice} แบบฟรีมาใช้สำเร็จ!`, 'success');
        return data;
      }

      if (!apiKey) {
        throw new Error('กรุณาระบุ Kie.ai API Key ในส่วนตั้งค่าก่อน (ถ้าใช้แบบเสียเงิน)');
      }

      onLog?.(`กำลังร้องขอคิว AI พากย์เสียง (Model: ${voiceId})...`, 'info');
      // 1. Create the async task on Kie.ai for Text-to-Speech
      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'elevenlabs/text-to-dialogue-v3',
          input: {
            dialogue: [
              {
                text: text,
                voice: voiceId
              }
            ],
            stability: stability
          }
        })
      });

      if (!createRes.ok) throw new Error(`HTTP error! status: ${createRes.status}`);

      const createData = await createRes.json();
      const taskId = createData?.data?.taskId || createData?.taskId;
      
      if (!taskId) {
        throw new Error(`ไม่ได้รับ Task ID แจ้งกลับจาก API: ${JSON.stringify(createData)}`);
      }

      onLog?.(`รอคิวประมวลผล (Task ID: ${taskId.substring(0,6)}...)`, 'info');

      // 2. Poll the recordInfo endpoint until success
      let attempt = 0;
      while (attempt < 40) { // Max 100 seconds
        await new Promise(res => setTimeout(res, 2500)); // wait 2.5 secs
        
        onLog?.(`กำลังประมวลผลเสียง... (รอ ${attempt * 2.5} วินาที)`, 'info');

        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();
        
        if (state === 'success' || state === 'completed') {
          const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
          let audioUrl = null;
          
          if (resultJsonStr) {
            try {
              const parsedResult = JSON.parse(resultJsonStr);
              audioUrl = parsedResult.audio_url || parsedResult.url || parsedResult.resultUrls?.[0] || parsedResult.audioUrl;
            } catch(e) {
              console.error("Failed to parse resultJson", e);
            }
          }
          
          if (!audioUrl || typeof audioUrl !== 'string') {
             throw new Error('ระบบแจ้งสถานะสำเร็จแล้ว แต่แยกหาลิงก์ไฟล์เสียงจากข้อมูลไม่เจอ');
          }
          
          // Estimate duration based on text length (Thai ~4 chars/sec)
          const mockDurationSeconds = Math.max(1, text.length / 4);

          onLog?.(`✅ สังเคราะห์เสียงพากย์เสร็จสมบูรณ์!`, 'success');
          return { 
            audioUrl,
            duration: Number(mockDurationSeconds.toFixed(1))
          };

        } else if (state === 'fail' || state === 'failed') {
          const reason = pollData?.data?.failMsg || pollData?.failMsg || 'Task Failed by Kie.ai backend';
          throw new Error(`การสร้างเสียงพากย์ล้มเหลว: ${reason}`);
        }
        
        attempt++;
      }

      throw new Error('หมดเวลารอ (Timeout 100s) การสร้างเสียงพากย์ตอบสนองช้าเกินไป');

    } catch (err: any) {
      onLog?.(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างเสียง');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSFX = async ({ prompt, apiKey, model }: { prompt: string, apiKey: string, model: string }) => {
    setIsGenerating(true);
    setError(null);

    // Map internal UI model ID to the proper Kie.ai model ID
    let apiModel = model;
    if (model === 'eleven_sound_effects') apiModel = 'elevenlabs/sound-effect-v2';

    try {
      if (!apiKey) throw new Error('API Key required');
      
      // 1. Create the async task on Kie.ai
      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: apiModel,
          input: {
            text: prompt,
            output_format: "mp3_44100_128",
            prompt_influence: 0.3
          }
        })
      });

      if (!createRes.ok) {
        throw new Error(`HTTP error! status: ${createRes.status}`);
      }

      const createData = await createRes.json();
      
      // Usually Kie.ai returns { code, data: { taskId } }
      const taskId = createData?.data?.taskId || createData?.taskId;
      
      if (!taskId) {
        throw new Error('ไม่ได้รับ Task ID แจ้งกลับจาก API');
      }

      // 2. Poll the recordInfo endpoint until success
      let attempt = 0;
      while (attempt < 40) { // Max 100 seconds
        await new Promise(res => setTimeout(res, 2500)); // wait 2.5 secs
        
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        const pollData = await pollRes.json();
        const state = pollData?.data?.state?.toLowerCase() || pollData?.state?.toLowerCase();
        
        if (state === 'success' || state === 'completed') {
          // Kie.ai stores the result in a stringified JSON 'resultJson' field
          const resultJsonStr = pollData?.data?.resultJson || pollData?.resultJson;
          let audioUrl = null;
          
          if (resultJsonStr) {
            try {
              const parsedResult = JSON.parse(resultJsonStr);
              // Expected formats: resultUrls array, or direct audioUrl/url
              audioUrl = parsedResult.resultUrls?.[0] || parsedResult.audioUrl || parsedResult.url || parsedResult.audio_url;
            } catch(e) {
              console.error("Failed to parse resultJson", e);
            }
          }
          
          if (!audioUrl || typeof audioUrl !== 'string') {
             throw new Error('ระบบแจ้งสถานะสำเร็จแล้ว แต่แยกหาลิงก์ไฟล์เสียงจากข้อมูลไม่เจอ');
          }
          
          return { audioUrl };
        } else if (state === 'fail' || state === 'failed') {
          const reason = pollData?.data?.failMsg || pollData?.failMsg || 'Task Failed by Kie.ai backend';
          throw new Error(`การสร้างเสียงล้มเหลว: ${reason}`);
        }
        
        // wait and try again
        attempt++;
      }

      throw new Error('หมดเวลารอ (Timeout 100s) การสร้างเสียงใช้เวลานานเกินกำหนด');

    } catch(err: any) {
      console.error("SFX Generation Error:", err);
      setError(err.message);
      return { error: err.message };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateAudio,
    generateSFX,
    isGenerating,
    error
  };
}
