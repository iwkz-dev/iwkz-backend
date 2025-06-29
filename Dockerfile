FROM node:22-alpine
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app
COPY ./ ./
RUN npm i
RUN ls -l
RUN chown -R node:node /app
CMD ["npm", "run", "start"]
