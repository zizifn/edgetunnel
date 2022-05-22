#!/bin/sh

envsubst < /root/config.json.tp > /root/config.json
envsubst '\$PORT' < /root/nginx.template.conf > /root/nginx.conf


# Run V2Ray
if [[ $TUNNEL_TOKEN ]]; then
echo 'has tunnel token, run cloudflared tunnel'
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /root/cloudflared
chmod +x /root/cloudflared
/usr/bin/v2ray -config /root/config.json & /root/cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN & nginx -c /root/nginx.conf -g 'daemon off;'
else
/usr/bin/v2ray -config /root/config.json & nginx -c /root/nginx.conf -g 'daemon off;'
fi

