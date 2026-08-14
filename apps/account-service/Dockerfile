FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/account-service ./apps/account-service
WORKDIR /app/apps/account-service
RUN npm install
EXPOSE 4001
CMD ["npm", "start"]
