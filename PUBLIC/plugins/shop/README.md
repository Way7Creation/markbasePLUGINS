# MarkBase Shop — API Plugin

Мультитенантный интернет-магазин. Каталог, корзина, чекаут (B2B/B2C), управление компаниями, AI-поиск, распознавание документов, Telegram-бот.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `shop` |
| Версия | 1.0.2 |
| Порт | 8020 |
| Домен | `shop.markbase.ru`, `*.shop.markbase.ru` |
| API Base | `https://shop.markbase.ru/api/shop/v1` |
| Категория | ecommerce |
| Зависимости | `uam`, `registry` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `shop_id`.

Shop — самый многоуровневый модуль изоляции:
- Каждый магазин работает на собственном поддомене (`*.shop.markbase.ru`) или кастомном домене
- `shop_id` определяется автоматически из `X-Shop-Id`, домена или query-параметра
- Каталоги, корзины, заказы, клиенты, шаблоны — всё изолировано по `shop_id`
- Поддержка кастомных доменов клиентов
- **Покупатели одного магазина не видят данные другого**

```
shop-a.shop.markbase.ru → shop_id: abc-123 → каталог, корзина, заказы магазина A
shop-b.shop.markbase.ru → shop_id: def-456 → каталог, корзина, заказы магазина B
mystore.ru (custom)     → shop_id: ghi-789 → каталог, корзина, заказы на кастомном домене
```

---

## Авторизация

### Покупатели
Авторизуются через **WaySenID** (единый аккаунт):
- Cookie `uam_session` на домене `.markbase.ru`
- Один аккаунт → доступ ко всем магазинам на платформе
- Покупателю не нужно регистрироваться отдельно в каждом магазине

### Межмодульные запросы
HMAC-SHA256 с заголовками: `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Shop-Id`.

---

## API Endpoints

### Каталог

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/catalog` | Каталог товаров |
| GET | `/api/shop/v1/products/:id` | Карточка товара |
| GET | `/api/shop/v1/categories` | Категории |
| GET | `/api/shop/v1/search` | AI-поиск товаров |

### Корзина

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/cart` | Получить корзину |
| POST | `/api/shop/v1/cart/items` | Добавить в корзину |
| PATCH | `/api/shop/v1/cart/items/:item_id` | Изменить количество |
| DELETE | `/api/shop/v1/cart/items/:item_id` | Удалить из корзины |
| DELETE | `/api/shop/v1/cart` | Очистить корзину |

### Чекаут

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/shop/v1/checkout/b2b` | B2B заказ (юр. лица) |
| POST | `/api/shop/v1/checkout/b2c` | B2C заказ (физ. лица) |
| POST | `/api/shop/v1/checkout` | Начать чекаут |
| POST | `/api/shop/v1/checkout/initiate` | Валидация корзины |
| POST | `/api/shop/v1/checkout/confirm` | Подтверждение заказа |
| POST | `/api/shop/v1/checkout/delivery-options` | Варианты доставки |
| GET | `/api/shop/v1/checkout/:session_id` | Сессия чекаута |
| PATCH | `/api/shop/v1/checkout/:session_id` | Обновить сессию |
| POST | `/api/shop/v1/checkout/:session_id/complete` | Завершить чекаут |

### Заказы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/orders` | Список заказов |
| GET | `/api/shop/v1/orders/:order_id` | Детали заказа |
| POST | `/api/shop/v1/orders/:order_id/cancel` | Отменить заказ |
| POST | `/api/shop/v1/orders/:id/to-invoice` | Конвертировать в счёт |

### Профиль покупателя

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/me` | Профиль |
| GET | `/api/shop/v1/me/orders` | Мои заказы |
| GET | `/api/shop/v1/me/orders/:order_id` | Мой заказ |
| GET | `/api/shop/v1/me/addresses` | Мои адреса |
| POST | `/api/shop/v1/me/addresses` | Добавить адрес |

### Компании (B2B)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/companies` | Мои компании |
| POST | `/api/shop/v1/companies` | Создать компанию |
| GET | `/api/shop/v1/companies/:id` | Детали компании |
| PUT | `/api/shop/v1/companies/:id` | Обновить |
| POST | `/api/shop/v1/companies/:id/invite` | Пригласить в компанию |
| POST | `/api/shop/v1/companies/accept-invite` | Принять приглашение |

### Документы (AI)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/shop/v1/documents/upload` | Загрузить документ |
| GET | `/api/shop/v1/documents` | Список документов |
| GET | `/api/shop/v1/documents/:id` | Результат обработки |
| POST | `/api/shop/v1/documents/:id/add-to-cart` | Добавить товары в корзину |

### ПВЗ

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/pickup-points` | Пункты выдачи |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/shop/v1/health` | Health check |

---

## Ключевые возможности

### B2B Чекаут
Корпоративные заказы с юридическими реквизитами, формированием спецификаций и счетов на оплату.

### AI-поиск (WayGPT)
Умный поиск товаров через WayGPT AI с автоматическим фоллбэком на PostgreSQL full-text search.

### Распознавание документов
Загрузка PDF, Excel, фотографий → AI-распознавание → автоматический подбор товаров из каталога → добавление в корзину.

### Шаблоны витрин
Версионированные HTML+CSS шаблоны для кастомизации витрины магазина.

### Telegram-бот
Интеграция с Telegram для приёма заказов через бота.

---

## Подключение

```bash
# 1. Получите API-ключ
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"shop"}'

# 2. Получите каталог
curl "https://shop.markbase.ru/api/shop/v1/catalog" \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID"
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| Orders | Shop → Orders | Заказы передаются на закупку |
| CRM | Shop → CRM | Клиенты и заказы синхронизируются |
| Logistics | Shop → Logistics | Создание логистических заказов |
| Delivery | Shop → Delivery | Расчёт тарифов при чекауте |
| MarkBase | MarkBase → Shop | Получение каталога товаров |
| WayGPT | Shop → WayGPT | AI-поиск и распознавание |

---

## Docker

```yaml
# Внутри Docker-стека
SHOP_URL=http://shop:8020

# Из внешних проектов
SHOP_URL=https://shop.markbase.ru
```
