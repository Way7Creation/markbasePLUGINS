/**
 * WayGPT Client - JavaScript/Node.js SDK для интеграции с AI Server
 * 
 * Использование:
 *   const WayGPTClient = require('./waygpt-client');
 * 
 *   const client = new WayGPTClient({
 *     apiUrl: 'https://app.waygpt.ru',
 *     projectKey: 'sk_live_...',
 *     projectId: 'your-project-id',
 *     hmacSecret: 'your-hmac-secret',
 *     useHmac: false
 *   });
 * 
 *   const response = await client.chatCompletions({
 *     model: 'auto',
 *     messages: [{ role: 'user', content: 'Привет!' }]
 *   });
 */

const axios = require('axios');
const crypto = require('crypto');

class WayGPTError extends Error {
    constructor(message, statusCode = null, response = null) {
        super(message);
        this.name = 'WayGPTError';
        this.statusCode = statusCode;
        this.response = response;
    }
}

class WayGPTClient {
    /**
     * Инициализация клиента
     * 
     * @param {Object} options - Опции клиента
     * @param {string} options.apiUrl - URL API сервера
     * @param {string} options.projectKey - Project Key
     * @param {string} options.projectId - Project ID для HMAC
     * @param {string} options.hmacSecret - HMAC Secret
     * @param {boolean} options.useHmac - Включить HMAC подпись
     * @param {number} options.timeout - Таймаут запросов в секундах
     * @param {number} options.maxRetries - Максимальное количество повторов
     */
    constructor(options = {}) {
        this.apiUrl = (options.apiUrl || process.env.WAYGPT_API_URL || 'https://app.waygpt.ru').replace(/\/$/, '');
        this.projectKey = options.projectKey || process.env.WAYGPT_PROJECT_KEY;
        this.projectId = options.projectId || process.env.WAYGPT_PROJECT_ID;
        this.hmacSecret = options.hmacSecret || process.env.WAYGPT_HMAC_SECRET;
        this.useHmac = options.useHmac || (process.env.WAYGPT_USE_HMAC === 'true');
        this.timeout = options.timeout || 60000;
        this.maxRetries = options.maxRetries || 3;

        if (!this.projectKey) {
            throw new Error('projectKey обязателен. Укажите при инициализации или через WAYGPT_PROJECT_KEY');
        }

        if (this.useHmac) {
            if (!this.projectId) {
                throw new Error('projectId обязателен при использовании HMAC');
            }
            if (!this.hmacSecret) {
                throw new Error('hmacSecret обязателен при использовании HMAC');
            }
        }

        // Настройка axios с retry
        this.axios = axios.create({
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Interceptor для retry
        this.axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const config = error.config;
                if (!config || !config.retry) {
                    config.retry = 0;
                }

                if (config.retry >= this.maxRetries) {
                    return Promise.reject(error);
                }

                const status = error.response?.status;
                if (status === 429 || status >= 500) {
                    config.retry += 1;
                    const delay = Math.pow(2, config.retry) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.axios(config);
                }

                return Promise.reject(error);
            }
        );
    }

    /**
     * Генерация HMAC подписи
     * 
     * @param {string} method - HTTP метод
     * @param {string} path - Путь endpoint
     * @param {Object|string} body - Тело запроса
     * @param {number} timestamp - Unix timestamp
     * @param {string} nonce - Уникальный nonce
     * @returns {string} HMAC подпись
     */
    _generateHmacSignature(method, path, body, timestamp, nonce) {
        // Преобразуем body в строку
        let bodyString;
        if (typeof body === 'object') {
            bodyString = JSON.stringify(body);
        } else {
            bodyString = body || '';
        }

        // Хешируем body
        const bodyHash = crypto.createHash('sha256').update(bodyString, 'utf8').digest('hex');

        // Формируем canonical string
        const canonical = [
            method.toUpperCase(),
            path,
            `sha256(body)=${bodyHash}`,
            `timestamp=${timestamp}`,
            `nonce=${nonce}`,
            `project=${this.projectId}`,
        ].join('\n');

        // Создаём подпись
        const signature = crypto
            .createHmac('sha256', this.hmacSecret)
            .update(canonical, 'utf8')
            .digest('hex');

        return signature;
    }

