FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# Falla a propósito: tsc no está instalado (código 127), como en la pantalla 12c
RUN npm run build
EXPOSE 8080
USER node
CMD ["npm", "start"]
