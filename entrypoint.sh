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
    # 念のため既存の設定をクリア
    tailscale serve reset
    # 各サービスをtailscaleの内部ルーティングに登録
    tailscale serve https:443 / http://localhost:5000
    tailscale serve https:443 /photo http://localhost:2283
    tailscale serve https:443 /video http://localhost:8096
    # tailscale funnelをバックグラウンドで起動
    tailscale funnel 443 on
    # touchコマンドでfunnel_initializedファイルを作成
    touch .funnel_initialized
fi
. ./venv/bin/activate
exec ./venv/bin/gunicorn -k gevent -w 2 \
    --timeout 300 \
    --keep-alive 10 \
    -b 0.0.0.0:5000 \
    --access-logfile - \
    --error-logfile - \
    main:app
