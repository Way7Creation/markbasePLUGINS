# MarkBase Logistics — API Plugin

Модуль логистики. Управление заказами, отправлениями, возвратами, QR-кодами для выдачи и статусами.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `logistics` |
| Версия | 1.0.0 |
| Порт | 8090 |
| Домен | `logistics.markbase.ru` |
| API Base | `https://logistics.markbase.ru/api/logistics/v1` |
| Категория | logistics |
| Зависимости | `uam`, `registry`, `delivery` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `shop_id`.

- Заказы, отправления, возвраты привязаны к `shop_id`
- QR-коды и коды выдачи привязаны к конкретному заказу внутри `shop_id`
- **Данные разных магазинов полностью изолированы**

---

## Авторизация

### Браузерные запросы
WaySenID SSO через cookie `uam_session` на домене `.markbase.ru`.

### Межмодульные запросы
HMAC-SHA256 с заголовками: `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Shop-Id`.

---

## API Endpoints

### Заказы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/logistics/v1/orders` | Создать заказ (из Shop) |
| GET | `/api/logistics/v1/orders` | Список заказов |
| GET | `/api/logistics/v1/orders/:id` | Детали заказа |
| PATCH | `/api/logistics/v1/orders/:id/status` | Обновить статус заказа |
| POST | `/api/logistics/v1/orders/:id/cancel` | Отменить заказ |
| PATCH | `/api/logistics/v1/orders/:id/delivery-estimate` | Обновить сроки доставки |

### Отправления

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/logistics/v1/orders/:order_id/ship` | Создать отправление |
| GET | `/api/logistics/v1/shipments/:id/label` | Этикетка отправления |
| GET | `/api/logistics/v1/shipments/:id/tracking` | Отслеживание |
| GET | `/api/logistics/v1/shipments/:id/qr` | QR-код отправления |

### Возвраты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/logistics/v1/orders/:id/return` | Создать возврат |
| GET | `/api/logistics/v1/returns` | Список возвратов |
| GET | `/api/logistics/v1/returns/:id` | Детали возврата |

### QR-коды и выдача

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/logistics/v1/orders/:id/qr` | QR/код выдачи заказа |
| GET | `/api/logistics/v1/orders/:id/pickup-qr` | QR-код для выдачи |
| POST | `/api/logistics/v1/orders/:id/verify-code` | Проверить код выдачи |
| POST | `/api/logistics/v1/pickup/verify` | Проверить код (без order_id) |

### Вебхуки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/logistics/v1/webhooks/:provider` | Webhook от провайдера |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/logistics/v1/health` | Health check |
| GET | `/api/logistics/v1/info` | Информация о модуле |
| GET | `/api/logistics/v1/ready` | Ready check |

---

## Пример: Создание отправления

```javascript
const response = await fetch('https://logistics.markbase.ru/api/logistics/v1/orders/ORDER_ID/ship', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Shop-Id': 'YOUR_SHOP_ID'
  },
  body: JSON.stringify({
    provider: 'cdek',
    delivery_type: 'pickup', // pickup | courier
    pickup_point_id: 'PVZ-123',
    recipient: {
      name: 'Иван Иванов',
      phone: '+79001234567'
    }
  })
});
```

---

## Подключение

```bash
# 1. Получите API-ключ
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"logistics"}'

# 2. Получите список заказов
curl https://logistics.markbase.ru/api/logistics/v1/orders \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID"
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| Delivery | Logistics → Delivery | Создание отправлений через провайдеров |
| Shop | Shop → Logistics | Получение заказов из магазина |
| Orders | Orders ↔ Logistics | Синхронизация статусов заказов |

---

## Docker

```yaml
# Внутри Docker-стека
LOGISTICS_URL=http://logistics:8090

# Из внешних проектов
LOGISTICS_URL=https://logistics.markbase.ru
```
