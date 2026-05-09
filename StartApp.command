#!/bin/bash

# หาที่อยู่ของโฟลเดอร์รหัสนี้แบบอัตโนมัติ (ไม่ว่าจะอยู่ตรงไหนของเครื่อง)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=================================="
echo "🚀 กำลังเปิดโปรแกรม Bulk Video Creator"
echo "=================================="

# เช็คว่ามีโฟลเดอร์ node_modules หรือยัง ถ้ายังให้ติดตั้งก่อน (สำหรับเครื่องที่เพิ่ง Clone มา)
if [ ! -d "node_modules" ]; then
    echo "📌 ตรวจพบว่าใช้งานครั้งแรกบนเครื่องนี้ กำลังดาวน์โหลดส่วนประกอบเพิ่มเติม..."
    echo "กรุณารอสักครู่ (อาจใช้เวลา 1-3 นาทีขึ้นอยู่กับความเร็วเน็ต)..."
    npm install
    echo "✅ ติดตั้งสำเร็จ!"
    echo "=================================="
fi

echo "🌍 กำลังเรียกหน้าต่างโปรแกรม..."

# ปิด Vite เก่าของโฟลเดอร์นี้ก่อน เพื่อกัน localhost ชี้ไป process ค้าง/พอร์ตซ้อน
for PORT in 5173 5174 5175 5176 5177 5178 5179; do
    PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null)
    for PID in $PIDS; do
        CWD=$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
        if [ "$CWD" = "$DIR" ]; then
            echo "🧹 ปิดเซิร์ฟเวอร์เก่าบนพอร์ต $PORT (PID $PID)"
            kill "$PID" 2>/dev/null
        fi
    done
done

echo "✅ เปิดที่ http://127.0.0.1:5173"

# เปิดเซิร์ฟเวอร์บนพอร์ตเดิมแบบไม่ให้ Vite กระโดดไปพอร์ตอื่นเงียบ ๆ
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
