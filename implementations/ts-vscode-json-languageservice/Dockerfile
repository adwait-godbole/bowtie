FROM node:22-alpine AS builder

COPY . /usr/src/myapp
WORKDIR /usr/src/myapp
RUN npm install
RUN npm run build

FROM node:22-alpine

WORKDIR /usr/src/myapp
COPY package*.json .
COPY --from=builder /usr/src/myapp/dist/* .
ENV NODE_ENV=production
RUN npm install
CMD ["node", "bowtie_jsonls.js"]
