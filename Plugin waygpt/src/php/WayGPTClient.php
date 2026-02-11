<?php
/**
 * WayGPT Client - PHP SDK для интеграции с AI Server
 * 
 * Требования:
 * - PHP 7.4+
 * - Расширения: curl, json, openssl
 * 
 * Использование:
 *   require_once 'WayGPTClient.php';
 * 
 *   $client = new WayGPTClient([
 *       'api_url' => 'https://app.waygpt.ru',
 *       'project_key' => 'sk_live_...',
 *       'project_id' => 'your-project-id',
 *       'hmac_secret' => 'your-hmac-secret',
 *       'use_hmac' => false
 *   ]);
 * 
 *   $response = $client->chatCompletions([
 *       'model' => 'auto',
 *       'messages' => [
 *           ['role' => 'user', 'content' => 'Привет!']
 *       ]
 *   ]);
 */

class WayGPTException extends Exception {
    public $statusCode;
    public $response;

    public function __construct($message, $statusCode = null, $response = null) {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->response = $response;
    }
}

class WayGPTClient {
    private $apiUrl;
    private $projectKey;
    private $projectId;
    private $hmacSecret;
    private $useHmac;
    private $timeout;
    private $maxRetries;

    /**
     * Инициализация клиента
     * 
     * @param array $options Опции клиента
     * @throws Exception Если не указан project_key
     */
    public function __construct(array $options = []) {
        $this->apiUrl = rtrim($options['api_url'] ?? $_ENV['WAYGPT_API_URL'] ?? 'https://app.waygpt.ru', '/');
        $this->projectKey = $options['project_key'] ?? $_ENV['WAYGPT_PROJECT_KEY'] ?? null;
        $this->projectId = $options['project_id'] ?? $_ENV['WAYGPT_PROJECT_ID'] ?? null;
        $this->hmacSecret = $options['hmac_secret'] ?? $_ENV['WAYGPT_HMAC_SECRET'] ?? null;
        $this->useHmac = $options['use_hmac'] ?? ($_ENV['WAYGPT_USE_HMAC'] ?? 'false') === 'true';
        $this->timeout = $options['timeout'] ?? 60;
        $this->maxRetries = $options['max_retries'] ?? 3;

        if (!$this->projectKey) {
            throw new Exception('project_key обязателен. Укажите при инициализации или через WAYGPT_PROJECT_KEY');
        }

        if ($this->useHmac) {
            if (!$this->projectId) {
                throw new Exception('project_id обязателен при использовании HMAC');
            }
            if (!$this->hmacSecret) {
                throw new Exception('hmac_secret обязателен при использовании HMAC');
            }
        }
    }

    /**
     * Генерация HMAC подписи
     * 
     * @param string $method HTTP метод
     * @param string $path Путь endpoint
     * @param mixed $body Тело запроса
     * @param int $timestamp Unix timestamp
     * @param string $nonce Уникальный nonce
     * @return string HMAC подпись
     */
    private function generateHmacSignature($method, $path, $body, $timestamp, $nonce) {
        // Преобразуем body в строку
        $bodyString = is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : ($body ?? '');

        // Хешируем body
        $bodyHash = hash('sha256', $bodyString);

        // Формируем canonical string
        $canonical = implode("\n", [
            strtoupper($method),
            $path,
            "sha256(body)={$bodyHash}",
            "timestamp={$timestamp}",
            "nonce={$nonce}",
            "project={$this->projectId}",
        ]);

        // Создаём подпись
        $signature = hash_hmac('sha256', $canonical, $this->hmacSecret);

        return $signature;
    }

    /**
     * Подготовка заголовков запроса
     * 
     * @param string $method HTTP метод
     * @param string $path Путь endpoint
     * @param mixed $body Тело запроса
     * @return array Заголовки
     */
    private function prepareHeaders($method, $path, $body = null) {
        $headers = [
            'Content-Type: application/json',
            "x-project-key: {$this->projectKey}",
        ];

        if ($this->useHmac) {
            $timestamp = time();
            $nonce = bin2hex(random_bytes(16));
            $signature = $this->generateHmacSignature($method, $path, $body, $timestamp, $nonce);

            $headers[] = "X-MB-Timestamp: {$timestamp}";
            $headers[] = "X-MB-Nonce: {$nonce}";
            $headers[] = "X-MB-Signature: {$signature}";
        }

        return $headers;
    }

