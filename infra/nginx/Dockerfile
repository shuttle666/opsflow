FROM nginx:1.27-alpine

COPY bootstrap.conf.template /etc/nginx/templates/bootstrap.conf.template
COPY ssl.conf.template /etc/nginx/templates/ssl.conf.template
COPY proxy-headers.conf /etc/nginx/snippets/proxy-headers.conf
COPY proxy-sse.conf /etc/nginx/snippets/proxy-sse.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
