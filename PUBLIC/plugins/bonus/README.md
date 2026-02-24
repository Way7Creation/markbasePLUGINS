# MarkBase Bonus — API Plugin

Модуль лояльности и промо-механик для экосистемы MarkBase: начисления, списания, возвраты, акции, скидки корзины, управление кампаниями.

---

## Основная информация

| Параметр | Значение |
|----------|----------|
| Slug | `bonus` |
| Версия | 1.0.0 |
| Порт | 8100 |
| Домен | `bonus.markbase.ru` |
| API Base | `https://bonus.markbase.ru/api/bonus/v1` |
| Категория | loyalty |
| Зависимости | `uam`, `registry`, `shop`, `orders` |

---

## Возможности

- Программы лояльности (вступление, уровни, условия)
- Начисление бонусов за покупки и события
- Списание бонусов при checkout
- Корректные возвраты и отмены (полные/частичные)
- Управление акциями и скидками (товар/корзина/сегмент)
- Поддержка сроков действия и сгорания бонусов
- Кросс-магазинный бонусный баланс пользователя (по настройке)
- Финансовый settlement между магазинами
- Несколько бонусных программ в одном кабинете (multi-program)
- Привязка программ к магазинам, сайтам и внешним ресурсам

---

## Checkout API (рекомендуемый поток)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/bonus/v1/checkout/quote` | Рассчитать лимиты списания и начисление для текущей корзины |
| POST | `/api/bonus/v1/checkout/hold` | Зарезервировать бонусы на время оформления |
| POST | `/api/bonus/v1/checkout/commit` | Финализировать списание и начисление после успешного платежа |
| POST | `/api/bonus/v1/checkout/release` | Снять резерв при отмене/ошибке |

---

## Core API

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/bonus/v1/me/balance` | Баланс пользователя |
| GET | `/api/bonus/v1/me/history` | История операций |
| GET | `/api/bonus/v1/campaigns/active` | Активные акции/предложения |
| POST | `/api/bonus/v1/programs/join` | Вступление в программу |
| POST | `/api/bonus/v1/admin/programs` | Создание программы (admin) |
| POST | `/api/bonus/v1/admin/campaigns` | Создание акции (admin) |
| GET | `/api/bonus/v1/admin/programs/:id/bindings` | Привязки программы к ресурсам |
| POST | `/api/bonus/v1/admin/programs/:id/bindings` | Создать привязку программы |
| PUT | `/api/bonus/v1/admin/bindings/:bindingId` | Обновить привязку |
| DELETE | `/api/bonus/v1/admin/bindings/:bindingId` | Удалить/деактивировать привязку |
| POST | `/api/bonus/v1/order/program-selection` | Выбор программы по ресурсу/магазину |

---

## Внутренние события (HMAC)

| Метод | Endpoint | Событие |
|-------|----------|---------|
| POST | `/api/bonus/v1/events/order-paid` | Заказ оплачен |
| POST | `/api/bonus/v1/events/order-delivered` | Заказ доставлен |
| POST | `/api/bonus/v1/events/order-cancelled` | Заказ отменен |
| POST | `/api/bonus/v1/events/order-refunded` | Возврат заказа |

Заголовки подписи:

- `X-Api-Key`
- `X-Timestamp`
- `X-Signature`

---

## Базовые правила расчета

- 1 бонус = 1 RUB
- integer-only баланс (без дробей)
- округление вниз (`floor`)
- идемпотентность для всех критичных операций
- ограничения min-margin/MRC не нарушаются даже при акциях и списании
- лимит списания `writeoff_limit_percent` в диапазоне `0..99` (99% поддерживается)

---

## Интеграции

| Модуль | Направление | Описание |
|--------|-------------|----------|
| UAM | Bonus -> UAM | Единая идентичность и SSO |
| Shop | Shop <-> Bonus | Расчеты в checkout и применение бонусов/акций |
| Orders | Orders -> Bonus | События оплаты/доставки/возвратов |
| Wallet | Bonus <-> Wallet | Опциональная конвертация/оплата сервисов |

---

## Конфигурация

| Параметр | Значение | Описание |
|----------|----------|----------|
| `BONUS_URL` | `https://bonus.markbase.ru` | Публичный URL модуля Bonus |
| `BONUS_API_KEY` | Выдается через Registry | API-ключ для межмодульных вызовов |
| `BONUS_HMAC_SECRET` | Выдается через Registry | Секрет подписи HMAC |

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
