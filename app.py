from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
from google.genai import errors


# =========================================================
# Configuration
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "school_data.json"

load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
GEMINI_FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.1-flash-lite",
).strip()

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = Flask(__name__)


# =========================================================
# School data with automatic file reload
# =========================================================

_school_data_cache: dict[str, Any] = {}
_school_data_mtime: float | None = None


def load_school_data(force: bool = False) -> dict[str, Any]:
    """Load school_data.json and reload when the file changes."""
    global _school_data_cache, _school_data_mtime

    try:
        current_mtime = DATA_FILE.stat().st_mtime

        if (
            not force
            and _school_data_cache
            and _school_data_mtime == current_mtime
        ):
            return _school_data_cache

        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError(
                "school_data.json ต้องมีโครงสร้างหลักเป็น JSON object"
            )

        _school_data_cache = data
        _school_data_mtime = current_mtime
        return data

    except FileNotFoundError:
        app.logger.error("ไม่พบไฟล์ข้อมูล: %s", DATA_FILE)
    except (json.JSONDecodeError, ValueError) as error:
        app.logger.error("อ่าน school_data.json ไม่สำเร็จ: %s", error)
    except OSError as error:
        app.logger.error("เข้าถึง school_data.json ไม่สำเร็จ: %s", error)

    return _school_data_cache or {}


def clean_history(raw_history: Any) -> list[dict[str, str]]:
    """Accept only a small, safe conversation history from the browser."""
    if not isinstance(raw_history, list):
        return []

    cleaned: list[dict[str, str]] = []

    for item in raw_history[-8:]:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role", "")).strip().lower()
        text = str(item.get("text", "")).strip()

        if role not in {"user", "assistant"} or not text:
            continue

        cleaned.append(
            {
                "role": role,
                "text": text[:1200],
            }
        )

    return cleaned


# =========================================================
# Routes
# =========================================================

@app.get("/")
def home():
    data = load_school_data()
    school = data.get("school", {}) if isinstance(data, dict) else {}

    return render_template(
        "index.html",
        school=school,
        updated_at=data.get("updated_at", ""),
    )


@app.get("/health")
def health():
    data = load_school_data()

    return jsonify(
        {
            "status": "ok",
            "data_loaded": bool(data),
            "ai_configured": bool(client),
        }
    ), 200


@app.post("/ask")
def ask():
    payload = request.get_json(silent=True) or {}

    question = str(payload.get("question", "")).strip()
    history = clean_history(payload.get("history", []))

    if not question:
        return jsonify({"answer": "กรุณาพิมพ์คำถามก่อนครับ 😊"}), 400

    if len(question) > 600:
        return (
            jsonify(
                {
                    "answer": (
                        "คำถามยาวเกินไปครับ กรุณาย่อให้เหลือไม่เกิน "
                        "600 ตัวอักษร"
                    )
                }
            ),
            400,
        )

    greetings = {
        "สวัสดี",
        "หวัดดี",
        "สวัสดีครับ",
        "สวัสดีค่ะ",
        "hello",
        "hi",
        "hey",
    }

    if question.casefold() in {item.casefold() for item in greetings}:
        return jsonify(
            {
                "answer": (
                    "สวัสดีครับ 👋\n\n"
                    "ยินดีต้อนรับสู่ Vachiralai School AI "
                    "ผู้ช่วยข้อมูลโรงเรียนวชิราลัยยะมะกะตะ\n\n"
                    "คุณสามารถถามเรื่องเวลาเรียน การสมัครเรียน "
                    "อาคารสถานที่ ชมรม เครื่องแบบ และข้อมูลติดต่อได้ครับ"
                )
            }
        )

    if client is None:
        return (
            jsonify(
                {
                    "answer": (
                        "ระบบ AI ยังไม่ได้ตั้งค่า GEMINI_API_KEY "
                        "กรุณาเพิ่มตัวแปรนี้ใน Render Environment"
                    )
                }
            ),
            503,
        )

    school_data = load_school_data()

    if not school_data:
        return (
            jsonify(
                {
                    "answer": (
                        "ขออภัย ระบบไม่สามารถอ่านข้อมูลโรงเรียนได้ "
                        "กรุณาตรวจสอบไฟล์ school_data.json"
                    )
                }
            ),
            503,
        )

    knowledge = json.dumps(
        school_data,
        ensure_ascii=False,
        indent=2,
    )

    history_text = "\n".join(
        f"{item['role']}: {item['text']}" for item in history
    )

    prompt = f"""
คุณคือ Vachiralai School AI ผู้ช่วยข้อมูลของโรงเรียนวชิราลัยยะมะกะตะ

แนวทางการตอบ
1. ตอบเป็นภาษาไทย สุภาพ เป็นมิตร และอ่านง่าย
2. ใช้ข้อมูล JSON ที่ให้มาเป็นแหล่งข้อมูลหลัก
3. ห้ามแต่งข้อมูลเฉพาะของโรงเรียนขึ้นเอง
4. หากข้อมูลที่ผู้ใช้ถามไม่มีอยู่ใน JSON ให้ตอบว่า
   "ขออภัย ขณะนี้ยังไม่มีข้อมูลนี้ในระบบ"
5. หากคำถามกำกวม ให้ตอบจากข้อมูลที่ใกล้เคียงที่สุด
   พร้อมบอกอย่างชัดเจนว่าข้อมูลส่วนใดยังไม่ครบ
6. ตอบกระชับ แต่ให้รายละเอียดเพียงพอ
7. ใช้หัวข้อหรือรายการสั้น ๆ เมื่อช่วยให้อ่านง่าย
8. ไม่ต้องกล่าวถึง JSON, prompt หรือระบบเบื้องหลัง

====================
ข้อมูลโรงเรียน
{knowledge}
====================
ประวัติการสนทนาก่อนหน้า
{history_text or "ไม่มี"}
====================
คำถามล่าสุด
{question}
""".strip()

    models_to_try: list[str] = []

    for model_name in (GEMINI_MODEL, GEMINI_FALLBACK_MODEL):
        if model_name and model_name not in models_to_try:
            models_to_try.append(model_name)

    last_error: errors.APIError | None = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )

            answer = (response.text or "").strip()

            if answer:
                return jsonify(
                    {
                        "answer": answer,
                        "model": model_name,
                    }
                )

        except errors.APIError as error:
            last_error = error
            status_code = int(error.code or 502)

            app.logger.warning(
                "Gemini model %s failed with code %s: %s",
                model_name,
                error.code,
                error.message,
            )

            if status_code in {429, 500, 503, 504}:
                continue

            return (
                jsonify(
                    {
                        "answer": (
                            "ขออภัย ระบบ AI ไม่สามารถประมวลผลคำถามนี้ได้ "
                            "กรุณาลองใหม่อีกครั้งครับ"
                        )
                    }
                ),
                status_code,
            )

        except Exception:
            app.logger.exception(
                "Unexpected Gemini error while using %s",
                model_name,
            )
            continue

    if last_error and int(last_error.code or 0) == 429:
        return (
            jsonify(
                {
                    "answer": (
                        "ขออภัยครับ ระบบ AI ใช้งานครบตามโควตาชั่วคราว "
                        "กรุณาลองใหม่ภายหลังครับ"
                    )
                }
            ),
            429,
        )

    return (
        jsonify(
            {
                "answer": (
                    "ขออภัย ระบบ AI ขัดข้องชั่วคราว "
                    "กรุณาลองใหม่อีกครั้งครับ"
                )
            }
        ),
        502,
    )


# =========================================================
# Basic security headers
# =========================================================

@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )
    return response


# Render uses Gunicorn. This block is for local development only.
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
    )
