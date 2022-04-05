FROM v2fly/v2fly-core:latest

RUN wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /root/cloudflared
RUN chmod +x /root/cloudflared
ADD startup.sh /startup.sh
RUN chmod +x /startup.sh

CMD /startup.sh


