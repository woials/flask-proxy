import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field,TypeAdapter
from typing import List,Literal

# Literal型は特定の値のみを許容する型を定義する
# type: Literal["start", "stop", "pause"]の場合、
# start,stop,pause以外の値を指定するとValidationErrorになる
class Paragraph(BaseModel):
    type:Literal["paragraph"]="paragraph"
    text:str

class Headline(BaseModel):
    type:Literal["headline"]="headline"
    text:str

Block=Paragraph | Headline

class GeminiArticle(BaseModel):
    title:str=Field(description="タイトル")
    summary:str=Field(description="内容の要約")
    main_text:List[Block]=Field(description="本文を構成するブロックのリスト。見出し(headline)と段落(paragraph)を適切な順番で並べてください")

load_dotenv()
client=genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_gemini_result(query,option):
    mode=None
    model=None
    match option:
        case 'minimal':
            mode=types.ThinkingConfig(thinking_level="minimal")
            model="gemini-3.1-flash-lite-preview"
        case 'high':
            mode=types.ThinkingConfig(thinking_level="high")
            model="gemini-3.1-flash-lite-preview"
        case 'light':
            mode=types.ThinkingConfig(thinking_level="high")
            model="gemini-3-flash-preview"
    response=client.models.generate_content(
        model=model,
        contents=query,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiArticle,
            thinking_config=mode
            #tools=[types.Tool(google_search=types.GoogleSearch())]
        )
    )
    json_data=response.candidates[0].content.parts[0].text
    result=TypeAdapter(GeminiArticle).validate_json(json_data)
    return result