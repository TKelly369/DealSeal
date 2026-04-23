FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps ./apps
COPY docs ./docs
RUN npm install
RUN npm run build -w @dealseal/shared
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
