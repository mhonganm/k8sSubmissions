FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY app.js .

EXPOSE 3000

CMD ["npm", "start"]
