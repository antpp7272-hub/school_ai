# Vachiralai School AI — Pink & White UX/UI Edition

ชุดนี้เป็นเว็บ Flask พร้อมอัปเกรด UX/UI สำหรับคอมพิวเตอร์และโทรศัพท์มือถือ

## โครงสร้างไฟล์

vachiralai_school_ai_complete/
├─ app.py
├─ school_data.json
├─ requirements.txt
├─ render.yaml
├─ .env.example
├─ templates/
│  └─ index.html
└─ static/
   ├─ css/
   │  └─ style.css
   ├─ js/
   │  └─ app.js
   └─ images/
      └─ logo.svg

## จุดที่อัปเกรด

- ธีมชมพู–ขาวตามสีโรงเรียน
- Responsive รองรับมือถือ แท็บเล็ต และคอมพิวเตอร์
- Hero section และส่วนข้อมูลโรงเรียน
- Quick questions
- Loading/typing indicator
- ปุ่มคัดลอกคำตอบ
- ปุ่มเริ่มแชตใหม่
- เก็บประวัติแชตแยกในเบราว์เซอร์ของผู้ใช้
- ป้องกันประวัติผู้ใช้หลายคนปะปนกัน
- โหลด school_data.json ใหม่อัตโนมัติเมื่อไฟล์เปลี่ยน
- รองรับ Gemini model สำรอง
- Health check สำหรับ Render

## เปลี่ยนเป็นโลโก้จริง

ไฟล์ `static/images/logo.svg` ในชุดนี้เป็นโลโก้ VL ชั่วคราว เพราะยังไม่ได้รับไฟล์ตราโรงเรียนจริง

วิธีเปลี่ยน:
1. เตรียมโลโก้โรงเรียนพื้นหลังโปร่งใส
2. ถ้าเป็น SVG ให้แทนที่ไฟล์ `static/images/logo.svg` ได้ทันที
3. หากเป็น PNG ให้ตั้งชื่อ `logo.png` แล้วเปลี่ยนคำว่า `images/logo.svg`
   ใน `templates/index.html` เป็น `images/logo.png`

## ทดสอบในเครื่อง

```powershell
cd "โฟลเดอร์โปรเจกต์"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

จากนั้นเปิด `.env` แล้วใส่ API Key จริง ก่อนรัน:

```powershell
python app.py
```

เปิดเบราว์เซอร์ที่:

```text
http://127.0.0.1:5000
```

## อัปเดตขึ้น GitHub และ Render

คัดลอกไฟล์ทั้งหมดไปทับโปรเจกต์เดิม แล้วรัน:

```powershell
git add .
git commit -m "Upgrade Vachiralai pink white UX UI"
git push origin main
```

ถ้า Render เปิด Auto-Deploy ไว้ ระบบจะอัปเดตอัตโนมัติ
หากไม่อัปเดต ให้กด Manual Deploy → Deploy latest commit

หลังสถานะเป็น Live ให้กด Ctrl + F5 ที่หน้าเว็บ
