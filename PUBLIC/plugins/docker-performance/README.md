# Plugin: Docker Performance — Оптимизация сборки

> **Версия:** 1.0.0
> **Slug:** `docker-performance`
> **Категория:** DevOps

---

## Обзор

Набор проверенных оптимизаций для Docker-сборки проектов с React/Node.js frontend. Решает типичные проблемы на VPS с ограниченной памятью (1–4 ГБ RAM).

---

## Проблема 1: OOM Kill при `npm run build` в Docker

### Симптомы

```
=> ERROR [frontend-builder 6/6] RUN npm run build    75.9s
failed to execute bake: read |0: file already closed
```

Или:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

### Причина

`react-scripts build` (webpack) потребляет 1–2 ГБ RAM при сборке. Когда Docker BuildKit собирает несколько сервисов параллельно, суммарное потребление превышает доступную память, и Node.js процесс убивается OOM Killer.

Ошибка `read |0: file already closed` — это следствие: BuildKit теряет pipe к убитому процессу.

### Решение: Dockerfile

Добавить **перед** `RUN npm run build`:

```dockerfile
# --- Stage 1: Frontend build ---
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

# >>> Оптимизация памяти <<<
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=512

RUN npm run build
```

| Переменная | Значение | Эффект |
|-----------|----------|--------|
| `GENERATE_SOURCEMAP=false` | Отключает source maps | Снижает потребление RAM на ~30–40%, убирает .map файлы из production |
| `NODE_OPTIONS=--max-old-space-size=512` | Ограничивает V8 heap до 512 МБ | Предотвращает неконтролируемый рост памяти webpack |

### Подбор `max-old-space-size`

| RAM сервера | Параллельных сервисов | Рекомендуемое значение |
|------------|----------------------|----------------------|
| 1 ГБ | 1 | `256` |
| 2 ГБ | 1–2 | `384`–`512` |
| 4 ГБ | 3–5 | `512`–`768` |
| 8+ ГБ | любое | `1024` или не ограничивать |

---

## Проблема 2: Параллельная сборка на слабых серверах

### Симптомы

`docker compose build` собирает все сервисы параллельно (BuildKit по умолчанию). На VPS с 1–4 ГБ RAM это приводит к OOM даже с ограничением heap.

### Решение: Последовательная сборка тяжёлых сервисов

В deploy-скрипте:

```bash
# Сначала собираем сервисы с frontend (тяжёлые)
echo "Building UAM (frontend + backend)..."
docker compose build uam

# Затем остальные (backend-only, лёгкие) — параллельно
echo "Building remaining services..."
docker compose build registry security monitoring billing wallet
```

С флагом `--no-cache`:

```bash
docker compose build --no-cache uam
docker compose build --no-cache registry security monitoring billing wallet
```

### Альтернатива: Ограничение параллелизма BuildKit

```bash
# Максимум 2 параллельных сборки
COMPOSE_PARALLEL_LIMIT=2 docker compose build
```

Или через переменную окружения:

```bash
export COMPOSE_PARALLEL_LIMIT=1  # Полностью последовательная сборка
docker compose build
```

---

## Проблема 3: Нехватка RAM на VPS

### Решение: Swap file

Если сервер имеет менее 4 ГБ RAM, добавьте swap:

```bash
# Создать swap 2 ГБ
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Сделать постоянным (переживёт перезагрузку)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Проверить
free -h
```

### Рекомендуемый размер swap

| RAM сервера | Swap |
|------------|------|
| 1 ГБ | 2 ГБ |
| 2 ГБ | 2 ГБ |
| 4 ГБ | 2 ГБ |
| 8+ ГБ | 1 ГБ (или без swap) |

---

## Проблема 4: Несуществующие иконки @ant-design/icons

### Симптомы

```
Failed to compile.
Attempted import error: 'ShieldFilled' is not exported from '@ant-design/icons'
```

### Причина

Некоторые имена иконок не существуют в `@ant-design/icons` v5. Частые ошибки:

| Неверное имя | Правильная замена | Описание |
|-------------|-------------------|----------|
| `ShieldFilled` | `SafetyCertificateFilled` | Щит с галочкой |
| `ShieldOutlined` | `SafetyCertificateOutlined` | Щит (контур) |
| `SecurityFilled` | `SecurityScanFilled` | Щит с лупой |
| `ShieldCheckFilled` | `SafetyCertificateFilled` | Щит с галочкой |

