FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY reader.js .

EXPOSE 3000 

CMD ["npm", "start"]
