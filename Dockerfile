FROM node:14
MAINTAINER Johan Dahlberg <jfd@proxydev.se>

WORKDIR /siloapp

COPY ./index.mjs ./
COPY ./loader.mjs ./
COPY ./src ./src
COPY ./scripts ./scripts
COPY ./package.json ./
RUN npm install -g


ENTRYPOINT ["silo"]
