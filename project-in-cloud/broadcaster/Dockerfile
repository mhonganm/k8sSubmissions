# broadcaster/Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Broadcaster typically doesn't need an exposed port if it's purely NATS-driven,
# but can be useful for health checks or future APIs.
EXPOSE 3000

# Command to run the application
CMD ["node", "app.js"]
