
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY app.js .

EXPOSE 3001 

CMD ["npm", "start"]
