FROM node:lts-alpine
WORKDIR /var/www/iwkz-backend
COPY ./ ./
RUN npm install
RUN ls -l
CMD ["npm", "start"]