    /**
     * Подготовка заголовков запроса
     * 
     * @param {string} method - HTTP метод
     * @param {string} path - Путь endpoint
     * @param {Object} body - Тело запроса
     * @returns {Object} Заголовки
     */
    _prepareHeaders(method, path, body = null) {
        const headers = {
            'Content-Type': 'application/json',
            'x-project-key': this.projectKey,
        };

        if (this.useHmac) {
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = crypto.randomBytes(16).toString('hex');
            const signature = this._generateHmacSignature(method, path, body, timestamp, nonce);

            headers['X-MB-Timestamp'] = timestamp.toString();
            headers['X-MB-Nonce'] = nonce;
            headers['X-MB-Signature'] = signature;
        }

        return headers;
    }

    /**
     * Выполнение HTTP запроса
     * 
     * @param {string} method - HTTP метод
     * @param {string} endpoint - Endpoint
     * @param {Object} data - Тело запроса
     * @param {boolean} stream - Включить стриминг
     * @returns {Promise<Object|Stream>} Ответ API
     */
    async _makeRequest(method, endpoint, data = null, stream = false) {
        const url = `${this.apiUrl}${endpoint}`;
        const headers = this._prepareHeaders(method, endpoint, data);

        const config = {
            method,
            url,
            headers,
            timeout: this.timeout,
            responseType: stream ? 'stream' : 'json',
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }

        try {
            const response = await this.axios(config);

            if (response.status >= 400) {
                const errorMessage = response.data?.detail || response.data?.message || `HTTP ${response.status}`;
                throw new WayGPTError(errorMessage, response.status, response.data);
            }

            return response.data;
        } catch (error) {
            if (error instanceof WayGPTError) {
                throw error;
            }

            if (error.response) {
                const errorMessage = error.response.data?.detail || error.response.data?.message || error.message;
                throw new WayGPTError(errorMessage, error.response.status, error.response.data);
            }

            throw new WayGPTError(`Ошибка сети: ${error.message}`);
        }
    }

    // ==================== Chat Completions ====================

    /**
     * Создание текстового ответа
     * 
     * @param {Object} options - Опции запроса
     * @param {string} options.model - ID модели или "auto"
     * @param {Array} options.messages - Список сообщений
     * @param {string} options.useCase - Ключ сценария (use_case), например "support_chat"
     * @param {string} options.useCaseId - Устаревший алиас для useCase (ключ сценария)
     * @param {number} options.temperature - Температура генерации
     * @param {number} options.maxTokens - Максимальная длина ответа
     * @param {boolean} options.stream - Включить стриминг
     * @returns {Promise<Object>} Ответ API
     */
    async chatCompletions(options = {}) {
        const {
            model = 'auto',
            messages = [],
            useCase,
            useCaseId,
            temperature,
            maxTokens,
            stream = false,
            ...otherOptions
        } = options;

        const data = {
            model,
            messages,
            ...otherOptions,
        };

        const uc = useCase || useCaseId;
        if (uc) {
            data.use_case = String(uc).trim();
        }
        if (temperature !== undefined) {
            data.temperature = temperature;
        }
        if (maxTokens !== undefined) {
            data.max_tokens = maxTokens;
        }
        if (stream) {
            data.stream = true;
        }

        if (stream) {
            return this._chatCompletionsStream(data);
        }

        return this._makeRequest('POST', '/api/v1/waygpt/chat/completions', data);
    }

