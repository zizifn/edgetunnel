FROM v2fly/v2fly-core:latest

# ADD configure.sh /configure.sh

# RUN apk add --no-cache ca-certificates curl unzip \
#     && chmod +x /configure.sh

# CMD /configure.sh

ADD v2rayconf.sh /v2rayconf.sh

ARG UUID
ENV UUID=$UUID

RUN touch /etc/v2ray/config.json
RUN /v2rayconf.sh

CMD [ "/usr/bin/v2ray", "-config", "/etc/v2ray/config.json" ]
