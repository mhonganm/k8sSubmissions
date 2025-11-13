FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY app.js .

EXPOSE 3002

CMD ["npm", "start"]