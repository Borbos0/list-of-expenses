# Учёт расходов

Self-hosted веб-приложение для учёта личных доходов и расходов. Работает в локальной сети, один пользователь, данные хранятся в SQLite.

## Возможности

- **Ручной ввод** операций (доход / расход / перевод / игнор)
- **Импорт из CSV и XLSX** с мастером маппинга колонок, авто-классификацией и проверкой спорных строк
- **Правила категоризации** — автоматическое назначение категорий по описанию, MCC, категории банка (contains / startsWith / regex / equals)
- **Дашборд** — KPI-карточки (доход, расход, баланс), графики доходов/расходов по дням, расходы по категориям (pie chart)
- **Дедупликация** — повторный импорт не создаёт дублей (fingerprint на основе SHA-256)
- **Бэкап и экспорт** — скачивание базы данных SQLite, экспорт операций в CSV
- **Docker** — разворачивается одним контейнером

## Технологии

| Слой | Стек |
|------|------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, Recharts, TypeScript |
| **Backend** | Fastify 5, better-sqlite3, Zod, TypeScript |
| **Shared** | npm workspaces monorepo, Zod-схемы |
| **Авторизация** | Cookie-session (httpOnly, signed), bcryptjs |
| **База данных** | SQLite (WAL mode), суммы в копейках (INTEGER) |
| **Деплой** | Docker, multi-stage build, Node.js 24 |

## Быстрый старт (разработка)

### Требования

- Node.js 24+ (рекомендуется)
- npm

### Установка

```bash
git clone <repo-url>
cd list-of-expenses
cp .env.example .env    # отредактируйте при необходимости
npm install
```

### Запуск

В двух терминалах:

```bash
# Терминал 1: бэкенд (порт 5000)
npm run dev:server

# Терминал 2: фронтенд (порт 5173, проксирует /api на 5000)
npm run dev:client
```

Откройте http://localhost:5173

Логин по умолчанию: `admin` / `admin` (задаётся в `.env`)

## Деплой на сервер (Docker)

### Требования

- Docker и Docker Compose на сервере
- Git (для клонирования)

### Шаги

1. Клонировать репозиторий на сервер:

```bash
git clone <repo-url>
cd list-of-expenses
```

2. Создать файл `.env`:

```bash
cp .env.example .env
```

3. Отредактировать `.env` — **обязательно** измените пароль и секрет сессии:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=ваш-надёжный-пароль
SESSION_SECRET=случайная-длинная-строка
DB_PATH=/data/expenses.db
PORT=5000
```

4. Запустить:

```bash
docker compose up -d --build
```

5. Приложение доступно на `http://<IP-сервера>:5000`

### Обновление

```bash
git pull
docker compose up -d --build
```

### Бэкапы

SQLite база хранится в Docker volume `expenses-data`.

**Через UI**: Настройки -> Скачать бэкап

**Через командную строку**:

```bash
# Скопировать БД из контейнера
docker cp list-of-expenses-expenses-1:/app/data/expenses.db ./backup.db
```

**Восстановление**:

```bash
docker cp ./backup.db list-of-expenses-expenses-1:/app/data/expenses.db
docker compose restart
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `AUTH_USERNAME` | Логин пользователя | `admin` |
| `AUTH_PASSWORD` | Пароль пользователя | `admin` |
| `SESSION_SECRET` | Секрет для подписи cookie | `change-me-to-random-string` |
| `DB_PATH` | Путь к файлу SQLite | `./data/expenses.db` |
| `PORT` | Порт сервера | `5000` |

## Структура проекта

```
list-of-expenses/
  shared/          # Zod-схемы, общие типы (npm workspace)
  server/          # Fastify API, SQLite, миграции
  client/          # React SPA, Tailwind, Recharts
  Dockerfile       # Multi-stage build
  docker-compose.yml
```
