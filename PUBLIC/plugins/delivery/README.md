# MarkBase Delivery — API Plugin

Модуль доставки. Интеграция с транспортными компаниями (CDEK, Деловые Линии, ПЭК), расчёт тарифов, ПВЗ, отслеживание, QR-коды.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `delivery` |
| Версия | 1.0.0 |
| Порт | 8080 |
| Домен | `delivery.markbase.ru` |
| API Base | `https://delivery.markbase.ru/api/delivery/v1` |
| Категория | logistics |
| Зависимости | `uam`, `registry` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `shop_id`.

- Отправления привязаны к `shop_id`
- Конфигурации провайдеров (API-ключи CDEK, Dellin и пр.) привязаны к `shop_id`
- Каждый магазин может иметь свои аккаунты у провайдеров
- **Чужие отправления и данные недоступны**

---

## Авторизация

### Браузерные запросы
WaySenID SSO через cookie `uam_session` на домене `.markbase.ru`.

### Межмодульные запросы
HMAC-SHA256 с заголовками: `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Shop-Id`.

---

## Провайдеры доставки

| Провайдер | Slug | Описание |
|-----------|------|----------|
| СДЭК | `cdek` | Курьерская доставка и ПВЗ |
| Деловые Линии | `dellin` | Грузовая доставка |
| ПЭК | `pec` | Грузовая доставка |
| Яндекс.Доставка | `yandex_delivery` | Экспресс и курьерская |
| Почта России | `russian_post` | Почтовая доставка |

---

## API Endpoints

### Тарифы и города

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/delivery/v1/tariffs/calculate` | Расчёт тарифов доставки |
| GET | `/api/delivery/v1/cities` | Автодополнение городов |
| GET | `/api/delivery/v1/delivery-time` | Оценка сроков доставки |

### Пункты выдачи

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/delivery/v1/pickup-points` | Список ПВЗ в городе |

### Отправления

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/delivery/v1/shipments` | Создать отправление |
| GET | `/api/delivery/v1/shipments` | Список отправлений |
| GET | `/api/delivery/v1/shipments/:id` | Детали отправления |
| GET | `/api/delivery/v1/shipments/:id/tracking` | Отслеживание |
| GET | `/api/delivery/v1/shipments/:id/qr` | QR-код отправления |

### QR-коды

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/delivery/v1/parse-qr` | Разбор QR-кода (скан) |

### Вебхуки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/delivery/v1/webhooks/:provider` | Webhook от провайдера (CDEK, Dellin) |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/delivery/v1/health` | Health check |
| GET | `/api/delivery/v1/info` | Информация о модуле |
| GET | `/api/delivery/v1/ready` | Ready check |

---

## Пример: Расчёт тарифов

```javascript
const response = await fetch('https://delivery.markbase.ru/api/delivery/v1/tariffs/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Shop-Id': 'YOUR_SHOP_ID'
  },
  body: JSON.stringify({
    from_city: 'Москва',
    to_city: 'Санкт-Петербург',
    weight: 5.0, // кг
    dimensions: { length: 30, width: 20, height: 15 }, // см
    providers: ['cdek', 'dellin', 'pec'] // опционально
  })
});

const data = await response.json();
// data.tariffs = [{ provider: 'cdek', price: 450, days: 2 }, ...]
```

---

## Подключение

```bash
# 1. Получите API-ключ
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"delivery"}'

# 2. Рассчитайте тариф
curl -X POST https://delivery.markbase.ru/api/delivery/v1/tariffs/calculate \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"from_city":"Москва","to_city":"Казань","weight":2}'
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| Logistics | Logistics → Delivery | Logistics создаёт отправления через Delivery |
| Shop | Shop → Delivery | Расчёт тарифов при чекауте |

---

## Docker

```yaml
# Внутри Docker-стека
DELIVERY_URL=http://delivery:8080

# Из внешних проектов
DELIVERY_URL=https://delivery.markbase.ru
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

