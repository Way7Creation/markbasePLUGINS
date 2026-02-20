# MarkBase Orders — API Plugin

Модуль закупок и заказов. Управляет заказами клиентов, закупками у поставщиков (RS24, ETM), выбором складов, пакетной обработкой и спецификациями.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `orders` |
| Версия | 1.0.0 |
| Порт | 8085 |
| Домен | `orders.markbase.ru` |
| API Base | `https://orders.markbase.ru/api/orders/v1` |
| Категория | business |
| Зависимости | `uam`, `registry` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `shop_id`.

- Заказы клиентов привязаны к `shop_id`
- Конфигурации поставщиков (RS24, ETM) привязаны к `shop_id`
- Каждый магазин имеет свои аккаунты у поставщиков
- Склады и маппинг товаров изолированы по `shop_id`
- **Данные разных магазинов полностью изолированы**

---

## Авторизация

### Браузерные запросы
WaySenID SSO через cookie `uam_session` на домене `.markbase.ru`.

### Межмодульные запросы
HMAC-SHA256 с заголовками: `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Shop-Id`.

---

## Поставщики

| Поставщик | Slug | Описание |
|-----------|------|----------|
| RS24 | `rs24` | Электротехнический дистрибьютор |
| ETM | `etm` | Электротехнический дистрибьютор |

---

## API Endpoints

### Заказы клиентов

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders/v1/customer-orders` | Список заказов клиентов |
| GET | `/api/orders/v1/customer-orders/:id` | Детали заказа |
| POST | `/api/orders/v1/customer-orders` | Создать заказ |
| PATCH | `/api/orders/v1/customer-orders/:id` | Обновить заказ |

### Заказы поставщикам

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders/v1/supplier-orders` | Список закупок |
| GET | `/api/orders/v1/supplier-orders/:id` | Детали закупки |
| POST | `/api/orders/v1/supplier-orders` | Создать закупку |
| POST | `/api/orders/v1/supplier-orders/:id/send` | Отправить поставщику |

### Склады

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders/v1/warehouses` | Список складов |
| POST | `/api/orders/v1/warehouses` | Добавить склад |
| PATCH | `/api/orders/v1/warehouses/:id` | Обновить склад |

### Спецификации

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders/v1/specifications` | Список спецификаций |
| POST | `/api/orders/v1/specifications` | Создать спецификацию |
| GET | `/api/orders/v1/specifications/:id` | Детали спецификации |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders/v1/health` | Health check |
| GET | `/api/orders/v1/info` | Информация о модуле |
| GET | `/api/orders/v1/ready` | Ready check |

---

## Особенности

### Пакетная обработка заказов
Модуль поддерживает автоматическое объединение заказов клиентов в пакетные закупки у поставщиков:
- Объединение по поставщику и складу
- Учёт кратности заказа (минимальные партии)
- Автоматическая отправка по расписанию (`ORDERS_AUTO_ORDER_ENABLED=true`)

### Outbox Pattern
Гарантированная доставка событий в другие модули:
- События отправляются в CRM (обновление статусов)
- События отправляются в Logistics (создание отправлений)
- Механизм повторных попыток при недоступности получателя

---

## Подключение

```bash
# 1. Получите API-ключ
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"orders"}'

# 2. Получите список заказов
curl https://orders.markbase.ru/api/orders/v1/customer-orders \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID"
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| Shop | Shop → Orders | Заказы из магазина поступают на закупку |
| CRM | Orders → CRM | Статусы заказов синхронизируются в CRM |
| Logistics | Orders → Logistics | Заказы передаются в логистику |
| СБИС | Orders ↔ СБИС | Документооборот (счета, УПД) |

---

## Docker

```yaml
# Внутри Docker-стека
ORDERS_URL=http://orders:8085

# Из внешних проектов
ORDERS_URL=https://orders.markbase.ru
```

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

