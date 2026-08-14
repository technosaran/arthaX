FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/ai-mcp-service ./apps/ai-mcp-service
WORKDIR /app/apps/ai-mcp-service
RUN npm install
EXPOSE 4005
CMD ["npm", "start"]
