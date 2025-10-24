# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001

# Создаем директорию для данных и устанавливаем права
RUN mkdir -p /app/data && chown -R botuser:nodejs /app/data

# Переключаемся на пользователя
USER botuser

# Открываем порт (если используется webhook)
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]