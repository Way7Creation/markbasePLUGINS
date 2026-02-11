# MarkBase Files v3.0 — Галерея с редактированием

Полноценный модуль загрузки, хранения, редактирования и выбора файлов для экосистемы MarkBase.

## Возможности

- **Загрузка файлов** — одиночная, множественная, массовая (bulk до 20)
- **Редактирование изображений** — кадрирование, ресайз, соотношение сторон, конвертация
- **Галерея** — привязка к сущностям (товар, заказ, контакт), пагинация, сортировка
- **Аватарки** — специальный эндпоинт `POST /avatar`, синхронизация через trigger
- **Дефолтные изображения** — подставляются автоматически, до 10 на владельца
- **File Picker** — встраиваемый через iframe выбор файлов для других модулей
- **Иконки, баннеры, логотипы** — категории для организации
- **Папки** — вложенные папки с обложками
- **Квоты** — лимиты на хранение по владельцу (5GB по умолчанию)
- **Изоляция данных** — по `owner_module + owner_id`
- **HMAC-аутентификация** — безопасные межмодульные запросы
- **Защита загрузок** — magic bytes, блокировка exe/php/sh, SVG XSS проверка
- **Rate limiting** — защита от злоупотреблений

## Редактирование изображений

Все операции неразрушающие — оригинал сохраняется.

| Операция | Endpoint | Параметры |
|---|---|---|
| Кадрирование | `POST /files/:id/crop` | `left, top, width, height` |
| Ресайз | `POST /files/:id/resize` | `width, height, fit` |
| Соотношение | `POST /files/:id/ratio` | `ratio` (1:1, 4:3, 16:9, 3:2, 9:16, 21:9) |
| Конвертация | `POST /files/:id/convert` | `format` (webp, jpeg, png, avif), `quality` |
| Метаданные | `GET /files/:id/meta` | — |

Параметр `save_as_new=true` создаст новый файл (оригинал останется).

## File Picker

Встраиваемый в iframe выбор файлов из галереи:

```html
<iframe src="https://files.markbase.ru/picker?mode=select&category=product&multiple=true"
        width="600" height="400"></iframe>
```

Параметры: `mode`, `category`, `multiple`, `mime`, `owner_module`, `owner_id`

При выборе отправляет `postMessage` в parent:
```json
{ "type": "files:selected", "files": [{ "file_id": "...", "public_url": "..." }] }
```

## Дефолтные изображения

Подставляются автоматически когда у товара нет собственных фото:

```bash
# Загрузить дефолтное изображение
POST /api/files/v1/defaults
Content-Type: multipart/form-data
file=@placeholder.png&owner_module=shop&owner_id=UUID&category=product

# Получить дефолтные
GET /api/files/v1/defaults/shop/{shopId}?category=product
```

## Массовая загрузка

```bash
POST /api/files/v1/upload/bulk
Content-Type: multipart/form-data
files[]=@img1.jpg&files[]=@img2.jpg&...&category=product&entity_type=product&entity_id=UUID
```

Возвращает: `{ files: [...], errors: [...], total, success, failed }`

## Домен и порт

| Параметр | Значение |
|----------|----------|
| Домен | `files.markbase.ru` |
| Порт | `8095` (backend), `3072` (frontend) |
| API Base | `https://files.markbase.ru/api/files/v1` |
| Uploads | `https://files.markbase.ru/uploads/{module}/{ownerId}/{category}/{file}` |

## Категории файлов

| Категория | Описание | Пример |
|-----------|----------|--------|
| `avatar` | Аватарки, фото профиля | Фото пользователя |
| `icon` | Иконки, favicons | Иконка приложения |
| `product` | Изображения товаров | Фото товара в каталоге |
| `gallery` | Альбомы, галерея | Фотоальбом проекта |
| `banner` | Баннеры, шапки | Баннер на главной |
| `logo` | Логотипы | Логотип компании |
| `document` | PDF, Word, Excel | Договор, счёт |
| `attachment` | Общие вложения (по умолчанию) | Любой файл |
| `signature` | Электронные подписи | Подпись руководителя |
| `seal` | Печати | Печать компании |
| `branding` | Брендирование | Гайдлайн бренда |
| `import` | Файлы импорта | CSV каталог товаров |
| `export` | Файлы экспорта | Выгрузка данных |
| `temp` | Временные файлы | Промежуточные файлы |

## Структура хранения на диске

```
uploads/
├── shop/
│   └── {shop_id}/
│       ├── product/    ← изображения товаров
│       ├── avatar/     ← аватарки клиентов магазина
│       ├── logo/       ← логотип магазина
│       ├── banner/     ← баннеры магазина
│       └── document/   ← документы магазина
├── crm/
│   └── {company_id}/
│       ├── avatar/     ← фото контактов
│       └── document/   ← документы клиентов
├── hrm/
│   └── {company_id}/
│       ├── avatar/     ← фото сотрудников
│       └── document/   ← документы HR
└── user/
    └── {user_id}/
        ├── avatar/     ← аватарка пользователя
        └── attachment/  ← личные файлы
```

## Быстрый старт

### 1. Загрузка файла (пользователь через SSO)

