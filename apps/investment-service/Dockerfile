FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/investment-service ./apps/investment-service
WORKDIR /app/apps/investment-service
RUN npm install
EXPOSE 4002
CMD ["npm", "start"]
