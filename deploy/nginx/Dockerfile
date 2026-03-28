FROM nginx:1.27-alpine

COPY bootstrap.conf.template /etc/nginx/templates/bootstrap.conf.template
COPY ssl.conf.template /etc/nginx/templates/ssl.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
