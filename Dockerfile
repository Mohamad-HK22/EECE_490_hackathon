FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/build ./frontend/build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "backend/server.js"]
