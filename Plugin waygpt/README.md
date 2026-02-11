# WayGPT Plugin - Универсальный плагин для интеграции с AI Server

Полноценный плагин для интеграции вашего приложения с AI Server (WayGPT). Поддерживает все основные функции: чат, генерация изображений, видео, мультимодальные запросы.

**История изменений:** [CHANGELOG.md](CHANGELOG.md) — версии, критические правки, обновления функций, улучшения, исправления багов.

**Документация по интеграции:** сценарии, поиск по фото, логирование, статистика, все API endpoints — в `frontend/public/docs/integration`: `INTEGRATION_DOCS_INDEX.md`, `FULL_AI_SERVER_UNIVERSAL_INTEGRATION_GUIDE_RU.md`, `SCENARIOS_FLEXIBILITY_AND_LOGGING_RU.md`.

## 📋 Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Установка](#установка)
3. [Настройка](#настройка)
4. [Примеры использования](#примеры-использования)
5. [API Reference](#api-reference)
6. [Безопасность (HMAC)](#безопасность-hmac)
7. [Обработка ошибок](#обработка-ошибок)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Быстрый старт

### Шаг 1: Получите ключи доступа

1. Войдите в кабинет AI Server: `https://app.waygpt.ru` (или ваш домен)
2. Перейдите в **Кабинет → API‑ключи → Ключи проектов**
3. Создайте новый проект или выберите существующий
4. Скопируйте **Project Key** (`sk_live_...`)
5. Скопируйте **Project ID** (UUID) - понадобится для HMAC

### Шаг 2: Выберите язык и установите плагин

Выберите нужный язык из папки `src/`:
- **Python**: `src/python/waygpt_client.py`
- **JavaScript/Node.js**: `src/javascript/waygpt-client.js`
- **PHP**: `src/php/WayGPTClient.php`

### Шаг 3: Сделайте первый запрос

Смотрите примеры в папке `examples/` для вашего языка.

---

## 📦 Установка

### Python

```bash
# Установите зависимости
pip install requests

# Или используйте requirements.txt
pip install -r requirements.txt

# Скопируйте файл плагина в ваш проект
cp "Plugin waygpt/src/python/waygpt_client.py" /path/to/your/project/
```

### JavaScript/Node.js

```bash
# Установите зависимости
npm install axios

# Или используйте package.json
npm install

# Скопируйте файл плагина в ваш проект
cp "Plugin waygpt/src/javascript/waygpt-client.js" /path/to/your/project/
```

### PHP

```bash
# Убедитесь, что у вас установлен PHP 7.4+ с расширениями:
# - curl
# - json
# - openssl (для HMAC)

# Скопируйте файл плагина в ваш проект
cp "Plugin waygpt/src/php/WayGPTClient.php" /path/to/your/project/
```

---

## ⚙️ Настройка

### Базовая конфигурация

Создайте файл конфигурации или используйте переменные окружения:

**Python:**
```python
from waygpt_client import WayGPTClient

client = WayGPTClient(
    api_url="https://app.waygpt.ru",  # или ваш домен
    project_key="sk_live_...",
    project_id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  # для HMAC
    hmac_secret="your-hmac-secret",  # опционально
    use_hmac=False  # включите для production
)
```

**JavaScript:**
```javascript
const WayGPTClient = require('./waygpt-client');

const client = new WayGPTClient({
    apiUrl: 'https://app.waygpt.ru',
    projectKey: 'sk_live_...',
    projectId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    hmacSecret: 'your-hmac-secret',  // опционально
    useHmac: false  // включите для production
});
```

**PHP:**
```php
require_once 'WayGPTClient.php';

$client = new WayGPTClient([
    'api_url' => 'https://app.waygpt.ru',
    'project_key' => 'sk_live_...',
    'project_id' => 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    'hmac_secret' => 'your-hmac-secret',  // опционально
    'use_hmac' => false  // включите для production
]);
```

### Переменные окружения

Рекомендуется использовать переменные окружения для безопасности:

```bash
# .env файл
WAYGPT_API_URL=https://app.waygpt.ru
WAYGPT_PROJECT_KEY=sk_live_...
WAYGPT_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
WAYGPT_HMAC_SECRET=your-hmac-secret
WAYGPT_USE_HMAC=false
```

---

## 💡 Примеры использования

### 1. Простой чат

**Python:**
```python
response = client.chat_completions(
    model="auto",  # или конкретная модель
    messages=[
        {"role": "user", "content": "Привет! Расскажи о себе."}
    ]
)
print(response["choices"][0]["message"]["content"])
```

**JavaScript:**
```javascript
const response = await client.chatCompletions({
    model: 'auto',
    messages: [
        { role: 'user', content: 'Привет! Расскажи о себе.' }
    ]
});
console.log(response.choices[0].message.content);
```

**PHP:**
```php
$response = $client->chatCompletions([
    'model' => 'auto',
    'messages' => [
        ['role' => 'user', 'content' => 'Привет! Расскажи о себе.']
    ]
]);
echo $response['choices'][0]['message']['content'];
```

### 2. Стриминг ответов

**Python:**
```python
for chunk in client.chat_completions_stream(
    model="auto",
    messages=[{"role": "user", "content": "Расскажи длинную историю"}]
):
    if chunk.get("choices"):
        delta = chunk["choices"][0].get("delta", {})
        content = delta.get("content", "")
        if content:
            print(content, end="", flush=True)
```

**JavaScript:**
```javascript
const stream = await client.chatCompletionsStream({
    model: 'auto',
    messages: [{ role: 'user', content: 'Расскажи длинную историю' }]
});

for await (const chunk of stream) {
    if (chunk.choices && chunk.choices[0].delta) {
        const content = chunk.choices[0].delta.content;
        if (content) {
            process.stdout.write(content);
        }
    }
}
```

### 3. Генерация изображений

**Python:**
```python
response = client.image_generations(
    prompt="Красивый закат над морем",
    model="yandex-art",  # или другая модель
    size="1024x1024"
)
image_url = response["data"][0]["url"]
print(f"Изображение: {image_url}")
```

**JavaScript:**
```javascript
const response = await client.imageGenerations({
    prompt: 'Красивый закат над морем',
    model: 'yandex-art',
    size: '1024x1024'
});
console.log('Изображение:', response.data[0].url);
```

**PHP:**
```php
$response = $client->imageGenerations([
    'prompt' => 'Красивый закат над морем',
    'model' => 'yandex-art',
    'size' => '1024x1024'
]);
echo "Изображение: " . $response['data'][0]['url'];
```

### 4. Генерация видео

**Python:**
```python
response = client.video_generations(
    prompt="Кот играет с мячиком",
    model="kling-v1"
)
job_id = response["job_id"]
print(f"Задача создана: {job_id}")

# Проверка статуса
status = client.get_media_job(job_id)
print(f"Статус: {status['status']}")
```

### 5. Мультимодальный чат (текст + изображения)

**Python:**
```python
response = client.chat_completions(
    model="gemini-2.0-flash-exp",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Что на этом изображении?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/image.jpg"
                    }
                }
            ]
        }
    ]
)
```

### 6. Использование сценариев (Use Cases)

Указывается **ключ** сценария (`key`), например `support_chat`. Список сценариев: `client.get_use_cases()` (WayGPT) или Client API с JWT (документация по интеграции: раздел «Управление сценариями с внешнего сервера»).

**Python:**
```python
# Список сценариев (по project key)
cases = client.get_use_cases()  # [{"key": "support_chat", "name": "...", ...}]

response = client.chat_completions(
    model="auto",
    messages=[{"role": "user", "content": "Вопрос"}],
    use_case="support_chat"  # ключ сценария
)
```

**JavaScript:**
```javascript
const cases = await client.getUseCases();
const response = await client.chatCompletions({
    model: 'auto',
    messages: [{ role: 'user', content: 'Вопрос' }],
    useCase: 'support_chat'
});
```

**Создание, обновление и удаление** сценариев с внешнего сервера — через **Client API** с JWT (логин по email/password). См. раздел «Управление сценариями с внешнего сервера» в документации по интеграции.

---

## 🔐 Client API - Управление проектами и сценариями

Client API позволяет управлять проектами и сценариями через JWT авторизацию. Это полезно для автоматизации, интеграций и управления с внешних серверов.

### Авторизация в Client API

**Python:**
```python
# Авторизация (получение JWT токена)
login_response = client.client_login(
    email="user@example.com",
    password="your_password"
)
jwt_token = login_response["token"]
print(f"Токен действителен {login_response['expires_in']} секунд")
```

**JavaScript:**
```javascript
// Авторизация
const loginResponse = await client.clientLogin('user@example.com', 'your_password');
const jwtToken = loginResponse.token;
console.log(`Токен действителен ${loginResponse.expires_in} секунд`);
```

**PHP:**
```php
// Авторизация
$loginResponse = $client->clientLogin('user@example.com', 'your_password');
$jwtToken = $loginResponse['token'];
echo "Токен действителен {$loginResponse['expires_in']} секунд\n";
```

### Управление проектами

**Python:**
```python
# Список проектов
projects = client.client_list_projects(jwt_token)
for project in projects:
    print(f"Проект: {project['name']} (ID: {project['id']})")

# Получение детальной информации о проекте
project = client.client_get_project(project_id, jwt_token)
print(f"API Key: {project['api_key']}")
print(f"Разрешенные модели: {project['allowed_models']}")

# Создание проекта
new_project = client.client_create_project("Новый проект", jwt_token)
print(f"Создан проект: {new_project['id']}")

# Обновление проекта
updated = client.client_update_project(
    project_id=project_id,
    jwt_token=jwt_token,
    name="Обновленное название",
    is_active=True,
    allowed_models=["gpt-4", "gpt-3.5-turbo"]
)

# Удаление проекта
result = client.client_delete_project(project_id, jwt_token)
```

**JavaScript:**
```javascript
// Список проектов
const projects = await client.clientListProjects(jwtToken);
projects.forEach(p => {
    console.log(`Проект: ${p.name} (ID: ${p.id})`);
});

// Получение детальной информации
const project = await client.clientGetProject(projectId, jwtToken);
console.log(`API Key: ${project.api_key}`);

// Создание проекта
const newProject = await client.clientCreateProject('Новый проект', jwtToken);

// Обновление проекта
const updated = await client.clientUpdateProject(projectId, jwtToken, {
    name: 'Обновленное название',
    isActive: true,
    allowedModels: ['gpt-4', 'gpt-3.5-turbo']
});

// Удаление проекта
const result = await client.clientDeleteProject(projectId, jwtToken);
```

**PHP:**
```php
// Список проектов
$projects = $client->clientListProjects($jwtToken);
foreach ($projects as $p) {
    echo "Проект: {$p['name']} (ID: {$p['id']})\n";
}

// Получение детальной информации
$project = $client->clientGetProject($projectId, $jwtToken);
echo "API Key: {$project['api_key']}\n";

// Создание проекта
$newProject = $client->clientCreateProject('Новый проект', $jwtToken);

// Обновление проекта
$updated = $client->clientUpdateProject($projectId, $jwtToken, [
    'name' => 'Обновленное название',
    'is_active' => true,
    'allowed_models' => ['gpt-4', 'gpt-3.5-turbo']
]);

// Удаление проекта
$result = $client->clientDeleteProject($projectId, $jwtToken);
```

### Управление сценариями (Use Cases)

**Python:**
```python
# Список сценариев проекта
use_cases = client.client_list_use_cases(project_id, jwt_token)
for uc in use_cases:
    print(f"Сценарий: {uc['name']} (key: {uc['key']})")
    print(f"  Конфигурация: {uc['config']}")

# Получение детальной информации о сценарии
use_case = client.client_get_use_case(project_id, use_case_id, jwt_token)

# Создание сценария
new_use_case = client.client_create_use_case(
    project_id=project_id,
    jwt_token=jwt_token,
    key="support_chat",
    name="Чат поддержки",
    kind="chat",
    config={
        "system_prompt": "Ты помощник сайта...",
        "models": [{"model_id": "gpt-4", "priority": 1}],
        "response_format": "text"
    },
    is_active=True
)

# Обновление сценария
updated = client.client_update_use_case(
    project_id=project_id,
    use_case_id=use_case_id,
    jwt_token=jwt_token,
    name="Новое название",
    config={"system_prompt": "Обновленный промпт..."}
)

# Удаление сценария
result = client.client_delete_use_case(project_id, use_case_id, jwt_token)
```

**JavaScript:**
```javascript
// Список сценариев проекта
const useCases = await client.clientListUseCases(projectId, jwtToken);
useCases.forEach(uc => {
    console.log(`Сценарий: ${uc.name} (key: ${uc.key})`);
});

// Получение детальной информации
const useCase = await client.clientGetUseCase(projectId, useCaseId, jwtToken);

// Создание сценария
const newUseCase = await client.clientCreateUseCase(projectId, jwtToken, {
    key: 'support_chat',
    name: 'Чат поддержки',
    kind: 'chat',
    config: {
        system_prompt: 'Ты помощник сайта...',
        models: [{ model_id: 'gpt-4', priority: 1 }],
        response_format: 'text'
    },
    isActive: true
});

// Обновление сценария
const updated = await client.clientUpdateUseCase(projectId, useCaseId, jwtToken, {
    name: 'Новое название',
    config: { system_prompt: 'Обновленный промпт...' }
});

// Удаление сценария
const result = await client.clientDeleteUseCase(projectId, useCaseId, jwtToken);
```

**PHP:**
```php
// Список сценариев проекта
$useCases = $client->clientListUseCases($projectId, $jwtToken);
foreach ($useCases as $uc) {
    echo "Сценарий: {$uc['name']} (key: {$uc['key']})\n";
}

// Получение детальной информации
$useCase = $client->clientGetUseCase($projectId, $useCaseId, $jwtToken);

// Создание сценария
$newUseCase = $client->clientCreateUseCase($projectId, $jwtToken, [
    'key' => 'support_chat',
    'name' => 'Чат поддержки',
    'kind' => 'chat',
    'config' => [
        'system_prompt' => 'Ты помощник сайта...',
        'models' => [['model_id' => 'gpt-4', 'priority' => 1]],
        'response_format' => 'text'
    ],
    'is_active' => true
]);

// Обновление сценария
$updated = $client->clientUpdateUseCase($projectId, $useCaseId, $jwtToken, [
    'name' => 'Новое название',
    'config' => ['system_prompt' => 'Обновленный промпт...']
]);

// Удаление сценария
$result = $client->clientDeleteUseCase($projectId, $useCaseId, $jwtToken);
```

### Структура конфигурации сценария

Конфигурация сценария (`config`) может содержать:

```json
{
  "system_prompt": "Ты помощник сайта...",
  "models": [
    {"model_id": "gpt-4", "priority": 1},
    {"model_id": "gpt-3.5-turbo", "priority": 2}
  ],
  "response_format": "text",
  "temperature": 0.7,
  "max_tokens": 1000,
  "allowed_keywords": ["товар", "каталог"],
  "blocked_keywords": ["медицина"],
  "json_schema": {
    "type": "object",
    "properties": {
      "intent": {"type": "string"}
    }
  }
}
```

**Типы сценариев (`kind`):**
- `chat` - Текстовый чат
- `catalog_extract` - Извлечение данных из каталога
- `multimodal` - Мультимодальный чат (текст + изображения)
- `image_generation` - Генерация изображений
- `video_generation` - Генерация видео
- `multi` - Многоэтапный сценарий (цепочка моделей)

---

### 7. Получение списка моделей

**Python:**
```python
models = client.get_models()
print("Доступные модели:", models)

# Полная информация о моделях
models_full = client.get_models_full()
for model in models_full:
    print(f"{model['name']} - {model['provider']}")
```

---

## 📚 API Reference

### Chat Completions

Создание текстового ответа на основе сообщений.

**Endpoint:** `POST /api/v1/waygpt/chat/completions`

**Параметры:**
- `model` (string, required): ID модели или "auto"
- `messages` (array, required): Массив сообщений
- `use_case` (string, optional): Ключ сценария (например "support_chat"). Список: `GET /api/v1/waygpt/use-cases` или `getUseCases()` / `get_use_cases()`
- `temperature` (float, optional): 0.0-2.0
- `max_tokens` (int, optional): Максимальная длина ответа
- `stream` (bool, optional): Включить стриминг

**Пример ответа:**
```json
{
  "id": "chatcmpl-...",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Привет! Я AI-ассистент..."
    }
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Image Generations

Генерация изображений по текстовому описанию.

**Endpoint:** `POST /api/v1/waygpt/images/generations`

**Параметры:**
- `prompt` (string, required): Описание изображения
- `model` (string, optional): Модель генерации
- `size` (string, optional): Размер (например, "1024x1024")
- `n` (int, optional): Количество изображений

### Video Generations

Генерация видео по текстовому описанию.

**Endpoint:** `POST /api/v1/waygpt/videos/generations`

**Параметры:**
- `prompt` (string, required): Описание видео
- `model` (string, optional): Модель генерации
- `duration` (int, optional): Длительность в секундах

**Ответ:**
```json
{
  "job_id": "job-...",
  "status": "pending"
}
```

### Get Models

Получение списка доступных моделей.

**Endpoint:** `GET /api/v1/waygpt/models`

**Ответ:**
```json
["gpt-4", "gpt-3.5-turbo", "yandexgpt", ...]
```

---

## 🔐 Безопасность (HMAC)

Для production рекомендуется включить HMAC подпись запросов.

### Включение HMAC в кабинете

1. Перейдите в **Кабинет → API‑ключи → [Ваш проект] → Настройки**
2. Включите **"Требовать HMAC подпись"**
3. Установите **HMAC Secret** (сохраните его!)

### Использование HMAC в коде

**Python:**
```python
client = WayGPTClient(
    api_url="https://app.waygpt.ru",
    project_key="sk_live_...",
    project_id="your-project-id",
    hmac_secret="your-hmac-secret",
    use_hmac=True  # Включить HMAC
)
```

**JavaScript:**
```javascript
const client = new WayGPTClient({
    apiUrl: 'https://app.waygpt.ru',
    projectKey: 'sk_live_...',
    projectId: 'your-project-id',
    hmacSecret: 'your-hmac-secret',
    useHmac: true  // Включить HMAC
});
```

**PHP:**
```php
$client = new WayGPTClient([
    'api_url' => 'https://app.waygpt.ru',
    'project_key' => 'sk_live_...',
    'project_id' => 'your-project-id',
    'hmac_secret' => 'your-hmac-secret',
    'use_hmac' => true  // Включить HMAC
]);
```

Плагин автоматически генерирует подписи для всех запросов при включенном HMAC.

---

## ⚠️ Обработка ошибок

Все методы плагина могут выбрасывать исключения. Обрабатывайте их правильно:

**Python:**
```python
try:
    response = client.chat_completions(...)
except WayGPTError as e:
    if e.status_code == 401:
        print("Ошибка авторизации. Проверьте project_key")
    elif e.status_code == 429:
        print("Превышен лимит запросов")
    else:
        print(f"Ошибка: {e.message}")
```

**JavaScript:**
```javascript
try {
    const response = await client.chatCompletions(...);
} catch (error) {
    if (error.statusCode === 401) {
        console.error('Ошибка авторизации. Проверьте project_key');
    } else if (error.statusCode === 429) {
        console.error('Превышен лимит запросов');
    } else {
        console.error('Ошибка:', error.message);
    }
}
```

**PHP:**
```php
try {
    $response = $client->chatCompletions(...);
} catch (WayGPTException $e) {
    if ($e->getStatusCode() === 401) {
        echo "Ошибка авторизации. Проверьте project_key";
    } elseif ($e->getStatusCode() === 429) {
        echo "Превышен лимит запросов";
    } else {
        echo "Ошибка: " . $e->getMessage();
    }
}
```

### Коды ошибок

- `400` - Неверный запрос (проверьте параметры)
- `401` - Ошибка авторизации (проверьте project_key)
- `403` - Доступ запрещен (проверьте домен или HMAC)
- `429` - Превышен лимит запросов
- `500` - Ошибка сервера

---

## 🔧 Troubleshooting

### Проблема: "401 Unauthorized"

**Решение:**
1. Проверьте, что `project_key` правильный (начинается с `sk_live_`)
2. Убедитесь, что проект активен в кабинете
3. Проверьте, что домен разрешен (если настроен `allowed_domains`)

### Проблема: "403 Forbidden" с HMAC

**Решение:**
1. Проверьте, что `project_id` правильный (UUID)
2. Убедитесь, что `hmac_secret` совпадает с настройками в кабинете
3. Проверьте системное время (должно быть синхронизировано)

### Проблема: "Модель не найдена"

**Решение:**
1. Используйте `client.get_models()` для получения списка доступных моделей
2. Проверьте, что модель включена для вашего проекта в кабинете
3. Используйте `"auto"` для автоматического выбора модели

### Проблема: Медленные запросы

**Решение:**
1. Используйте стриминг для длинных ответов
2. Проверьте сетевую задержку до сервера
3. Используйте более быстрые модели (например, `gpt-3.5-turbo` вместо `gpt-4`)

---

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте документацию в папке `docs/`
2. Посмотрите примеры в папке `examples/`
3. Проверьте логи ошибок в вашем приложении
4. Обратитесь в поддержку AI Server

---

## 📄 Лицензия

Этот плагин предоставляется "как есть" для использования с AI Server (WayGPT).

---

## 🔄 Обновления

Следите за обновлениями плагина. Новые версии могут включать:
- Поддержку новых моделей
- Оптимизацию производительности
- Исправление ошибок
- Новые функции API

---

**Версия плагина:** 1.0.0  
**Последнее обновление:** 2024
