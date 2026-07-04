from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai


# ==========================
# Configuration
# ==========================

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "school_data.json"

load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# ==========================
# Flask application
# ==========================

app = Flask(__name__)


# ==========================
# School data
# ==========================

def load_school_data() -> dict[str, Any]:
    """Load school_data.json without crashing the web service at startup."""
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError("school_data.json ต้องมีโครงสร้างหลักเป็น JSON object")

        return data
    except FileNotFoundError:
        app.logger.warning("ไม่พบไฟล์ %s", DATA_FILE)
    except (json.JSONDecodeError, ValueError) as error:
        app.logger.error("อ่าน school_data.json ไม่สำเร็จ: %s", error)

    return {}


school_data = load_school_data()


# ==========================
# Temporary in-memory history
# ==========================

chat_history: list[dict[str, str]] = []
MAX_HISTORY = 8


# ==========================
# Routes
# ==========================

@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.post("/ask")
def ask():
    global chat_history

    payload = request.get_json(silent=True) or {}
    question = str(payload.get("question", "")).strip()

    if not question:
        return jsonify({"answer": "กรุณาพิมพ์คำถามก่อนครับ 😊"}), 400

    greetings = {"สวัสดี", "หวัดดี", "hello", "hi", "hey"}
    if question.casefold() in {item.casefold() for item in greetings}:
        return jsonify(
            {
                "answer": (
                    "👋 สวัสดีครับ\n\n"
                    "ยินดีต้อนรับสู่ School AI\n\n"
                    "ผมช่วยตอบเกี่ยวกับ\n\n"
                    "📚 ข้อมูลโรงเรียน\n"
                    "👨‍🏫 คุณครู\n"
                    "🏫 อาคารเรียน\n"
                    "📅 ตารางเรียน\n"
                    "📢 ข่าวประชาสัมพันธ์\n\n"
                    "ลองถามมาได้เลยครับ 😊"
                )
            }
        )

    if client is None:
        return (
            jsonify(
                {
                    "answer": (
                        "ระบบยังไม่ได้ตั้งค่า GEMINI_API_KEY "
                        "กรุณาเพิ่มตัวแปรนี้ใน Render Environment"
                    )
                }
            ),
            503,
        )

    knowledge = json.dumps(school_data, ensure_ascii=False, indent=2)

    chat_history.append({"role": "user", "text": question})
    chat_history = chat_history[-MAX_HISTORY:]

    history_text = "\n".join(
        f"{item['role']} : {item['text']}" for item in chat_history
    )

    prompt = f"""
คุณคือ School AI ผู้ช่วยของโรงเรียน

กฎสำคัญ
1. ตอบเป็นภาษาไทยและใช้ถ้อยคำสุภาพ
2. ใช้ข้อมูล JSON ของโรงเรียนเป็นหลัก
3. คำถามทั่วไป เช่น สวัสดี ขอบคุณ หรือคุณชื่ออะไร สามารถตอบได้ตามปกติ
4. หากผู้ใช้ถามข้อมูลของโรงเรียนที่ไม่มีใน JSON ให้ตอบว่า
   \"ขออภัย ขณะนี้ยังไม่มีข้อมูลในระบบ\"
5. ตอบอย่างเป็นธรรมชาติและชัดเจน

====================
ข้อมูลโรงเรียน
{knowledge}
====================
ประวัติการสนทนา
{history_text}
====================
คำถามล่าสุด
{question}
""".strip()

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        answer = (response.text or "").strip()

        if not answer:
            answer = "ขออภัย ระบบไม่ได้รับคำตอบจาก AI กรุณาลองใหม่อีกครั้ง"
    except Exception as error:
        app.logger.exception("Gemini request failed")
        return jsonify({"answer": f"เกิดข้อผิดพลาด: {error}"}), 502

    chat_history.append({"role": "assistant", "text": answer})
    chat_history = chat_history[-MAX_HISTORY:]

    return jsonify({"answer": answer})


# ใช้เฉพาะตอนรันในเครื่อง ส่วน Render ใช้ Gunicorn ตาม Start Command
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