### Проверка доступных иконок

```bash
# Показать все экспорты из @ant-design/icons
node -e "const icons = require('@ant-design/icons'); console.log(Object.keys(icons).filter(k => /shield|security|safe/i.test(k)).join('\n'))"
```

Доступные иконки (shield-подобные) в v5:
- `SafetyCertificateFilled` — щит с галочкой (filled)
- `SafetyCertificateOutlined` — щит с галочкой (outlined)
- `SafetyCertificateTwoTone` — щит с галочкой (двухцветный)
- `SafetyOutlined` — общая безопасность
- `SecurityScanFilled` — щит с лупой (filled)
- `SecurityScanOutlined` — щит с лупой (outlined)
- `SecurityScanTwoTone` — щит с лупой (двухцветный)

### Решение: Массовая замена

```bash
# Найти все файлы с проблемной иконкой
grep -r "ShieldFilled" --include="*.js" --include="*.jsx" --include="*.tsx" -l

# Заменить во всех файлах
sed -i 's/ShieldFilled/SafetyCertificateFilled/g' $(grep -r "ShieldFilled" --include="*.js" -l)
```

---

## Проблема 5: Медленная пересборка Docker-образов

### .dockerignore

Каждый модуль должен иметь `.dockerignore` для исключения лишних файлов из контекста сборки:

```dockerignore
frontend/node_modules
backend/node_modules
deploy
*.md
.git
.env
.env.*
```

### Оптимизация слоёв Dockerfile

Правильный порядок COPY для максимального использования кэша:

```dockerfile
# 1. Сначала файлы зависимостей (меняются редко)
COPY frontend/package*.json ./
RUN npm install

# 2. Затем исходный код (меняется часто)
COPY frontend/ .

# 3. Затем сборка
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm run build
```

Если поменять порядок (COPY всего сразу), Docker не сможет использовать кэш `npm install` при изменении исходников.

---

## Чеклист для нового проекта

При добавлении нового модуля с React frontend в Docker:

- [ ] Добавить `GENERATE_SOURCEMAP=false` в Dockerfile
- [ ] Добавить `NODE_OPTIONS=--max-old-space-size=512` в Dockerfile
- [ ] Создать `.dockerignore` с исключением `node_modules`
- [ ] Разделить `COPY package*.json` и `COPY .` для кэширования слоёв
- [ ] В deploy-скрипте: собирать frontend-сервисы отдельно (до backend-only)
- [ ] Проверить наличие swap на production сервере
- [ ] Проверить что все импорты `@ant-design/icons` используют существующие имена

---

## Пример: Полный оптимизированный Dockerfile

```dockerfile
# ============================================================
# Multi-stage Dockerfile для React + Node.js
# Оптимизирован для серверов с ограниченной памятью (1–4 ГБ)
# ============================================================

# --- Stage 1: Frontend build ---
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# Кэширование npm install (меняется редко)
COPY frontend/package*.json ./
RUN npm install

# Исходный код (меняется часто)
COPY frontend/ .

# Оптимизация памяти при сборке
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm run build

# --- Stage 2: Backend runtime ---
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ .

# Статика из Stage 1
COPY --from=frontend-builder /frontend/build /app/frontend/build

ENV NODE_ENV=production
EXPOSE 8060

CMD ["node", "src/server.js"]
```

---

## Changelog

### 1.0.0 (2026-02-09)
- Документация по оптимизации Docker-сборки React/Node.js
- Решение OOM kill при `npm run build` (GENERATE_SOURCEMAP, NODE_OPTIONS)
- Стратегия последовательной сборки тяжёлых сервисов
- Справочник по замене несуществующих @ant-design/icons
- Чеклист для новых проектов
- Рекомендации по swap и .dockerignore

---

## UI Compliance (Header v1.1.0)

Если модуль имеет web-интерфейс с аккаунт-меню в правом верхнем углу, обязательно соблюдается единый стандарт экосистемы:

- профиль (имя + email)
- баланс кошелька из `https://billing.markbase.ru/api/billing/balance`
- пункты: аккаунт/безопасность, уведомления, кошелек, тарифы/биллинг, помощь, выход
- переходы на другие поддомены помечаются тегом `внешняя`

Источник стандарта:

- `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER.md`
- `markbaseCORE/INTEGRATION/MARKBASE/design/header.json`
- `markbaseCORE/INTEGRATION/MARKBASE/design/HEADER_CHECKLIST.md`

