# MarkBase HRM — API Plugin

Модуль управления человеческими ресурсами. Управляет сотрудниками, отделами, должностями и настройками компании.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `hrm` |
| Версия | 1.0.0 |
| Порт | 8068 |
| Домен | `hrm.markbase.ru` |
| API Base | `https://hrm.markbase.ru/api/hrm/v1` |
| Категория | business |
| Зависимости | `uam`, `registry` |

---

## Мультитенантность и изоляция данных

**Принцип**: Полная изоляция по `company_id` + `shop_id`.

Каждая компания управляет только своими данными:
- Все таблицы содержат `company_id` и `shop_id`
- SQL-запросы фильтруются по `WHERE company_id = $company_id`
- API-ключи выдаются для каждой компании
- **Данные разных компаний полностью изолированы**

```
Компания A (company_id: abc-123) → видит только своих сотрудников и отделы
Компания B (company_id: def-456) → видит только своих сотрудников и отделы
```

---

## Авторизация

### Браузерные запросы (пользователи)
WaySenID SSO через cookie `uam_session` на домене `.markbase.ru`.

### Межмодульные запросы (service-to-service)
HMAC-SHA256 с заголовками: `X-Api-Key`, `X-Timestamp`, `X-Signature`, `X-Company-Id`, `X-Shop-Id`.

```javascript
const crypto = require('crypto');

const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({ full_name: 'Иван Иванов', email: 'ivan@company.ru' });
const message = `POST\n/api/hrm/v1/employees\n${timestamp}\n${body}`;
const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');

const response = await fetch('https://hrm.markbase.ru/api/hrm/v1/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Company-Id': 'YOUR_COMPANY_ID',
    'X-Shop-Id': 'YOUR_SHOP_ID'
  },
  body
});
```

---

## API Endpoints

### Сотрудники

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/hrm/v1/employees` | Список сотрудников |
| GET | `/api/hrm/v1/employees/:id` | Получить сотрудника |
| POST | `/api/hrm/v1/employees` | Создать сотрудника |
| PATCH | `/api/hrm/v1/employees/:id` | Обновить сотрудника |
| GET | `/api/hrm/v1/employees/:id/subordinates` | Подчинённые |
| POST | `/api/hrm/v1/employees/:id/sync-crm` | Синхронизировать с CRM |
| GET | `/api/hrm/v1/employees/org-chart` | Организационная структура |

### Отделы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/hrm/v1/departments` | Список отделов |
| GET | `/api/hrm/v1/departments/:id` | Получить отдел |
| POST | `/api/hrm/v1/departments` | Создать отдел |
| PATCH | `/api/hrm/v1/departments/:id` | Обновить отдел |
| DELETE | `/api/hrm/v1/departments/:id` | Удалить отдел |

### Должности

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/hrm/v1/positions` | Список должностей |
| POST | `/api/hrm/v1/positions` | Создать должность |
| PATCH | `/api/hrm/v1/positions/:id` | Обновить должность |

### Настройки компании

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/hrm/v1/company-settings` | Получить настройки |
| PUT | `/api/hrm/v1/company-settings` | Обновить настройки |
| GET | `/api/hrm/v1/company-settings/payment-terms` | Условия оплаты |

### Вебхуки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/hrm/v1/webhooks/crm-manager` | Синхронизация менеджеров из CRM |

### Сервисные

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/hrm/v1/health` | Health check |
| GET | `/api/hrm/v1/info` | Информация о модуле |
| GET | `/api/hrm/v1/ready` | Ready check |

---

## Подключение

```bash
# 1. Получите API-ключ
curl -X POST https://registry.markbase.ru/api/registry/v1/connect \
  -H "Content-Type: application/json" \
  -d '{"project_id":"YOUR_PROJECT_UUID","module_slug":"hrm"}'

# 2. Используйте ключ
curl https://hrm.markbase.ru/api/hrm/v1/employees \
  -H "X-Api-Key: mk_xxxx" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: YOUR_HMAC" \
  -H "X-Company-Id: YOUR_COMPANY_ID"
```

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| CRM | HRM → CRM | Сотрудники синхронизируются как менеджеры |
| Shop | HRM ← Shop | Привязка сотрудников к магазинам |

---

## Docker

```yaml
# Внутри Docker-стека
HRM_URL=http://hrm:8068

# Из внешних проектов
HRM_URL=https://hrm.markbase.ru
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

