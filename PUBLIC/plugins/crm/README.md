# MarkBase CRM — API Plugin

Модуль управления взаимоотношениями с клиентами. Управляет клиентами, менеджерами, заказами, активностями и документами.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `crm` |
| Версия | 1.0.0 |
| Порт | 8067 |
| Домен | `crm.markbase.ru` |
| API Base | `https://crm.markbase.ru/api/crm/v1` |
| Категория | business |
| Зависимости | `uam`, `registry` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `shop_id`.

Каждый магазин/проект работает в изолированном пространстве:
- Все таблицы содержат колонку `shop_id`
- Все SQL-запросы фильтруются по `WHERE shop_id = $shop_id`
- Индексы на `shop_id` для каждой таблицы
- API-ключи выдаются отдельно для каждого `shop_id`
- **Данные разных клиентов никогда не пересекаются**

```
Клиент A (shop_id: abc-123) → видит только своих клиентов, менеджеров, заказы
Клиент B (shop_id: def-456) → видит только своих клиентов, менеджеров, заказы
```

---

## Авторизация

### Браузерные запросы (пользователи)
Используется **WaySenID SSO** через cookie `uam_session` на домене `.markbase.ru`.

```javascript
// Запрос от фронтенда — cookie передаётся автоматически
const res = await fetch('https://crm.markbase.ru/api/crm/v1/clients', {
  credentials: 'include'
});
```

### Межмодульные запросы (service-to-service)
Подписываются **HMAC-SHA256**:

```javascript
const crypto = require('crypto');

const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({ email: 'client@example.com', shop_id: 'YOUR_SHOP_ID' });
const message = `POST\n/api/crm/v1/clients\n${timestamp}\n${body}`;
const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');

const response = await fetch('https://crm.markbase.ru/api/crm/v1/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Shop-Id': 'YOUR_SHOP_ID'
  },
  body
});
```

---

## API Endpoints

### Клиенты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/crm/v1/clients` | Список клиентов |
| GET | `/api/crm/v1/clients/:id` | Получить клиента |
| POST | `/api/crm/v1/clients` | Создать клиента |
| PATCH | `/api/crm/v1/clients/:id` | Обновить клиента |
| DELETE | `/api/crm/v1/clients/:id` | Удалить клиента |
| GET | `/api/crm/v1/clients/:id/orders` | Заказы клиента |
| POST | `/api/crm/v1/clients/:id/addresses` | Добавить адрес |
| POST | `/api/crm/v1/clients/get-or-create` | Найти или создать клиента |

### Менеджеры

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/crm/v1/managers` | Список менеджеров |
| POST | `/api/crm/v1/managers` | Создать менеджера |
| PATCH | `/api/crm/v1/managers/:id` | Обновить менеджера |
| POST | `/api/crm/v1/managers/:id/assign-client` | Назначить клиента |
| GET | `/api/crm/v1/managers/:id/clients` | Клиенты менеджера |

### Активности

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/crm/v1/activities` | Список активностей |
| POST | `/api/crm/v1/activities` | Создать активность |
| PATCH | `/api/crm/v1/activities/:id/complete` | Завершить активность |

### Документы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/crm/v1/documents` | Список документов |
| GET | `/api/crm/v1/documents/:id` | Получить документ |
| POST | `/api/crm/v1/documents` | Создать документ |
| PATCH | `/api/crm/v1/documents/:id` | Обновить документ |
| GET | `/api/crm/v1/documents/stats` | Статистика документов |
| POST | `/api/crm/v1/documents/:id/to-invoice` | Конвертировать в счёт |

### Вебхуки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/crm/v1/webhooks/orders` | Webhook заказов из Shop |
| POST | `/api/crm/v1/webhooks/order-status` | Webhook статусов из Orders |
| POST | `/api/crm/v1/webhooks/hrm-sync` | Webhook синхронизации из HRM |
| POST | `/api/crm/v1/webhooks/:provider` | Универсальный webhook |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/crm/v1/health` | Health check |
| GET | `/api/crm/v1/info` | Информация о модуле |
| GET | `/api/crm/v1/ready` | Ready check |

---

## Подключение

### 1. Получите API-ключ через Registry

```bash
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"crm"}'
```

### 2. Используйте ключ для запросов

```bash
curl https://crm.markbase.ru/api/crm/v1/clients?shop_id=YOUR_SHOP_ID \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Shop-Id: YOUR_SHOP_ID"
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| Shop | → CRM | Заказы из магазина синхронизируются в CRM |
| Orders | → CRM | Статусы закупок обновляются в CRM |
| HRM | → CRM | Сотрудники синхронизируются как менеджеры |
| Delivery | → CRM | Статусы доставки через webhook |

---

## Docker

```yaml
# Внутри Docker-стека
CRM_URL=http://crm:8067

# Из внешних проектов
CRM_URL=https://crm.markbase.ru
```
