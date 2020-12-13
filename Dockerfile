FROM v2fly/v2fly-core:latest

ADD configure.sh /configure.sh
RUN chmod +x /configure.sh

CMD /configure.sh


