import re

from flask import Response, request
import requests
INVIDIOUS_URL="http://localhost:3000"
def proxy(path):
    print(f"DEBUG path={path!r}")
    url=f"{INVIDIOUS_URL}/{path}"
    if request.query_string:
        url+=f"?{request.query_string.decode("utf-8")}"
    headers = {key: value for (key, value) in request.headers if key.lower() != 'host'}
    
    try:
        resp=requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            stream=True
        )
    except requests.exceptions.RequestException as e:
        return f"Proxy Error:{e}, 502"
    excluded_headers=["content-encoding","transfer-encoding","connection"]
    response_headers = [
        (name, value) for (name, value) in resp.raw.headers.items()
        if name.lower() not in excluded_headers
    ]
    content_type=resp.headers.get("Content-Type","")
    print(f"DEBUG content_type={content_type!r}")
    
    if path.startswith("watch") and "text/html" in content_type:
        body = resp.content.decode("utf-8", errors="replace")
        # Invidious純正の強制ページ遷移ロジックを無効化
        count = body.count('"play_next"')
        print(f"DEBUG play_next occurrences={count}")
        body, n = re.subn(r'("play_next"\s*:\s*)true', r'\1false', body)
        print(f"DEBUG play_next replaced={n}")
        print(f"DEBUG has_body_close_tag={'</body>' in body}")
        # ES6の機能が使えるか判定
        injection =injection = "<script src='/static/js/feature_check.js'></script></body>"
        body = body.replace("</body>", injection)
        html_headers = [h for h in response_headers if h[0].lower() != "content-length"]
        return Response(body, resp.status_code, html_headers, content_type=content_type)
    return Response(resp.iter_content(chunk_size=8192),resp.status_code,response_headers)