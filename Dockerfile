# Сайт игры «Фестиваль ИИ»: стартовая страница + игра + счётчик посещений.
# Сборка и запуск:  docker compose up --build   →  http://localhost:8090 (порт — в docker-compose.yml)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data RUN_AS_UID=1000

# Сервер и стартовая страница.
COPY web/ ./web/
# Готовая игра (один файл, всё внутри) и картинки для страницы (портреты героев, Совёнок, плакат).
COPY TEMA_1.html ./
COPY games/TEMA_1/assets/portraits ./games/TEMA_1/assets/portraits
COPY games/TEMA_1/assets/owl ./games/TEMA_1/assets/owl
COPY games/TEMA_1/assets/icons ./games/TEMA_1/assets/icons
COPY games/TEMA_1/assets/posters ./games/TEMA_1/assets/posters

# Счётчик хранится в томе /data — не обнуляется при пересборке и перезапуске.
RUN mkdir -p /data && chown node:node /data
# USER не задаём: сервер сам отдаёт /data пользователю node (uid 1000) и понижает права при старте.
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "web/server.js"]
