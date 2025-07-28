FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache postgresql-client

COPY package*.json ./

RUN npm install --production

COPY app.js .

EXPOSE 8080 

CMD ["npm", "start"]