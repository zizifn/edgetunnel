FROM v2fly/v2fly-core:latest

ADD startup.sh /startup.sh
RUN chmod +x /startup.sh

CMD /startup.sh


