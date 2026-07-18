FROM node:22-alpine

WORKDIR /smoke

COPY smoke/upstream.mjs smoke/smoke-test.mjs ./
COPY bootstrap.conf.template ssl.conf.template proxy-headers.conf proxy-sse.conf docker-entrypoint.sh ./config/

USER node
