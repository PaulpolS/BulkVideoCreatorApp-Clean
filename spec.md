นี่คือไฟล์ `.md` (Markdown) ที่ถอดรายละเอียดจากลายมือของคุณอย่างครบถ้วน พร้อมขยายความส่วนต่างๆ เพื่อให้คุณสามารถนำไปโยนใส่ Claude Code ให้เขียนโปรแกรมหรือวางโครงสร้างโปรเจกต์ได้ทันทีครับ

---

# Github Trends Content Automation Project

## 1. ภาพรวมโปรเจกต์ (Project Overview)

ระบบอัตโนมัติสำหรับดึงข้อมูล Repository ที่เป็นที่นิยมจาก GitHub มาสร้างเป็นเนื้อหา (Content) ในรูปแบบของบทความและภาพการ์ด (Card) สรุปข้อมูล เพื่อนำไปโพสต์หรือส่งต่อผ่าน Workflow ของ n8n

## 2. คุณสมบัติและความต้องการ (Requirements)

### 2.1 ระบบการดึงข้อมูล (Data Fetching)

* **GitHub Star Trend:** ดึงข้อมูล Repository ที่ได้รับความนิยมสูงสุด (Star Trend) ภายในรอบ **1 วัน**
* **Ranking:** ดึงข้อมูลอันดับสูงสุดจำนวน **30 อันดับ**

### 2.2 ระบบจัดการรูปภาพและดีไซน์ (Assets & Design)

* **Random Image:** มีฟังก์ชันสุ่มดึงรูปภาพจากโฟลเดอร์เก็บรูปภาพกลาง เพื่อนำมาใช้เป็นภาพประกอบ
* **Tagging System:** มีระบบใส่ Hashtag อัตโนมัติ เพื่อให้สามารถจำแนกหมวดหมู่เนื้อหาได้ถูกต้อง
* **Canvas & Templates:** * มีรูปแบบ Canvas ให้เลือกหลากหลาย
* มี Template สำเร็จรูปให้เลือกใช้งานตามความเหมาะสม


* **Branding:** รองรับการใส่ **Logo** ลงในผลงาน

### 2.3 ระบบรีวิวและแก้ไข (Review & Edit)

* **Preview Card:** หลังจากระบบประมวลผลเสร็จ ต้องแสดง "การ์ดตัวอย่าง" ให้ผู้ใช้ตรวจสอบ
* **Editability:** ผู้ใช้สามารถแก้ไขข้อมูลบนหน้าการ์ดได้
* **Card Selection:** สามารถเลือกใบที่ต้องการ (Selection) ก่อนนำไปใช้งานจริง

## 3. ขั้นตอนการทำงานและ UI (User Interface Workflow)

### ขั้นตอนที่ 1: การค้นหาและคัดเลือก

1. **Search Github:** รับค่าการค้นหาข้อมูลจาก GitHub API
2. **Select All:** มีตัวเลือกให้เลือกข้อมูลทั้งหมด (Top 30) เพื่อเข้าสู่กระบวนการต่อไป

### ขั้นตอนที่ 2: การประมวลผลเนื้อหา (Content Generation)

ระบบจะนำข้อมูลที่ได้มาส่งต่อเพื่อเขียน (Generate) เนื้อหาดังนี้:

* **Headline:** เขียนพาดหัวให้น่าสนใจ
* **Article:** เขียนเนื้อหาบทความโดยละเอียดจากข้อมูลที่ดึงมาได้
* **Details:** รวบรวมรายละเอียดสำคัญที่ค้นหามาได้

### ขั้นตอนที่ 3: การสร้างผลลัพธ์ (Output)

1. **Card Result:** สร้างภาพการ์ดสรุปผลตาม Template ที่เลือกไว้
2. **Send to n8n:** ส่งข้อมูล (JSON/Webhook) ต่อไปยัง **n8n** เพื่อรัน Workflow ต่อไป (เช่น โพสต์ลง Social Media หรือส่งเข้า Messaging App)

---

## 4. โครงสร้างฐานข้อมูล/ตัวแปรที่เกี่ยวข้อง (Data Model Reference)

* `repo_name`: ชื่อโปรเจกต์
* `stars_today`: จำนวนดาวที่เพิ่มขึ้นใน 1 วัน
* `description`: รายละเอียดโปรเจกต์
* `headline`: พาดหัวที่สร้างโดย AI
* `article_body`: เนื้อหาบทความ
* `tags`: รายรายการ Hashtag
* `image_path`: Path ของรูปที่สุ่มขึ้นมา
* `template_id`: ID ของรูปแบบ Canvas ที่เลือก

## 5. แผนการพัฒนาสำหรับ Claude Code

1. **Backend:** พัฒนาสคริปต์ Python/Node.js เพื่อดึง GitHub API (Trends)
2. **Image Processing:** ใช้ Library อย่าง Pillow หรือ Canvas API สำหรับการสร้างรูปภาพตาม Template
3. **Frontend:** สร้าง UI แบบ Simple (อาจจะใช้ Streamlit หรือ React) เพื่อให้เลือก Card และแก้ไขข้อความได้
4. **Integration:** เชื่อมต่อ Webhook กับ n8n

---

**หมายเหตุ:** คุณสามารถ Copy เนื้อหานี้ไปสร้างไฟล์ชื่อ `spec.md` แล้วสั่ง Claude Code ว่า *"Base on spec.md, please implement the project structure and the GitHub API fetching module"* ได้เลยครับ