FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/budget-service ./apps/budget-service
WORKDIR /app/apps/budget-service
RUN npm install
EXPOSE 4003
CMD ["npm", "start"]
