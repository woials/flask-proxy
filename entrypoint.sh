#!/bin/sh
set -e

# このshellがあるディレクトリに移動　$0は自分自身のパスを表す
# ""で囲うと、$の変数を展開しつつ空白も1つのものとして扱う
# (My Projectの場合"My Project"になるが、""がない場合は"My" "Project"になる)
cd "$(dirname "$0")"

echo "tailscaleを起動しています..."
tailscale up

# funnel_initializedファイルが存在しない場合
if [ ! -f .funnel_initialized ]; then
    echo "tailscale funnelを開始しています..."
    # tailscale funnelをバックグラウンドで起動
    tailscale funnel --bg localhost:5000
    # touchコマンドでfunnel_initializedファイルを作成
    touch .funnel_initialized
fi

exec ./venv/bin/gunicorn -k gevent -w 4 \
    --timeout 300 \
    --keep-alive 10 \
    -b 0.0.0.0:5000 \
    --access-logfile - \
    --error-logfile - \
    main:app