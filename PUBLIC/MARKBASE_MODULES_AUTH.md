# Единый вход во всех модулях markbase.ru

> **Применимо к:** app.markbase.ru, shop.markbase.ru, delivery, logistics, crm, orders, files, hrm и всем проектам экосистемы MarkBase.

---

## 1. Принцип

Во **всех** модулях и проектах на доменах `*.markbase.ru` вход и регистрация выполняются **только через Маркбэйс id (UAM)** на auth.markbase.ru. Собственных форм ввода email/пароля и капчи на стороне модуля **не должно быть**.

- **Вход / регистрация:** кнопка **«Единый аккаунт»** + подпись **«Маркбэйс id»** и иконка пояснения → **всплывающее окно** (popup) с auth.markbase.ru/login или /register.

Вся логика (капча, подтверждение email, смена пароля и т.д.) находится на auth.markbase.ru. Настройки капчи задаются в панели captcha.markbase.ru.

**SSOT текстов кнопки:** `auth-widget/unifiedAccountContent.js`

---

## 2. Реализация на модуле (app, shop и т.д.)

### 2.1 Страница входа

- Отображать **UnifiedAccountButton** (или эквивалент по спецификации auth-widget).
- По клику: popup `https://auth.markbase.ru/login?return_url=<callback модуля>`.
- Callback отправляет `postMessage({ type: 'wsid:auth_success', to: '/dashboard' })` и закрывает popup.

### 2.2 Страница регистрации

- Та же кнопка; popup: `https://auth.markbase.ru/register?return_url=<callback>`.

### 2.3 Callback-URL модуля

`https://<модуль>.markbase.ru/auth/callback?to=<путь после входа>`.

---

## 3. Куда попадает пользователь после входа/регистрации

- **return_url** — обратно на защищённую страницу или дашборд по политике модуля.

---

## 4. Капча и настройки

- Централизованно на auth/captcha; в модулях не дублируются.

---

## 5. Итог

| Требование | Описание |
|------------|----------|
| Нет своих форм входа/регистрации | Только кнопка «Единый аккаунт / Маркбэйс id» |
| Вход через popup | auth.markbase.ru в popup с `return_url` |
| Callback | `/auth/callback?to=...` + `postMessage` |
| Один аккаунт | Маркбэйс id (UAM); cookie `uam_session` на `.markbase.ru` |
