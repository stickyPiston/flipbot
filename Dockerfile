FROM node:lts-alpine as build

WORKDIR /home/flipbot
COPY . .

RUN apk add python3 make opus-dev g++
RUN npm install

FROM node:lts-alpine

WORKDIR /home/flipbot

RUN apk add ffmpeg

COPY --from=build /home/flipbot /home/flipbot/

CMD [ "npm", "start" ]