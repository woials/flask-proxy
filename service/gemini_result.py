import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field,TypeAdapter
from typing import List,Literal

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

def get_gemini_result(query):
    response=client.models.generate_content(
        model="gemini-2.5-flash",
        contents=query,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiArticle,
            #tools=[types.Tool(google_search=types.GoogleSearch())]
        )
    )
    json_data=response.candidates[0].content.parts[0].text
    result=TypeAdapter(GeminiArticle).validate_json(json_data)
    return result