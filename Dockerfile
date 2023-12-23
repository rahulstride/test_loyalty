FROM node:10-alpine

ENV PORT 80
ENV MYSQL_HOST "fabdb1.mysql.database.azure.com"
ENV MYSQL_USER "fabadmin@fabdb1"
ENV MYSQL_DB "fabdbv1"
ENV MYSQL_PASSWORD "Stride@301"
ENV MYSQL_PORT "3306"

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN npm install -g nodemon
RUN npm install

ENTRYPOINT ["nodemon", "/usr/src/app/index.js"]