```bash
curl -X POST https://files.markbase.ru/api/files/v1/upload \
  -b "uam_session=YOUR_SESSION" \
  -F "file=@photo.jpg" \
  -F "owner_module=shop" \
  -F "owner_id=YOUR_SHOP_ID" \
  -F "category=product" \
  -F "entity_type=product" \
  -F "entity_id=PRODUCT_UUID" \
  -F "title=Фото товара" \
  -F "is_public=true"
```

### 2. Загрузка аватарки (быстрый эндпоинт)

```bash
curl -X POST https://files.markbase.ru/api/files/v1/avatar \
  -b "uam_session=YOUR_SESSION" \
  -F "file=@avatar.jpg"
```

### 3. Получение галереи товара

```bash
curl https://files.markbase.ru/api/files/v1/gallery/product/PRODUCT_UUID \
  -b "uam_session=YOUR_SESSION"
```

### 4. Межмодульная загрузка (HMAC)

```bash
curl -X POST https://files.markbase.ru/api/files/v1/service/upload \
  -H "X-Api-Key: YOUR_FILES_API_KEY" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: HMAC_SIGNATURE" \
  -F "file=@product.webp" \
  -F "owner_module=shop" \
  -F "owner_id=SHOP_UUID" \
  -F "category=product"
```

### 5. Миниатюра

```bash
# Стандартный размер (300x300)
curl https://files.markbase.ru/api/files/v1/files/FILE_ID/thumbnail

# Кастомный размер
curl "https://files.markbase.ru/api/files/v1/files/FILE_ID/thumbnail?width=150&height=150"
```

### 6. Доступ к файлу напрямую (public URL)

```
https://files.markbase.ru/uploads/shop/11111111-.../product/abc123.webp
```

Публичные URL кэшируются 90 дней (immutable).

## API Endpoints

### Пользовательские (SSO auth)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/upload` | Загрузить файл |
| POST | `/upload/multiple` | Загрузить до 10 файлов |
| POST | `/avatar` | Загрузить аватарку |
| GET | `/files` | Список файлов (с фильтрами) |
| GET | `/files/:id` | Метаданные файла |
| PATCH | `/files/:id` | Обновить метаданные |
| GET | `/files/:id/download` | Скачать файл |
| GET | `/files/:id/thumbnail` | Получить миниатюру |
| DELETE | `/files/:id` | Удалить файл |
| GET | `/gallery/:entityType/:entityId` | Галерея по сущности |
| GET | `/folders` | Список папок |
| POST | `/folders` | Создать папку |
| PATCH | `/folders/:id` | Обновить папку |
| DELETE | `/folders/:id` | Удалить папку |

### Межмодульные (HMAC auth)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/service/upload` | Загрузить от имени модуля |
| GET | `/service/files` | Список файлов модуля |
| GET | `/service/files/:id` | Получить файл модуля |
| DELETE | `/service/files/:id` | Удалить файл модуля |
| GET | `/service/gallery/:type/:id` | Галерея сущности |

### Административные

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/admin/stats` | Статистика хранилища |
| GET | `/admin/quotas` | Все квоты |
| GET | `/admin/quotas/:module/:id` | Квота владельца |
| PATCH | `/admin/quotas/:module/:id` | Обновить квоту |
| GET | `/admin/api-keys` | API ключи |
| POST | `/admin/api-keys` | Создать API ключ |
| DELETE | `/admin/api-keys/:keyId` | Отозвать ключ |

## Аутентификация

### Браузерные запросы (SSO)
Пользователь авторизуется через WaySenID. Cookie `uam_session` передаётся автоматически.

### Межмодульные запросы (HMAC)

| Заголовок | Описание |
|-----------|----------|
| `X-Api-Key` | API-ключ модуля |
| `X-Timestamp` | Unix timestamp (секунды) |
| `X-Signature` | HMAC-SHA256 подпись |

**Формула подписи:**
```
message = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + BODY
signature = HMAC-SHA256(FILES_HMAC_SECRET, message)
```

## Лимиты

| Параметр | Значение |
|----------|----------|
| Макс. размер файла | 50 MB |
| Макс. изображение | 4096x4096 px |
| Миниатюра | 300x300 px (настраиваемо) |
| Rate limit (общий) | 100 req/min |
| Rate limit (загрузка) | 30 req/min |
| Квота по умолчанию | 5 GB / 10000 файлов |

## Интеграции

| Модуль | Использование |
|--------|---------------|
| **Shop** | Изображения товаров, логотипы, баннеры |
| **CRM** | Документы контактов, аватарки |
| **Orders** | Спецификации, накладные, акты |
| **HRM** | Документы сотрудников, фото |
| **App** | Общие загрузки, импорт, брендирование |

## Переменные окружения

```env
FILES_PORT=8095
FILES_DOMAIN=files.markbase.ru
FILES_API_KEY=mk_files_api_2026_...
FILES_HMAC_SECRET=mk_files_hmac_2026_...
FILES_PUBLIC_URL=https://files.markbase.ru/uploads
FILES_MAX_FILE_SIZE=52428800
FILES_MAX_IMAGE_WIDTH=4096
FILES_MAX_IMAGE_HEIGHT=4096
UAM_URL=https://auth.markbase.ru
```

Полный список — см. `.env.example` в модуле FILES.

## Health Check

```bash
curl https://files.markbase.ru/api/files/v1/health
# → {"status":"healthy","service":"files","version":"1.0.0","checks":{"database":"ok","api":"ok"}}
```
