import google.generativeai as genai

import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError("ไม่พบ GEMINI_API_KEY ในไฟล์ .env")

model = genai.GenerativeModel("gemini-1.5-flash")

response = model.generate_content(
    "สวัสดี ช่วยแนะนำตัวเองหน่อย"
)

print(response.text)