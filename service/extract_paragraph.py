import requests
from bs4 import BeautifulSoup
from datetime import datetime
import feedparser
from zoneinfo import ZoneInfo

BASE_URL = "https://news.yahoo.co.jp"
RSS_URL=[
    "https://news.yahoo.co.jp/rss/media/tncv/all.xml",
    "https://news.yahoo.co.jp/rss/media/tvq/all.xml",
    "https://news.yahoo.co.jp/rss/media/rkbv/all.xml",
    "https://news.yahoo.co.jp/rss/media/fbsnews/all.xml",
    "https://news.yahoo.co.jp/rss/categories/domestic.xml",
    "https://news.yahoo.co.jp/rss/categories/it.xml"
]
RSS_SOURCES=["TNC","TVQ","RKB","FBS","国内","IT"]

def get_RSS_feed(index,url):
    new_cache={}
    try:
        feed=feedparser.parse(url)
        source_name=RSS_SOURCES[index]
        new_cache[source_name]=[]
        for entry in feed.entries[:20]:
            if hasattr(entry,"published_parsed") and entry.published_parsed:
                dt=datetime(*entry.published_parsed[:6], tzinfo=ZoneInfo("UTC")) #アンパック
                pub_date=dt.astimezone(ZoneInfo("Asia/Tokyo")).strftime("%Y年%m月%d日 %H:%M")
            else:
                pub_date="公開日時不明"
            item=({
                "title":entry.get("title","タイトルなし"),
                "link":entry.get("link","#"),
                "pub_date":pub_date
            })
            new_cache[source_name].append(item)
        return new_cache
    except Exception as e:
        print(f"Error occurred while fetching RSS feed: {e}")
        return {}


def extract_body(soup):
    body = soup.find(class_="article_body")
    if not body:
        return ""
    paragraphs = body.select("div > p")
    return "\n\n".join(
        p.get_text(strip=True)
        for p in paragraphs
        if len(p.get_text(strip=True)) > 15
    )

def get_next_url(soup):
    """次へリンクのURLを取得、なければNoneを返す"""
    next_link = soup.find("a", attrs={"data-cl-params": lambda v: v and "next" in v})
    if next_link and next_link.get("href"):
        return BASE_URL + next_link["href"]
    return None

def get_full_article(url):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    all_text = []

    while url:
        res = requests.get(url, headers=headers)
        res.encoding=res.apparent_encoding #日本語の文字化け対策
        soup = BeautifulSoup(res.text, "html.parser")

        text = extract_body(soup)
        if not text:
            break

        all_text.append(text)
        url = get_next_url(soup)  # 次ページURLを取得、なければNoneでループ終了

    return "\n\n".join(all_text)

if __name__ == "__main__":
    url="https://news.yahoo.co.jp/articles/2c500eef3cd9f6cc426ac4b58255993aac7451a6"
    article_text=get_full_article(url)
    print(article_text)
    with open("article.txt", "w", encoding="utf-8") as f:
        f.write(article_text)