    /**
     * Выполнение HTTP запроса
     * 
     * @param string $method HTTP метод
     * @param string $endpoint Endpoint
     * @param array|null $data Тело запроса
     * @return array Ответ API
     * @throws WayGPTException При ошибках API
     */
    private function makeRequest($method, $endpoint, $data = null) {
        $url = $this->apiUrl . $endpoint;
        $headers = $this->prepareHeaders($method, $endpoint, $data);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CUSTOMREQUEST => $method,
        ]);

        if ($data && ($method === 'POST' || $method === 'PUT')) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        // Retry логика
        $attempt = 0;
        $lastError = null;
        while ($attempt < $this->maxRetries) {
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);

            if ($error) {
                $lastError = new WayGPTException("Ошибка сети: {$error}");
                $attempt++;
                if ($attempt < $this->maxRetries) {
                    usleep(pow(2, $attempt) * 1000000); // Exponential backoff
                    continue;
                }
                curl_close($ch);
                throw $lastError;
            }

            if ($httpCode >= 400) {
                $responseData = json_decode($response, true);
                $errorMessage = $responseData['detail'] ?? $responseData['message'] ?? "HTTP {$httpCode}";
                
                // Retry для 429 и 5xx ошибок
                if (($httpCode === 429 || $httpCode >= 500) && $attempt < $this->maxRetries - 1) {
                    $attempt++;
                    usleep(pow(2, $attempt) * 1000000);
                    continue;
                }

                curl_close($ch);
                throw new WayGPTException($errorMessage, $httpCode, $responseData);
            }

            curl_close($ch);
            return json_decode($response, true);
        }

        curl_close($ch);
        if ($lastError) {
            throw $lastError;
        }

        throw new WayGPTException('Неожиданная ошибка');
    }

    // ==================== Chat Completions ====================

    /**
     * Создание текстового ответа
     * 
     * @param array $options Опции запроса
     * @return array Ответ API
     */
    public function chatCompletions(array $options = []) {
        $model = $options['model'] ?? 'auto';
        $messages = $options['messages'] ?? [];
        $data = [
            'model' => $model,
            'messages' => $messages,
        ];

        $uc = $options['use_case'] ?? $options['use_case_id'] ?? null;
        if ($uc !== null && $uc !== '') {
            $data['use_case'] = is_string($uc) ? trim($uc) : (string) $uc;
        }
        if (isset($options['temperature'])) {
            $data['temperature'] = $options['temperature'];
        }
        if (isset($options['max_tokens'])) {
            $data['max_tokens'] = $options['max_tokens'];
        }
        if (isset($options['stream']) && $options['stream']) {
            $data['stream'] = true;
        }

        // Добавляем дополнительные параметры
        foreach ($options as $key => $value) {
            if (!in_array($key, ['model', 'messages', 'use_case', 'use_case_id', 'temperature', 'max_tokens', 'stream'])) {
                $data[$key] = $value;
            }
        }

        return $this->makeRequest('POST', '/api/v1/waygpt/chat/completions', $data);
    }

    // ==================== Image Generations ====================

    /**
     * Генерация изображений
     * 
     * @param array $options Опции запроса
     * @return array Результаты генерации
     */
    public function imageGenerations(array $options = []) {
        if (!isset($options['prompt'])) {
            throw new Exception('prompt обязателен');
        }

        $data = [
            'prompt' => $options['prompt'],
            'size' => $options['size'] ?? '1024x1024',
            'n' => $options['n'] ?? 1,
        ];

        if (isset($options['model'])) {
            $data['model'] = $options['model'];
        }

        // Добавляем дополнительные параметры
        foreach ($options as $key => $value) {
            if (!in_array($key, ['prompt', 'model', 'size', 'n'])) {
                $data[$key] = $value;
            }
        }

        return $this->makeRequest('POST', '/api/v1/waygpt/images/generations', $data);
    }

    // ==================== Video Generations ====================

    /**
     * Генерация видео
     * 
     * @param array $options Опции запроса
     * @return array Результат с job_id
     */
    public function videoGenerations(array $options = []) {
        if (!isset($options['prompt'])) {
            throw new Exception('prompt обязателен');
        }

        $data = [
            'prompt' => $options['prompt'],
        ];

        if (isset($options['model'])) {
            $data['model'] = $options['model'];
        }
        if (isset($options['duration'])) {
            $data['duration'] = $options['duration'];
        }

        // Добавляем дополнительные параметры
        foreach ($options as $key => $value) {
            if (!in_array($key, ['prompt', 'model', 'duration'])) {
                $data[$key] = $value;
            }
        }

        return $this->makeRequest('POST', '/api/v1/waygpt/videos/generations', $data);
    }

    // ==================== Media Jobs ====================

    /**
     * Получение статуса задачи генерации медиа
     * 
     * @param string $jobId ID задачи
     * @return array Статус задачи
     */
    public function getMediaJob($jobId) {
        return $this->makeRequest('GET', "/api/v1/waygpt/media/jobs/{$jobId}");
    }

    /**
     * Отмена задачи генерации медиа
     * 
     * @param string $jobId ID задачи
     * @return array Результат отмены
     */
    public function cancelMediaJob($jobId) {
        return $this->makeRequest('POST', "/api/v1/waygpt/media/jobs/{$jobId}/cancel");
    }

    // ==================== Models ====================

    /**
     * Получение списка доступных моделей
     * 
     * @return array Список ID моделей
     */
    public function getModels() {
        return $this->makeRequest('GET', '/api/v1/waygpt/models');
    }

    /**
     * Получение полной информации о моделях
     * 
     * @return array Информация о моделях
     */
    public function getModelsFull() {
        return $this->makeRequest('GET', '/api/v1/waygpt/models/full');
    }

    // ==================== Use Cases ====================

    /**
     * Получение списка сценариев проекта
     * 
     * @param bool $detailed Если true, запрашивает полную информацию
     * @return array Список сценариев
     */
    public function getUseCases($detailed = false) {
        $endpoint = $detailed ? '/api/v1/waygpt/use-cases?detailed=true' : '/api/v1/waygpt/use-cases';
        return $this->makeRequest('GET', $endpoint);
    }

    // ==================== Widget Token ====================

    /**
     * Создание токена для виджета (браузер)
     * 
     * @param array $options Опции
     * @return array Токен
     */
    public function createWidgetToken(array $options = []) {
        $data = [
            'ttl_seconds' => $options['ttl_seconds'] ?? 600,
        ];

        if (isset($options['site_domain'])) {
            $data['site_domain'] = $options['site_domain'];
        }

        return $this->makeRequest('POST', '/api/v1/widget/token', $data);
    }

    // ==================== Client API (JWT) ====================
    // Методы для управления проектами и сценариями через Client API с JWT авторизацией

    /**
     * Выполнение HTTP запроса к Client API с JWT токеном
     * 
     * @param string $method HTTP метод
     * @param string $endpoint Endpoint
     * @param string $jwtToken JWT токен
     * @param array|null $data Тело запроса
     * @return array Ответ API
     * @throws WayGPTException При ошибках API
     */
    private function makeClientRequest($method, $endpoint, $jwtToken, $data = null) {
        $url = $this->apiUrl . $endpoint;
        $headers = [
            'Content-Type: application/json',
            "Authorization: Bearer {$jwtToken}",
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CUSTOMREQUEST => $method,
        ]);

        if ($data && ($method === 'POST' || $method === 'PUT')) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new WayGPTException("Ошибка сети: {$error}");
        }

        if ($httpCode >= 400) {
            $responseData = json_decode($response, true);
            $errorMessage = $responseData['detail'] ?? $responseData['message'] ?? "HTTP {$httpCode}";
            throw new WayGPTException($errorMessage, $httpCode, $responseData);
        }

        return json_decode($response, true);
    }

    /**
     * Авторизация в Client API (получение JWT токена)
     * 
     * @param string $email Email пользователя
     * @param string $password Пароль пользователя
     * @return array Токен и информация о сроке действия
     * @throws WayGPTException При ошибках авторизации
     */
    public function clientLogin($email, $password) {
        $url = $this->apiUrl . '/api/v1/auth/login/access-token';
        $headers = ['Content-Type: application/x-www-form-urlencoded'];
        $data = http_build_query([
            'username' => $email,
            'password' => $password
        ]);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $data,
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new WayGPTException("Ошибка сети: {$error}");
        }

        if ($httpCode >= 400) {
            $responseData = json_decode($response, true);
            $errorMessage = $responseData['detail'] ?? $responseData['message'] ?? "HTTP {$httpCode}";
            throw new WayGPTException($errorMessage, $httpCode, $responseData);
        }

        $result = json_decode($response, true);
        // Добавляем expires_in для совместимости с требованиями
        if (isset($result['access_token'])) {
            $result['token'] = $result['access_token'];
            $result['expires_in'] = 3600; // По умолчанию 60 минут
            $result['token_type'] = $result['token_type'] ?? 'bearer';
        }
        return $result;
    }

    // ==================== Projects Management ====================

    /**
     * Получение списка проектов пользователя
     * 
     * @param string $jwtToken JWT токен
     * @return array Список проектов
     */
    public function clientListProjects($jwtToken) {
        return $this->makeClientRequest('GET', '/api/v1/client/projects', $jwtToken);
    }

    /**
     * Получение детальной информации о проекте
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $jwtToken JWT токен
     * @return array Информация о проекте
     */
    public function clientGetProject($projectId, $jwtToken) {
        return $this->makeClientRequest('GET', "/api/v1/client/projects/{$projectId}/settings", $jwtToken);
    }

    /**
     * Создание нового проекта
     * 
     * @param string $name Название проекта
     * @param string $jwtToken JWT токен
     * @return array Информация о созданном проекте
     */
    public function clientCreateProject($name, $jwtToken) {
        return $this->makeClientRequest('POST', '/api/v1/client/projects', $jwtToken, ['name' => $name]);
    }

    /**
     * Обновление проекта
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $jwtToken JWT токен
     * @param array $options Опции обновления
     * @return array Обновленная информация о проекте
     */
    public function clientUpdateProject($projectId, $jwtToken, array $options = []) {
        $data = [];
        if (isset($options['name'])) $data['name'] = $options['name'];
        if (isset($options['is_active'])) $data['is_active'] = $options['is_active'];
        if (isset($options['allowed_models'])) $data['allowed_models'] = $options['allowed_models'];
        if (isset($options['allowed_domains'])) $data['allowed_domains'] = $options['allowed_domains'];
        if (isset($options['hmac_required'])) $data['hmac_required'] = $options['hmac_required'];
        if (isset($options['rate_limit_rpm'])) $data['rate_limit_rpm'] = $options['rate_limit_rpm'];
        if (isset($options['rate_limit_rpd'])) $data['rate_limit_rpd'] = $options['rate_limit_rpd'];

        return $this->makeClientRequest('PUT', "/api/v1/client/projects/{$projectId}", $jwtToken, $data);
    }

    /**
     * Удаление проекта
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $jwtToken JWT токен
     * @return array Результат удаления
     */
    public function clientDeleteProject($projectId, $jwtToken) {
        return $this->makeClientRequest('DELETE', "/api/v1/client/projects/{$projectId}", $jwtToken);
    }

    // ==================== Use Cases Management (Client API) ====================

    /**
     * Получение списка сценариев проекта (через Client API)
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $jwtToken JWT токен
     * @return array Список сценариев с полной информацией
     */
    public function clientListUseCases($projectId, $jwtToken) {
        return $this->makeClientRequest('GET', "/api/v1/client/projects/{$projectId}/use-cases", $jwtToken);
    }

    /**
     * Получение детальной информации о сценарии
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $useCaseId ID сценария (UUID)
     * @param string $jwtToken JWT токен
     * @return array Информация о сценарии
     * @throws WayGPTException Если сценарий не найден
     */
    public function clientGetUseCase($projectId, $useCaseId, $jwtToken) {
        $useCases = $this->clientListUseCases($projectId, $jwtToken);
        foreach ($useCases as $uc) {
            if ($uc['id'] === $useCaseId) {
                return $uc;
            }
        }
        throw new WayGPTException("Сценарий с ID {$useCaseId} не найден", 404);
    }

    /**
     * Создание нового сценария
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $jwtToken JWT токен
     * @param array $options Опции сценария
     * @return array Информация о созданном сценарии
     */
    public function clientCreateUseCase($projectId, $jwtToken, array $options = []) {
        if (!isset($options['key']) || !isset($options['name'])) {
            throw new Exception('key и name обязательны');
        }

        $data = [
            'key' => $options['key'],
            'name' => $options['name'],
            'kind' => $options['kind'] ?? 'chat',
            'is_active' => $options['is_active'] ?? true,
        ];

        if (isset($options['config'])) {
            $data['config'] = $options['config'];
        }

        return $this->makeClientRequest('POST', "/api/v1/client/projects/{$projectId}/use-cases", $jwtToken, $data);
    }

    /**
     * Обновление сценария
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $useCaseId ID сценария (UUID)
     * @param string $jwtToken JWT токен
     * @param array $options Опции обновления
     * @return array Обновленная информация о сценарии
     */
    public function clientUpdateUseCase($projectId, $useCaseId, $jwtToken, array $options = []) {
        $data = [];
        if (isset($options['key'])) $data['key'] = $options['key'];
        if (isset($options['name'])) $data['name'] = $options['name'];
        if (isset($options['kind'])) $data['kind'] = $options['kind'];
        if (isset($options['config'])) $data['config'] = $options['config'];
        if (isset($options['is_active'])) $data['is_active'] = $options['is_active'];

        return $this->makeClientRequest('PUT', "/api/v1/client/projects/{$projectId}/use-cases/{$useCaseId}", $jwtToken, $data);
    }

    /**
     * Удаление сценария
     * 
     * @param string $projectId ID проекта (UUID)
     * @param string $useCaseId ID сценария (UUID)
     * @param string $jwtToken JWT токен
     * @return array Результат удаления
     */
    public function clientDeleteUseCase($projectId, $useCaseId, $jwtToken) {
        return $this->makeClientRequest('DELETE', "/api/v1/client/projects/{$projectId}/use-cases/{$useCaseId}", $jwtToken);
    }
}
