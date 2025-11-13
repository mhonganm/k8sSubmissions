FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk update \
    && apk add --no-cache curl wget openssl \
    && rm -rf /var/cache/apk/*

COPY package*.json ./

RUN npm install --production

COPY app.js .
COPY public ./public

EXPOSE 3000

CMD ["node", "app.js"]

