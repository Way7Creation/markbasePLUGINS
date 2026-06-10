# Маркбэйс id — Полное руководство интеграции

> **Версия:** 2.0.0 | Для разработчиков внешних и внутренних сервисов  
> **Пример:** Интеграция в WayGPT (waygpt.ru)

Данный документ описывает **полный цикл** подключения авторизации Маркбэйс id к вашему сервису — от регистрации приложения до безопасного хранения токенов.

---

## Содержание

1. [Архитектура и жизненный цикл](#1-архитектура-и-жизненный-цикл)
2. [Сценарии пользователя](#2-сценарии-пользователя)
3. [Шаг 1: Регистрация приложения](#3-шаг-1-регистрация-приложения)
4. [Шаг 2: Подключение SDK](#4-шаг-2-подключение-sdk)
5. [Шаг 3: Страница входа](#5-шаг-3-страница-входа)
6. [Шаг 4: Backend — обработка callback](#6-шаг-4-backend--обработка-callback)
7. [Шаг 5: Хранение и обновление токенов](#7-шаг-5-хранение-и-обновление-токенов)
8. [Регистрация нового пользователя](#8-регистрация-нового-пользователя)
9. [Полный пример: WayGPT](#9-полный-пример-waygpt)
10. [Безопасность — чеклист](#10-безопасность--чеклист)
11. [FAQ и ошибки](#11-faq-и-ошибки)

---

## 1. Архитектура и жизненный цикл

### 1.1 Общая схема

```
   Пользователь
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                     ВАШ СЕРВИС (waygpt.ru)                   │
│                                                               │
│  Страница входа:                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │  Email              │  │                              │   │
│  │  Пароль             │  │   [🌐 Войти через Маркбэйс id]  │   │
│  │  [Войти]            │  │                              │   │
│  └─────────────────────┘  └──────────────────────────────┘   │
│       Локальный вход            OAuth 2.0 + OIDC              │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                             │
           ▼                             ▼
    Ваша БД (users)           ┌─────────────────────────┐
                              │   auth.markbase.ru       │
                              │   (Маркбэйс id Provider)    │
                              │                          │
                              │  1. Account Picker       │
                              │  2. Вход / Регистрация   │
                              │  3. Подтверждение email   │
                              │  4. Экран согласий        │
                              │  5. Возврат code          │
                              └─────────────────────────┘
```

### 1.2 Полный lifecycle (redirect-режим)

```
Пользователь           waygpt.ru (Frontend)          waygpt.ru (Backend)          auth.markbase.ru
     │                        │                              │                           │
     │── Клик «Войти через    │                              │                           │
     │   Маркбэйс id»───────────►│                              │                           │
     │                        │── GET /api/auth/wsid/init ──►│                           │
     │                        │                              │── Генерирует state,       │
     │                        │                              │   code_verifier,          │
     │                        │                              │   code_challenge          │
     │                        │                              │   Сохраняет в session     │
     │                        │◄── redirect_url ─────────────│                           │
     │◄── 302 Redirect ──────│                              │                           │
     │                        │                              │                           │
     │────────────────────────────────────────────────────────────── GET /oauth/authorize ►│
     │                        │                              │                           │
     │                        │                              │           ┌───────────────┤
     │                        │                              │           │ Есть аккаунт? │
     │                        │                              │           ├───── Да ──────┤
     │                        │                              │           │ Account Picker│
     │                        │                              │           │ или Login     │
     │                        │                              │           ├───── Нет ─────┤
     │                        │                              │           │ Регистрация + │
     │                        │                              │           │ Подтверждение │
     │                        │                              │           │ email         │
     │                        │                              │           └───────────────┤
     │                        │                              │                           │
     │                        │                              │           ┌───────────────┤
     │                        │                              │           │ Первый вход   │
     │                        │                              │           │ в waygpt.ru?  │
     │                        │                              │           ├───── Да ──────┤
     │                        │                              │           │ Consent Screen│
     │                        │                              │           │ (разрешения)  │
     │                        │                              │           └───────────────┤
     │                        │                              │                           │
     │◄─────────────────────────────────────────────── 302 redirect_uri?code=...&state= │
     │                        │                              │                           │
     │── GET /callback?code=..&state=.. ──────────────────►│                           │
     │                        │                              │── POST /oauth/token ──────►│
     │                        │                              │   (code + client_secret    │
     │                        │                              │    + code_verifier)        │
     │                        │                              │◄── access_token,          │
     │                        │                              │    refresh_token,          │
     │                        │                              │    id_token ──────────────│
     │                        │                              │                           │
     │                        │                              │── GET /oauth/userinfo ────►│
     │                        │                              │◄── { sub, name, email } ──│
     │                        │                              │                           │
     │                        │                              │── Создать/найти user      │
     │                        │                              │   в своей БД              │
     │                        │                              │── Создать сессию          │
     │◄── Set-Cookie: session ─────────────────────────────│                           │
     │◄── 302 → /dashboard ──│                              │                           │
     │                        │                              │                           │
     ▼  Пользователь          ▼                              ▼                           ▼
   авторизован
```

### 1.3 Полный lifecycle (popup-режим)

```
Пользователь           waygpt.ru (Основное окно)         Popup (auth.markbase.ru)
     │                        │                              │
     │── Клик «Войти через    │                              │
     │   Маркбэйс id»───────────►│                              │
     │                        │── window.open() ────────────►│
     │                        │   /oauth/authorize?...       │
     │                        │                              │
     │                        │   (ожидает postMessage)      │── Account Picker
     │                        │                              │── Login / Register
     │                        │                              │── Email подтверждение
     │                        │                              │── Consent Screen
     │                        │                              │
     │                        │◄── postMessage ──────────────│ { type: 'wsid:auth_success',
     │                        │   (origin check!)            │   code: '...', state: '...' }
     │                        │                              │── (popup закрывается)
     │                        │                              │
     │                        │── POST /api/auth/wsid/callback ── (отправляет code на backend)
     │                        │◄── { user, session } ────────│
     │                        │                              │
     ▼  Авторизован           ▼                              ▼
```

---

## 2. Сценарии пользователя

### Сценарий A: Пользователь УЖЕ имеет аккаунт Маркбэйс id

```
1. Открывает waygpt.ru → Нажимает «Войти через Маркбэйс id»
2. Открывается popup/redirect → auth.markbase.ru
3. Маркбэйс id видит активную сессию → показывает Account Picker
4. Пользователь выбирает аккаунт
5. Если первый раз на waygpt.ru → Consent Screen → «Разрешить»
6. Маркбэйс id отдаёт code → waygpt.ru обменивает на token
7. waygpt.ru создаёт локальную сессию → Dashboard
```

**Время: ~5 секунд** (если есть сессия и consent уже дан)

### Сценарий B: Пользователь НЕ имеет аккаунта Маркбэйс id

```
1. Открывает waygpt.ru → Нажимает «Войти через Маркбэйс id»
2. Открывается popup/redirect → auth.markbase.ru
3. Маркбэйс id видит что нет сессии → Форма входа
4. Пользователь нажимает «Создать аккаунт»
5. ──── РЕГИСТРАЦИЯ ────
   a. Ввод email
   b. Проверка что email не занят
   c. Ввод пароля (мин. 8 символов, заглавные + строчные + цифры)
   d. Captcha (Яндекс SmartCaptcha)
   e. Принятие согласий (политика, условия, персональные данные)
   f. ► Отправка письма с подтверждением ◄
6. ──── ПОДТВЕРЖДЕНИЕ EMAIL ────
   a. Пользователь получает письмо с 6-значным кодом
   b. Вводит код на auth.markbase.ru
   c. Email подтверждён → аккаунт активирован
7. Consent Screen → «Разрешить» для waygpt.ru
8. Маркбэйс id отдаёт code → waygpt.ru обменивает на token
9. waygpt.ru создаёт локальную сессию → Dashboard
```

**Время: ~2-3 минуты** (включая проверку почты)

### Сценарий C: Локальный вход + привязка Маркбэйс id позже

```
1. Пользователь регистрируется на waygpt.ru через обычную форму
2. В настройках аккаунта → «Привязать Маркбэйс id»
3. OAuth flow → Маркбэйс id создаёт связь (link) с аккаунтом waygpt.ru
4. Теперь можно входить через «Войти через Маркбэйс id»
```

### Сценарий D: Множественные аккаунты

```
1. У пользователя 2 аккаунта Маркбэйс id (рабочий + личный)
2. Нажимает «Войти через Маркбэйс id» на waygpt.ru
3. Account Picker показывает оба аккаунта
4. Выбирает нужный → входит
5. Может переключить аккаунт через Account Switcher в шапке
```

---

## 3. Шаг 1: Регистрация приложения

### 3.1 Через Registry UI

1. Перейти на [registry.markbase.ru](https://registry.markbase.ru)
2. Войти как администратор
3. «Приложения» → «Создать OAuth-приложение»
4. Заполнить форму:

| Поле | Пример (WayGPT) | Описание |
|------|------------------|----------|
| **Название** | WayGPT | Отображается на Consent Screen |
| **Домен** | waygpt.ru | Основной домен |
| **Redirect URIs** | `https://waygpt.ru/auth/callback` | Список разрешённых callback URL |
| **Scopes** | `openid profile email` | Запрашиваемые данные |
| **Иконка** | PNG 128x128 | Отображается на Consent Screen |
| **Политика конф.** | `https://waygpt.ru/privacy` | Ссылка для Consent Screen |
| **Условия исп.** | `https://waygpt.ru/terms` | Ссылка для Consent Screen |
| **Тип приложения** | `web` | `web` / `spa` / `native` |

5. Получить credentials:

```
CLIENT_ID:     wsid_app_waygpt_abc123
CLIENT_SECRET: wsid_secret_xxxxxxxxxxxxxxxxxxx
```

### 3.2 Через API

```bash
curl -X POST https://registry.markbase.ru/api/registry/v1/oauth/apps \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WayGPT",
    "domain": "waygpt.ru",
    "redirect_uris": [
      "https://waygpt.ru/auth/callback",
      "http://localhost:3000/auth/callback"
    ],
    "scopes": ["openid", "profile", "email"],
    "app_type": "web",
    "privacy_url": "https://waygpt.ru/privacy",
    "terms_url": "https://waygpt.ru/terms"
  }'
```

**Ответ:**

```json
{
  "app_id": "wsid_app_waygpt_abc123",
  "client_id": "wsid_app_waygpt_abc123",
  "client_secret": "wsid_secret_xxxxxxxxxxxxxxxxxxx",
  "name": "WayGPT",
  "created_at": "2026-02-09T12:00:00Z"
}
```

> **ВАЖНО:** `client_secret` показывается **один раз**. Сохраните его немедленно.  
> **НИКОГДА** не храните `client_secret` в frontend-коде, git, или логах.

---

## 4. Шаг 2: Подключение SDK

### 4.1 Подключение стилей и скрипта

```html
<!-- В <head> -->
<link rel="stylesheet" href="https://auth.markbase.ru/sdk/Маркбэйс id.css">

<!-- Перед </body> -->
<script src="https://auth.markbase.ru/sdk/Маркбэйс id.js"></script>
```

### 4.2 Через npm (React / Vue / Next.js)

```bash
npm install @markbase/Маркбэйс id-sdk
```

```javascript
import Маркбэйс id from '@markbase/Маркбэйс id-sdk';
import '@markbase/Маркбэйс id-sdk/styles.css';
```

### 4.3 Инициализация

```javascript
Маркбэйс id.init({
  client_id: 'wsid_app_waygpt_abc123',
  redirect_uri: 'https://waygpt.ru/auth/callback',
  scope: 'openid profile email',
  mode: 'popup',           // 'popup' | 'redirect'
  locale: 'ru',            // 'ru' | 'en'
  
  // Расширенные опции:
  auto_select: false,       // true = auto-login если 1 аккаунт и consent уже дан
  prompt: 'select_account', // Поведение по умолчанию
  
  // Callbacks:
  onReady: () => {
    console.log('Маркбэйс id SDK ready');
  },
  onError: (error) => {
    console.error('Маркбэйс id SDK error:', error);
  }
});
```

---

## 5. Шаг 3: Страница входа

### 5.1 Полная страница входа (HTML)

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход — WayGPT</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://auth.markbase.ru/sdk/Маркбэйс id.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f7f8fa;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
      padding: 40px 36px 32px;
    }

    .login-logo {
      text-align: center;
      margin-bottom: 28px;
    }
    .login-logo h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 12px;
    }
    .login-logo p {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }

    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      height: 42px;
      border: 1.5px solid #e2e5e9;
      border-radius: 10px;
      padding: 0 14px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.15s;
      outline: none;
    }
    .form-group input:focus {
      border-color: #0f172a;
      box-shadow: 0 0 0 3px rgba(15,23,42,0.06);
    }

    .btn-login {
      width: 100%;
      height: 44px;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;
    }
    .btn-login:hover {
      background: #1e293b;
      box-shadow: 0 4px 12px rgba(15,23,42,0.2);
    }

    .login-links {
      text-align: center;
      margin-top: 8px;
    }
    .login-links a {
      font-size: 13px;
      color: #64748b;
      text-decoration: none;
      transition: color 0.15s;
    }
    .login-links a:hover {
      color: #0f172a;
    }

    /* ─── Divider ─── */
    .auth-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 24px 0;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .auth-divider::before,
    .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, #e2e5e9, transparent);
    }

    /* ─── Маркбэйс id button container ─── */
    .wsid-container {
      margin-bottom: 8px;
    }

    /* ─── Footer ─── */
    .login-footer {
      margin-top: 24px;
      text-align: center;
      max-width: 440px;
    }
    .login-footer a {
      font-size: 12px;
      color: #94a3b8;
      text-decoration: none;
      margin: 0 8px;
    }
    .login-footer a:hover { color: #64748b; }
    .login-footer .copy {
      margin-top: 12px;
      font-size: 11px;
      color: #c0c5cc;
    }
  </style>
</head>
<body>

  <div class="login-card">
    <div class="login-logo">
      <h1>WayGPT</h1>
      <p>Войдите чтобы продолжить</p>
    </div>

    <!-- ══════ Кнопка Маркбэйс id ══════ -->
    <div class="wsid-container" id="wsid-button"></div>

    <!-- ══════ Разделитель ══════ -->
    <div class="auth-divider">или</div>

    <!-- ══════ Обычный вход ══════ -->
    <form action="/auth/login" method="POST">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" name="password" placeholder="Введите пароль" required>
      </div>
      <button type="submit" class="btn-login">Войти</button>
    </form>

    <div class="login-links">
      <a href="/auth/register">Создать аккаунт</a>
      &nbsp;&middot;&nbsp;
      <a href="/auth/forgot-password">Забыли пароль?</a>
    </div>
  </div>

  <div class="login-footer">
    <a href="/privacy">Конфиденциальность</a>
    <a href="/terms">Условия</a>
    <a href="/contact">Контакты</a>
    <div class="copy">&copy; 2026 WayGPT. Продукт экосистемы markbase.ru</div>
  </div>

  <!-- ══════ Маркбэйс id SDK ══════ -->
  <script src="https://auth.markbase.ru/sdk/Маркбэйс id.js"></script>
  <script>
    Маркбэйс id.init({
      client_id: 'wsid_app_waygpt_abc123',
      redirect_uri: window.location.origin + '/auth/callback',
      scope: 'openid profile email'
    });

    // Рендерим кнопку
    Маркбэйс id.renderButton('#wsid-button', {
      variant: 'outline',  // outline — чтобы отличалась от основной кнопки «Войти»
      size: 'lg',
      width: '100%',
      text: 'Войти через Маркбэйс id'
    });
  </script>

</body>
</html>
```

### 5.2 React-компонент страницы входа

```jsx
// pages/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import Маркбэйс id from '@markbase/Маркбэйс id-sdk';
import '@markbase/Маркбэйс id-sdk/styles.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wsidRef = useRef(null);

  useEffect(() => {
    // Инициализация Маркбэйс id SDK
    Маркбэйс id.init({
      client_id: process.env.REACT_APP_WSID_CLIENT_ID,
      redirect_uri: window.location.origin + '/auth/callback',
      scope: 'openid profile email',
    });

    // Рендер кнопки
    if (wsidRef.current) {
      Маркбэйс id.renderButton(wsidRef.current, {
        variant: 'outline',
        size: 'lg',
        width: '100%',
        text: 'Войти через Маркбэйс id',
        onSuccess: handleWsidSuccess,
        onError: handleWsidError,
      });
    }
  }, []);

  // ── Обработка успешного входа через Маркбэйс id ──
  const handleWsidSuccess = async (result) => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/auth/wsid/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.code, state: result.state }),
      });
      const data = await resp.json();

      if (data.success) {
        // Вход или регистрация прошли успешно
        if (data.is_new_user) {
          // Новый пользователь — можно показать onboarding
          window.location.href = '/onboarding';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        setError(data.error || 'Ошибка авторизации');
      }
    } catch (err) {
      setError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleWsidError = (err) => {
    if (err.error === 'access_denied') {
      // Пользователь закрыл popup или отклонил
      return;
    }
    setError('Ошибка Маркбэйс id: ' + (err.error_description || err.error));
  };

  // ── Обычный вход по email/паролю ──
  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (data.success) {
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Неверный email или пароль');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fa',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 440, background: '#fff',
        borderRadius: 16, padding: '40px 36px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>WayGPT</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Войдите чтобы продолжить</p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* ══ Кнопка Маркбэйс id ══ */}
        <div ref={wsidRef} style={{ marginBottom: 8 }} />

        {/* ══ Разделитель ══ */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          margin: '24px 0', color: '#94a3b8', fontSize: 12,
          fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #e2e5e9, transparent)' }} />
          <span>или</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #e2e5e9, transparent)' }} />
        </div>

        {/* ══ Обычная форма входа ══ */}
        <form onSubmit={handleLocalLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required
              style={{
                width: '100%', height: 42, border: '1.5px solid #e2e5e9',
                borderRadius: 10, padding: '0 14px', fontSize: 14,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Введите пароль" required
              style={{
                width: '100%', height: 42, border: '1.5px solid #e2e5e9',
                borderRadius: 10, padding: '0 14px', fontSize: 14,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', height: 44, background: '#0f172a', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Загрузка...' : 'Войти'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/auth/register" style={{ fontSize: 13, color: '#64748b' }}>Создать аккаунт</a>
          <span style={{ margin: '0 8px', color: '#d1d5db' }}>&middot;</span>
          <a href="/auth/forgot-password" style={{ fontSize: 13, color: '#64748b' }}>Забыли пароль?</a>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Шаг 4: Backend — обработка callback

### 6.1 Node.js / Express

```javascript
// routes/auth.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();

const WSID_AUTHORIZE_URL = 'https://auth.markbase.ru/oauth/authorize';
const WSID_TOKEN_URL = 'https://auth.markbase.ru/oauth/token';
const WSID_USERINFO_URL = 'https://auth.markbase.ru/oauth/userinfo';
const CLIENT_ID = process.env.WSID_CLIENT_ID;
const CLIENT_SECRET = process.env.WSID_CLIENT_SECRET;
const REDIRECT_URI = process.env.WSID_REDIRECT_URI;

// ── Вспомогательные функции PKCE ──
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── 1. Инициация OAuth flow (redirect-режим) ──
router.get('/wsid/init', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Сохранить в сессию (ОБЯЗАТЕЛЬНО серверная сессия, не cookie!)
  req.session.oauth_state = state;
  req.session.oauth_code_verifier = codeVerifier;
  req.session.oauth_return_url = req.query.return_url || '/dashboard';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  res.redirect(`${WSID_AUTHORIZE_URL}?${params}`);
});

// ── 2. Callback (получение code) ──
router.get('/wsid/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Проверка ошибок от Маркбэйс id
  if (error) {
    console.error(`Маркбэйс id OAuth error: ${error} — ${error_description}`);
    return res.redirect(`/login?error=${encodeURIComponent(error_description || error)}`);
  }

  // ── CSRF проверка ──
  if (!state || state !== req.session.oauth_state) {
    console.error('Маркбэйс id OAuth: state mismatch (CSRF attack?)');
    return res.redirect('/login?error=invalid_state');
  }

  try {
    // ── 3. Обмен code → tokens ──
    const tokenResp = await axios.post(WSID_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code_verifier: req.session.oauth_code_verifier,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const { access_token, refresh_token, id_token } = tokenResp.data;

    // ── 4. Получить профиль пользователя ──
    const userResp = await axios.get(WSID_USERINFO_URL, {
      headers: { 'Authorization': `Bearer ${access_token}` },
      timeout: 5000,
    });

    const wsidUser = userResp.data;
    // wsidUser = { sub, name, email, email_verified, picture }

    // ── 5. Проверка email_verified ──
    if (!wsidUser.email_verified) {
      return res.redirect('/login?error=email_not_verified');
    }

    // ── 6. Найти или создать пользователя в ВАШЕЙ БД ──
    let user = await db.users.findOne({ where: { wsid_sub: wsidUser.sub } });
    let isNewUser = false;

    if (!user) {
      // Проверить по email — может уже есть локальный аккаунт
      user = await db.users.findOne({ where: { email: wsidUser.email } });

      if (user) {
        // Привязать Маркбэйс id к существующему аккаунту
        await db.users.update(
          { wsid_sub: wsidUser.sub, wsid_linked_at: new Date() },
          { where: { id: user.id } }
        );
      } else {
        // Создать нового пользователя
        user = await db.users.create({
          email: wsidUser.email,
          display_name: wsidUser.name,
          wsid_sub: wsidUser.sub,
          wsid_linked_at: new Date(),
          email_verified: true, // Маркбэйс id уже подтвердил
          auth_provider: 'Маркбэйс id',
        });
        isNewUser = true;
      }
    }

    // ── 7. Сохранить refresh_token (зашифрованный) ──
    await db.oauth_tokens.upsert({
      user_id: user.id,
      provider: 'Маркбэйс id',
      access_token: encrypt(access_token),
      refresh_token: encrypt(refresh_token),
      expires_at: new Date(Date.now() + tokenResp.data.expires_in * 1000),
    });

    // ── 8. Создать сессию ──
    req.session.user_id = user.id;
    req.session.auth_provider = 'Маркбэйс id';

    // Очистить OAuth-данные из сессии
    delete req.session.oauth_state;
    delete req.session.oauth_code_verifier;

    const returnUrl = req.session.oauth_return_url || '/dashboard';
    delete req.session.oauth_return_url;

    res.redirect(isNewUser ? '/onboarding' : returnUrl);

  } catch (err) {
    console.error('Маркбэйс id callback error:', err.response?.data || err.message);
    res.redirect('/login?error=auth_failed');
  }
});

// ── 3. Callback для popup-режима (POST от frontend) ──
router.post('/wsid/callback', async (req, res) => {
  const { code, state } = req.body;

  // Та же логика что и GET callback, но возвращает JSON
  // ... (аналогично GET, но res.json() вместо res.redirect())

  try {
    // ... обмен code → token → userinfo → find/create user ...

    res.json({
      success: true,
      is_new_user: isNewUser,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── 4. Выход ──
router.post('/wsid/logout', async (req, res) => {
  if (req.session.user_id) {
    // Опционально: отозвать токен у Маркбэйс id
    try {
      const tokens = await db.oauth_tokens.findOne({
        where: { user_id: req.session.user_id, provider: 'Маркбэйс id' }
      });
      if (tokens) {
        await axios.post('https://auth.markbase.ru/oauth/revoke', new URLSearchParams({
          token: decrypt(tokens.refresh_token),
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }));
        await tokens.destroy();
      }
    } catch (_) { /* не блокируем выход */ }
  }

  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
```

### 6.2 Python / FastAPI

```python
# auth/Маркбэйс id.py
import os
import secrets
import hashlib
import base64
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse

router = APIRouter(prefix="/auth/wsid")

WSID_AUTHORIZE = "https://auth.markbase.ru/oauth/authorize"
WSID_TOKEN = "https://auth.markbase.ru/oauth/token"
WSID_USERINFO = "https://auth.markbase.ru/oauth/userinfo"
WSID_REVOKE = "https://auth.markbase.ru/oauth/revoke"

CLIENT_ID = os.getenv("WSID_CLIENT_ID")
CLIENT_SECRET = os.getenv("WSID_CLIENT_SECRET")
REDIRECT_URI = os.getenv("WSID_REDIRECT_URI", "https://waygpt.ru/auth/callback")


def _pkce_pair():
    """Генерация PKCE code_verifier + code_challenge."""
    verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


@router.get("/init")
async def wsid_init(request: Request, return_url: str = "/dashboard"):
    """Инициировать OAuth flow — redirect на auth.markbase.ru."""
    state = secrets.token_hex(16)
    verifier, challenge = _pkce_pair()

    # Сохраняем в серверной сессии
    request.session["oauth_state"] = state
    request.session["oauth_verifier"] = verifier
    request.session["oauth_return"] = return_url

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "openid profile email",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    url = f"{WSID_AUTHORIZE}?{'&'.join(f'{k}={v}' for k, v in params.items())}"
    return RedirectResponse(url)


@router.get("/callback")
async def wsid_callback(request: Request, code: str = "", state: str = "",
                         error: str = "", error_description: str = ""):
    """Обработка callback от Маркбэйс id."""
    if error:
        return RedirectResponse(f"/login?error={error_description or error}")

    # ── CSRF check ──
    saved_state = request.session.pop("oauth_state", None)
    if not state or state != saved_state:
        raise HTTPException(400, "Invalid state (CSRF)")

    verifier = request.session.pop("oauth_verifier", "")
    return_url = request.session.pop("oauth_return", "/dashboard")

    async with httpx.AsyncClient(timeout=10) as client:
        # ── Обмен code → token ──
        token_resp = await client.post(WSID_TOKEN, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        })
        if token_resp.status_code != 200:
            raise HTTPException(400, f"Token exchange failed: {token_resp.text}")
        tokens = token_resp.json()

        # ── Получить профиль ──
        user_resp = await client.get(WSID_USERINFO, headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if user_resp.status_code != 200:
            raise HTTPException(400, "Failed to get user info")
        wsid_user = user_resp.json()

    # ── Проверка подтверждения email ──
    if not wsid_user.get("email_verified"):
        return RedirectResponse("/login?error=email_not_verified")

    # ── Найти или создать пользователя ──
    user = await find_user_by_wsid(wsid_user["sub"])
    is_new = False

    if not user:
        user = await find_user_by_email(wsid_user["email"])
        if user:
            await link_wsid_to_user(user["id"], wsid_user["sub"])
        else:
            user = await create_user(
                email=wsid_user["email"],
                display_name=wsid_user.get("name"),
                wsid_sub=wsid_user["sub"],
                email_verified=True,
                auth_provider="Маркбэйс id",
            )
            is_new = True

    # ── Сохранить токены ──
    await save_oauth_tokens(user["id"], "Маркбэйс id", tokens)

    # ── Создать сессию ──
    request.session["user_id"] = user["id"]
    request.session["auth_provider"] = "Маркбэйс id"

    return RedirectResponse("/onboarding" if is_new else return_url)
```

---

## 7. Шаг 5: Хранение и обновление токенов

### 7.1 Схема БД (ваш сервис)

```sql
-- Таблица пользователей (расширение)
ALTER TABLE users ADD COLUMN wsid_sub VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN wsid_linked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local';
-- auth_provider: 'local' | 'Маркбэйс id' | 'both'

CREATE INDEX idx_users_wsid_sub ON users(wsid_sub);

-- Таблица OAuth-токенов
CREATE TABLE oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'Маркбэйс id',
  access_token TEXT NOT NULL,        -- зашифрованный!
  refresh_token TEXT,                -- зашифрованный!
  id_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);
```

### 7.2 Шифрование токенов

```javascript
// utils/crypto.js
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 7.3 Обновление access_token

```javascript
async function refreshAccessToken(userId) {
  const tokens = await db.oauth_tokens.findOne({
    where: { user_id: userId, provider: 'Маркбэйс id' }
  });

  if (!tokens || !tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  const resp = await axios.post(WSID_TOKEN_URL, new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decrypt(tokens.refresh_token),
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }));

  const newTokens = resp.data;

  await tokens.update({
    access_token: encrypt(newTokens.access_token),
    refresh_token: newTokens.refresh_token
      ? encrypt(newTokens.refresh_token)
      : tokens.refresh_token,
    expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
    updated_at: new Date(),
  });

  return newTokens.access_token;
}
```

---

## 8. Регистрация нового пользователя

### 8.1 Полный flow регистрации через Маркбэйс id

Когда пользователь нажимает «Войти через Маркбэйс id» и у него **нет аккаунта**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    auth.markbase.ru (popup/page)                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │           ┌─────┐                                              │  │
│  │           │ 🌐  │                                              │  │
│  │           └─────┘                                              │  │
│  │          Маркбэйс id                                              │  │
│  │                                                                │  │
│  │   ┌──────────────────────────────────────────────────────┐     │  │
│  │   │  Email                                               │     │  │
│  │   │  ┌──────────────────────────────────────────────┐    │     │  │
│  │   │  │ newuser@example.com                          │    │     │  │
│  │   │  └──────────────────────────────────────────────┘    │     │  │
│  │   │                                                      │     │  │
│  │   │  [Продолжить →]                                      │     │  │
│  │   └──────────────────────────────────────────────────────┘     │  │
│  │                                                                │  │
│  │   Нет аккаунта?  Создать                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                              ▼  (email не найден)                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │          Маркбэйс id — Регистрация                                │  │
│  │                                                                │  │
│  │   Email: newuser@example.com                                   │  │
│  │                                                                │  │
│  │   Пароль:           [________________________]                 │  │
│  │   Подтвердите:      [________________________]                 │  │
│  │                                                                │  │
│  │   Сила пароля: ████████░░░░ Хороший                            │  │
│  │   • Минимум 8 символов ✓                                      │  │
│  │   • Заглавные и строчные ✓                                    │  │
│  │   • Цифры ✓                                                   │  │
│  │                                                                │  │
│  │   [Captcha — Яндекс SmartCaptcha]                              │  │
│  │                                                                │  │
│  │   ☑ Я принимаю условия использования и                        │  │
│  │     политику конфиденциальности                                │  │
│  │   ☑ Я даю согласие на обработку                               │  │
│  │     персональных данных                                        │  │
│  │                                                                │  │
│  │   [Создать аккаунт →]                                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                              ▼  (аккаунт создан, НО не активен)      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │          Маркбэйс id — Подтверждение email                         │  │
│  │                                                                │  │
│  │          ┌─────┐                                               │  │
│  │          │ ✉️   │                                               │  │
│  │          └─────┘                                               │  │
│  │                                                                │  │
│  │   Мы отправили код подтверждения на                            │  │
│  │   newuser@example.com                                          │  │
│  │                                                                │  │
│  │   Введите 6-значный код:                                      │  │
│  │   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                       │  │
│  │   │ 4 │ │ 7 │ │ 2 │ │ 9 │ │ 1 │ │ 5 │                       │  │
│  │   └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                       │  │
│  │                                                                │  │
│  │   Не получили? Отправить повторно (через 58 сек)              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                              ▼  (email подтверждён)                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │          Consent Screen (для waygpt.ru)                        │  │
│  │          ... (как описано в README.md §7)                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                              ▼  (пользователь нажал «Разрешить»)     │
│                                                                      │
│  redirect → waygpt.ru/auth/callback?code=...&state=...              │
│  или postMessage → { type: 'wsid:auth_success', code, state }      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Что ВАЖНО для разработчика вашего сервиса

1. **Вам НЕ нужно** реализовывать регистрацию — Маркбэйс id делает это сам
2. **Вам НЕ нужно** подтверждать email — Маркбэйс id гарантирует `email_verified: true`
3. **Вам НЕ нужно** хранить пароли Маркбэйс id-пользователей
4. **Вам НУЖНО** обработать callback и создать пользователя в своей БД
5. **Вам НУЖНО** проверять `email_verified` в ответе `/oauth/userinfo`
6. **Вам НУЖНО** отличать «новых» пользователей от «повторных» (для onboarding)

### 8.3 Гарантии Маркбэйс id при регистрации

| Гарантия | Описание |
|----------|----------|
| **Email подтверждён** | Пользователь всегда подтверждает email 6-значным кодом |
| **Пароль надёжный** | Минимум 8 символов, заглавные + строчные + цифры |
| **Captcha пройдена** | Яндекс SmartCaptcha на регистрации |
| **Согласия приняты** | Политика конфиденциальности + условия + ПД |
| **Anti-bruteforce** | Макс. 10 попыток / 30 мин |
| **Anti-DDoS** | Rate limiting на все endpoints |
| **Unique email** | Один аккаунт на один email |

---

## 9. Полный пример: WayGPT

### 9.1 Структура файлов

```
waygpt/
├── .env                          # Credentials (НИКОГДА в git!)
├── .env.example                  # Шаблон
├── package.json
├── server.js                     # Express app
├── routes/
│   ├── auth.js                   # Все auth routes
│   └── api.js                    # API routes
├── middleware/
│   └── requireAuth.js            # Проверка авторизации
├── models/
│   ├── User.js                   # Модель пользователя
│   └── OAuthToken.js             # Модель OAuth-токенов
├── utils/
│   └── crypto.js                 # Шифрование токенов
├── public/
│   ├── login.html                # Страница входа
│   └── css/
│       └── login.css             # Стили
└── views/
    └── dashboard.ejs             # Dashboard
```

### 9.2 Файл .env.example

```env
# ── Маркбэйс id OAuth ──
WSID_CLIENT_ID=wsid_app_waygpt_abc123
WSID_CLIENT_SECRET=wsid_secret_xxxxxxxxxxxxxxxxxxx
WSID_REDIRECT_URI=https://waygpt.ru/auth/wsid/callback

# ── Безопасность ──
SESSION_SECRET=your-session-secret-min-32-chars-random
TOKEN_ENCRYPTION_KEY=64-hex-chars-for-aes-256

# ── База данных ──
DATABASE_URL=postgres://user:pass@localhost:5432/waygpt

# ── Приложение ──
NODE_ENV=production
PORT=3000
APP_URL=https://waygpt.ru
```

### 9.3 Middleware авторизации

```javascript
// middleware/requireAuth.js
module.exports = function requireAuth(req, res, next) {
  if (!req.session || !req.session.user_id) {
    // API запрос → 401
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    // Обычный запрос → редирект на логин
    return res.redirect(`/login?return_url=${encodeURIComponent(req.originalUrl)}`);
  }

  next();
};
```

### 9.4 Env-переменные для docker-compose

```yaml
# docker-compose.yml (фрагмент)
services:
  waygpt:
    image: waygpt:latest
    environment:
      - WSID_CLIENT_ID=${WSID_CLIENT_ID}
      - WSID_CLIENT_SECRET=${WSID_CLIENT_SECRET}
      - WSID_REDIRECT_URI=https://waygpt.ru/auth/wsid/callback
      - SESSION_SECRET=${SESSION_SECRET}
      - TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
    # НИКОГДА не передавать secrets через environment в открытом виде
    # Используйте Docker secrets или vault
```

---

## 10. Безопасность — чеклист

### 10.1 Обязательные требования

| # | Требование | Статус |
|---|------------|--------|
| 1 | `client_secret` хранится ТОЛЬКО на сервере, НИКОГДА на фронте | ☐ |
| 2 | `client_secret` НЕ в git (добавлен в .gitignore) | ☐ |
| 3 | Параметр `state` генерируется на сервере, проверяется при callback | ☐ |
| 4 | PKCE используется (code_challenge + code_verifier) | ☐ |
| 5 | `redirect_uri` совпадает с зарегистрированным — до символа | ☐ |
| 6 | `access_token` хранится в httpOnly cookie или серверной сессии | ☐ |
| 7 | `access_token` и `refresh_token` зашифрованы в БД (AES-256) | ☐ |
| 8 | Проверяется `email_verified: true` в userinfo | ☐ |
| 9 | В popup-режиме проверяется `event.origin` в postMessage | ☐ |
| 10 | Все OAuth-эндпоинты вызываются только по HTTPS | ☐ |
| 11 | `refresh_token` обновляется при каждом использовании | ☐ |
| 12 | При выходе токен отзывается через `/oauth/revoke` | ☐ |
| 13 | Сессия имеет TTL (максимум 72 часа, рекомендуется 24) | ☐ |
| 14 | Rate limiting на callback endpoint (макс. 30/мин) | ☐ |
| 15 | Логирование всех OAuth-событий (login, logout, errors) | ☐ |

### 10.2 Запрещено

| Запрет | Почему |
|--------|--------|
| Хранить `access_token` в localStorage | XSS-уязвимость |
| Хранить `client_secret` в JS-бандле | Утечка через исходный код |
| Передавать `access_token` в URL (query params) | Referer, логи, история |
| Пропускать проверку `state` | CSRF-атака |
| Использовать HTTP (не HTTPS) | Man-in-the-middle |
| Доверять `email` без `email_verified` | Подмена email |
| Хранить незашифрованные токены в БД | SQL injection → утечка |

### 10.3 Рекомендации

| Рекомендация | Описание |
|-------------|----------|
| Используйте PKCE | Защита от перехвата code |
| Minimum scopes | Запрашивайте только нужные данные |
| Token rotation | `refresh_token` одноразовый |
| Audit log | Логируйте все auth-события |
| CSP headers | `Content-Security-Policy` для защиты от XSS |
| HSTS | `Strict-Transport-Security` заголовок |

---

## 11. FAQ и ошибки

### Q: Что если пользователь закрыл popup не завершив вход?

SDK определяет закрытие popup и вызывает `onError({ error: 'popup_closed' })`. Ваш сайт просто остаётся на странице входа. Ничего не происходит.

### Q: Что если Маркбэйс id недоступен?

SDK показывает ошибку `temporarily_unavailable`. Ваш сайт должен:
1. Показать сообщение «Сервис авторизации временно недоступен»
2. Предложить альтернативный вход (email/пароль если есть)
3. Попробовать через 30 секунд

### Q: Можно ли использовать одновременно локальный вход и Маркбэйс id?

Да. Рекомендуемый подход:
- На странице входа: обычная форма + кнопка «Войти через Маркбэйс id»
- В настройках: возможность привязать/отвязать Маркбэйс id
- В БД: поле `wsid_sub` (nullable) + обычные email/password

### Q: Что если email из Маркбэйс id уже есть в моей БД?

При первом входе через Маркбэйс id: если email совпадает с существующим пользователем — **привязать** Маркбэйс id к этому аккаунту (не создавать дубликат). Проверьте `email_verified: true`.

### Q: Как отлаживать локально?

1. Зарегистрировать `http://localhost:3000/auth/callback` как redirect_uri
2. Использовать `display=page` (popup может блокироваться)
3. Для тестов: `prompt=login` — всегда показывает форму входа

### Q: Как обновить scopes после первого входа?

Добавьте новый scope в запрос `/oauth/authorize`. Маркбэйс id автоматически покажет Consent Screen с новыми разрешениями.

---

## Changelog

### 2026-02-09
- **v2.0.0** — Полное руководство интеграции с lifecycle-диаграммами, регистрацией через подтверждение, примером WayGPT, чеклистом безопасности, схемой БД
