FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY dist dist/

CMD [ "node", "./dist/apps/node-vless/main.js" ]