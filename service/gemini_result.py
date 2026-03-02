import os
from dotenv import load_dotenv
from google import genai


load_dotenv()
client=genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_gemini_result():
    response=client.models.generate_content(
        model="gemini-2.5-flash",
        contents="クロスサイトリクエストフォージェリについて説明してください。"
    )
    return response.text
