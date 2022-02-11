FROM node:17

ENV PORT 80

RUN npm install -g typescript
RUN npm install -g ts-node
# Create app directory
WORKDIR /usr/src/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm i -D
# If you are building your code for production

COPY . .

RUN npm run build

EXPOSE 80

CMD [ "node", "./build/backend/server.js" ]