    /**
     * Стриминг ответов chat completions
     * 
     * @param {Object} data - Данные запроса
     * @returns {AsyncGenerator<Object>} Генератор чанков
     */
    async *_chatCompletionsStream(data) {
        const response = await this._makeRequest('POST', '/api/v1/waygpt/chat/completions', data, true);

        const readline = require('readline');
        const rl = readline.createInterface({
            input: response,
            crlfDelay: Infinity,
        });

        try {
            for await (const line of rl) {
                if (!line || !line.startsWith('data: ')) {
                    continue;
                }

                const dataStr = line.substring(6); // Убираем "data: "
                if (dataStr.trim() === '[DONE]') {
                    break;
                }

                try {
                    const chunk = JSON.parse(dataStr);
                    yield chunk;
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
        } finally {
            rl.close();
        }
    }

    /**
     * Стриминг ответов (удобный метод)
     * 
     * @param {Object} options - Опции запроса
     * @returns {AsyncGenerator<Object>} Генератор чанков
     */
    async *chatCompletionsStream(options = {}) {
        yield* this.chatCompletions({ ...options, stream: true });
    }

    // ==================== Image Generations ====================

    /**
     * Генерация изображений
     * 
     * @param {Object} options - Опции запроса
     * @param {string} options.prompt - Описание изображения
     * @param {string} options.model - Модель генерации
     * @param {string} options.size - Размер изображения
     * @param {number} options.n - Количество изображений
     * @returns {Promise<Object>} Результаты генерации
     */
    async imageGenerations(options = {}) {
        const {
            prompt,
            model,
            size = '1024x1024',
            n = 1,
            ...otherOptions
        } = options;

        if (!prompt) {
            throw new Error('prompt обязателен');
        }

        const data = {
            prompt,
            size,
            n,
            ...otherOptions,
        };

        if (model) {
            data.model = model;
        }

        return this._makeRequest('POST', '/api/v1/waygpt/images/generations', data);
    }

    // ==================== Video Generations ====================

    /**
     * Генерация видео
     * 
     * @param {Object} options - Опции запроса
     * @param {string} options.prompt - Описание видео
     * @param {string} options.model - Модель генерации
     * @param {number} options.duration - Длительность в секундах
     * @returns {Promise<Object>} Результат с job_id
     */
    async videoGenerations(options = {}) {
        const {
            prompt,
            model,
            duration,
            ...otherOptions
        } = options;

        if (!prompt) {
            throw new Error('prompt обязателен');
        }

        const data = {
            prompt,
            ...otherOptions,
        };

        if (model) {
            data.model = model;
        }
        if (duration) {
            data.duration = duration;
        }

        return this._makeRequest('POST', '/api/v1/waygpt/videos/generations', data);
    }

    // ==================== Media Jobs ====================

    /**
     * Получение статуса задачи генерации медиа
     * 
     * @param {string} jobId - ID задачи
     * @returns {Promise<Object>} Статус задачи
     */
    async getMediaJob(jobId) {
        return this._makeRequest('GET', `/api/v1/waygpt/media/jobs/${jobId}`);
    }

    /**
     * Отмена задачи генерации медиа
     * 
     * @param {string} jobId - ID задачи
     * @returns {Promise<Object>} Результат отмены
     */
    async cancelMediaJob(jobId) {
        return this._makeRequest('POST', `/api/v1/waygpt/media/jobs/${jobId}/cancel`);
    }

    // ==================== Models ====================

    /**
     * Получение списка доступных моделей
     * 
     * @returns {Promise<Array<string>>} Список ID моделей
     */
    async getModels() {
        return this._makeRequest('GET', '/api/v1/waygpt/models');
    }

    /**
     * Получение полной информации о моделях
     * 
     * @returns {Promise<Array<Object>>} Информация о моделях
     */
    async getModelsFull() {
        return this._makeRequest('GET', '/api/v1/waygpt/models/full');
    }

    // ==================== Use Cases ====================

    /**
     * Получение списка сценариев проекта
     * 
     * @param {boolean} detailed - Если true, запрашивает полную информацию
     * @returns {Promise<Array<Object>>} Список сценариев
     */
    async getUseCases(detailed = false) {
        const endpoint = detailed ? '/api/v1/waygpt/use-cases?detailed=true' : '/api/v1/waygpt/use-cases';
        return this._makeRequest('GET', endpoint);
    }

    // ==================== Widget Token ====================

    /**
     * Создание токена для виджета (браузер)
     * 
     * @param {Object} options - Опции
     * @param {number} options.ttlSeconds - Время жизни токена в секундах
     * @param {string} options.siteDomain - Домен сайта
     * @returns {Promise<Object>} Токен
     */
    async createWidgetToken(options = {}) {
        const {
            ttlSeconds = 600,
            siteDomain,
        } = options;

        const data = {
            ttl_seconds: ttlSeconds,
        };

        if (siteDomain) {
            data.site_domain = siteDomain;
        }

        return this._makeRequest('POST', '/api/v1/widget/token', data);
    }

    // ==================== Client API (JWT) ====================
    // Методы для управления проектами и сценариями через Client API с JWT авторизацией

    /**
     * Выполнение HTTP запроса к Client API с JWT токеном
     * 
     * @param {string} method - HTTP метод
     * @param {string} endpoint - Endpoint
     * @param {string} jwtToken - JWT токен
     * @param {Object} data - Тело запроса
     * @returns {Promise<Object|Array>} Ответ API
     */
    async _makeClientRequest(method, endpoint, jwtToken, data = null) {
        const url = `${this.apiUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
        };

        const config = {
            method,
            url,
            headers,
            timeout: this.timeout,
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }

        try {
            const response = await this.axios(config);

            if (response.status >= 400) {
                const errorMessage = response.data?.detail || response.data?.message || `HTTP ${response.status}`;
                throw new WayGPTError(errorMessage, response.status, response.data);
            }

            return response.data;
        } catch (error) {
            if (error instanceof WayGPTError) {
                throw error;
            }

            if (error.response) {
                const errorMessage = error.response.data?.detail || error.response.data?.message || error.message;
                throw new WayGPTError(errorMessage, error.response.status, error.response.data);
            }

            throw new WayGPTError(`Ошибка сети: ${error.message}`);
        }
    }

    /**
     * Авторизация в Client API (получение JWT токена)
     * 
     * @param {string} email - Email пользователя
     * @param {string} password - Пароль пользователя
     * @returns {Promise<Object>} Токен и информация о сроке действия
     */
    async clientLogin(email, password) {
        const url = `${this.apiUrl}/api/v1/auth/login/access-token`;
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        const data = new URLSearchParams({
            username: email,
            password: password
        });

        try {
            const response = await this.axios.post(url, data.toString(), { headers, timeout: this.timeout });

            if (response.status >= 400) {
                const errorMessage = response.data?.detail || response.data?.message || `HTTP ${response.status}`;
                throw new WayGPTError(errorMessage, response.status, response.data);
            }

            const result = response.data;
            // Добавляем expires_in для совместимости с требованиями
            if (result.access_token) {
                result.token = result.access_token;
                result.expires_in = 3600; // По умолчанию 60 минут
                result.token_type = result.token_type || 'bearer';
            }
            return result;
        } catch (error) {
            if (error instanceof WayGPTError) {
                throw error;
            }

            if (error.response) {
                const errorMessage = error.response.data?.detail || error.response.data?.message || error.message;
                throw new WayGPTError(errorMessage, error.response.status, error.response.data);
            }

            throw new WayGPTError(`Ошибка сети: ${error.message}`);
        }
    }

    // ==================== Projects Management ====================

    /**
     * Получение списка проектов пользователя
     * 
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Array<Object>>} Список проектов
     */
    async clientListProjects(jwtToken) {
        return this._makeClientRequest('GET', '/api/v1/client/projects', jwtToken);
    }

    /**
     * Получение детальной информации о проекте
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Object>} Информация о проекте
     */
    async clientGetProject(projectId, jwtToken) {
        return this._makeClientRequest('GET', `/api/v1/client/projects/${projectId}/settings`, jwtToken);
    }

    /**
     * Создание нового проекта
     * 
     * @param {string} name - Название проекта
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Object>} Информация о созданном проекте
     */
    async clientCreateProject(name, jwtToken) {
        return this._makeClientRequest('POST', '/api/v1/client/projects', jwtToken, { name });
    }

    /**
     * Обновление проекта
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} jwtToken - JWT токен
     * @param {Object} options - Опции обновления
     * @param {string} options.name - Новое название проекта
     * @param {boolean} options.isActive - Активен ли проект
     * @param {Array<string>} options.allowedModels - Список разрешенных моделей
     * @param {Array<string>} options.allowedDomains - Список разрешенных доменов
     * @param {boolean} options.hmacRequired - Требовать ли HMAC подпись
     * @param {number} options.rateLimitRpm - Лимит запросов в минуту
     * @param {number} options.rateLimitRpd - Лимит запросов в день
     * @returns {Promise<Object>} Обновленная информация о проекте
     */
    async clientUpdateProject(projectId, jwtToken, options = {}) {
        const data = {};
        if (options.name !== undefined) data.name = options.name;
        if (options.isActive !== undefined) data.is_active = options.isActive;
        if (options.allowedModels !== undefined) data.allowed_models = options.allowedModels;
        if (options.allowedDomains !== undefined) data.allowed_domains = options.allowedDomains;
        if (options.hmacRequired !== undefined) data.hmac_required = options.hmacRequired;
        if (options.rateLimitRpm !== undefined) data.rate_limit_rpm = options.rateLimitRpm;
        if (options.rateLimitRpd !== undefined) data.rate_limit_rpd = options.rateLimitRpd;

        return this._makeClientRequest('PUT', `/api/v1/client/projects/${projectId}`, jwtToken, data);
    }

    /**
     * Удаление проекта
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Object>} Результат удаления
     */
    async clientDeleteProject(projectId, jwtToken) {
        return this._makeClientRequest('DELETE', `/api/v1/client/projects/${projectId}`, jwtToken);
    }

    // ==================== Use Cases Management (Client API) ====================

    /**
     * Получение списка сценариев проекта (через Client API)
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Array<Object>>} Список сценариев с полной информацией
     */
    async clientListUseCases(projectId, jwtToken) {
        return this._makeClientRequest('GET', `/api/v1/client/projects/${projectId}/use-cases`, jwtToken);
    }

    /**
     * Получение детальной информации о сценарии
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} useCaseId - ID сценария (UUID)
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Object>} Информация о сценарии
     */
    async clientGetUseCase(projectId, useCaseId, jwtToken) {
        const useCases = await this.clientListUseCases(projectId, jwtToken);
        const useCase = useCases.find(uc => uc.id === useCaseId);
        if (!useCase) {
            throw new WayGPTError(`Сценарий с ID ${useCaseId} не найден`, 404);
        }
        return useCase;
    }

    /**
     * Создание нового сценария
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} jwtToken - JWT токен
     * @param {Object} options - Опции сценария
     * @param {string} options.key - Ключ сценария (уникальный в рамках проекта)
     * @param {string} options.name - Название сценария
     * @param {string} options.kind - Тип сценария (chat, catalog_extract, multimodal, image_generation, video_generation, multi)
     * @param {Object} options.config - Конфигурация сценария
     * @param {boolean} options.isActive - Активен ли сценарий
     * @returns {Promise<Object>} Информация о созданном сценарии
     */
    async clientCreateUseCase(projectId, jwtToken, options = {}) {
        const {
            key,
            name,
            kind = 'chat',
            config,
            isActive = true,
        } = options;

        if (!key || !name) {
            throw new Error('key и name обязательны');
        }

        const data = {
            key,
            name,
            kind,
            is_active: isActive,
        };

        if (config !== undefined) {
            data.config = config;
        }

        return this._makeClientRequest('POST', `/api/v1/client/projects/${projectId}/use-cases`, jwtToken, data);
    }

    /**
     * Обновление сценария
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} useCaseId - ID сценария (UUID)
     * @param {string} jwtToken - JWT токен
     * @param {Object} options - Опции обновления
     * @param {string} options.key - Новый ключ сценария
     * @param {string} options.name - Новое название сценария
     * @param {string} options.kind - Новый тип сценария
     * @param {Object} options.config - Новая конфигурация сценария
     * @param {boolean} options.isActive - Новый статус активности
     * @returns {Promise<Object>} Обновленная информация о сценарии
     */
    async clientUpdateUseCase(projectId, useCaseId, jwtToken, options = {}) {
        const data = {};
        if (options.key !== undefined) data.key = options.key;
        if (options.name !== undefined) data.name = options.name;
        if (options.kind !== undefined) data.kind = options.kind;
        if (options.config !== undefined) data.config = options.config;
        if (options.isActive !== undefined) data.is_active = options.isActive;

        return this._makeClientRequest('PUT', `/api/v1/client/projects/${projectId}/use-cases/${useCaseId}`, jwtToken, data);
    }

    /**
     * Удаление сценария
     * 
     * @param {string} projectId - ID проекта (UUID)
     * @param {string} useCaseId - ID сценария (UUID)
     * @param {string} jwtToken - JWT токен
     * @returns {Promise<Object>} Результат удаления
     */
    async clientDeleteUseCase(projectId, useCaseId, jwtToken) {
        return this._makeClientRequest('DELETE', `/api/v1/client/projects/${projectId}/use-cases/${useCaseId}`, jwtToken);
    }
}

module.exports = { WayGPTClient, WayGPTError };
