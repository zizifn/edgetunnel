FROM v2fly/v2fly-core:latest

# ADD configure.sh /configure.sh

# RUN apk add --no-cache ca-certificates curl unzip \
#     && chmod +x /configure.sh

# CMD /configure.sh

ARG UUID
ENV UUID=$UUID

RUN cat > /usr/local/etc/v2ray/config.json <<'EOF' \
{ \
    "inbounds": [\
        {\
            "port": $PORT,\
            "protocol": "vmess",\
            "settings": {\
                "clients": [\
                    {\
                        "id": "$UUID",\
                        "alterId": 64\
                    }\
                ],\
                "disableInsecureEncryption": true\
            },\
            "streamSettings": {\
                "network": "ws"\
            }\
        }\
    ],\
    "outbounds": [\
        {\
            "protocol": "freedom"\
        }\
    ]\
}\
EOF

CMD [ "/usr/bin/v2ray", "-config", "/etc/v2ray/config.json" ]
