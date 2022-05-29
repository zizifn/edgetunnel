#!/bin/sh

envsubst < /root/config.json.tp > /root/config.json
# envsubst '\$PORT' < /root/nginx.template.conf > /root/nginx.conf

# get random page from wikipedia
if [[ -e "/root/html/index.html" ]]; then
    echo "index.html exsit, skip genreate index page"
else
    randomurl=$(curl -L 'https://en.wikipedia.org/api/rest_v1/page/random/summary' | jq -r '.content_urls.desktop.page')
    echo $randomurl
    curl "$randomurl" -o /root/html/index.html
fi

# Run V2Ray
if [[ $TUNNEL_TOKEN ]]; then
echo 'has tunnel token, run cloudflared tunnel'
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /root/cloudflared
chmod +x /root/cloudflared
# /usr/bin/v2ray -config /root/config.json & /root/cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN & nginx -c /root/nginx.conf -g 'daemon off;'
v2ray -config /root/config.json & caddy run --config /root/Caddyfile & /root/cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN --protocol http2
else
v2ray -config /root/config.json & caddy run --config /root/Caddyfile
fi

