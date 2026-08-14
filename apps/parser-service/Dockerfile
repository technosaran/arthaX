FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/parser-service ./apps/parser-service
WORKDIR /app/apps/parser-service
RUN npm install
EXPOSE 4004
CMD ["npm", "start"]
