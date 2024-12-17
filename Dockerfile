FROM node:22-alpine

# Install Git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache git

WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 3029

CMD [ "node", "index.js" ]
