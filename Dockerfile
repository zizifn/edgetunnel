FROM node:18-alpine

ENV NODE_ENV=production
ENV PORT=4100

WORKDIR /app

COPY dist dist/

CMD [ "node", "./dist/apps/node-vless/main.js" ]