FROM v2fly/v2fly-core:latest

RUN apk add nginx
RUN apk add gettext

COPY html /root/html/

COPY config.json.tp /root/
COPY nginx.template.conf /root/

ADD startup.sh /startup.sh
RUN chmod +x /startup.sh

CMD /startup.sh


