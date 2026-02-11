<?php
/**
 * Пример использования WayGPT Client API (PHP)
 * Управление проектами и сценариями через JWT авторизацию
 * 
 * Перед запуском:
 * 1. Убедитесь, что у вас установлен PHP 7.4+ с расширениями: curl, json, openssl
 * 2. Укажите ваши учетные данные в коде
 */

require_once __DIR__ . '/../../src/php/WayGPTClient.php';

function main() {
    // Инициализация клиента (для Client API нужен только api_url)
    $client = new WayGPTClient([
        'api_url' => 'https://app.waygpt.ru', // или ваш домен
    ]);

    echo "=== Пример 1: Авторизация в Client API ===\n\n";

    try {
        // Авторизация (получение JWT токена)
        $loginResponse = $client->clientLogin(
            'user@example.com', // Замените на ваш email
            'your_password'     // Замените на ваш пароль
        );
        $jwtToken = $loginResponse['token'];
        echo "✅ Авторизация успешна!\n";
        echo "Токен действителен: {$loginResponse['expires_in']} секунд\n";
        echo "Тип токена: {$loginResponse['token_type']}\n\n";
    } catch (WayGPTException $e) {
        echo "❌ Ошибка авторизации: {$e->getMessage()} (код: {$e->statusCode})\n";
        return;
    }

    echo "=== Пример 2: Управление проектами ===\n\n";

    try {
        // Список проектов
        $projects = $client->clientListProjects($jwtToken);
        echo "Найдено проектов: " . count($projects) . "\n";
        foreach ($projects as $project) {
            echo "  - {$project['name']} (ID: {$project['id']}, активен: " . ($project['is_active'] ? 'да' : 'нет') . ")\n";
        }

        if (!empty($projects)) {
            $projectId = $projects[0]['id'];
            echo "\nИспользуем проект: {$projects[0]['name']}\n";

            // Получение детальной информации о проекте
            $projectDetails = $client->clientGetProject($projectId, $jwtToken);
            echo "\nДетали проекта:\n";
            echo "  API Key: {$projectDetails['api_key']}\n";
            echo "  Разрешенные модели: " . implode(', ', $projectDetails['allowed_models'] ?? []) . "\n";
            echo "  Разрешенные домены: " . implode(', ', $projectDetails['allowed_domains'] ?? []) . "\n";
            echo "  HMAC требуется: " . ($projectDetails['hmac_required'] ?? false ? 'да' : 'нет') . "\n";

            // Обновление проекта
            echo "\nОбновление проекта...\n";
            $updated = $client->clientUpdateProject($projectId, $jwtToken, [
                'name' => $projects[0]['name'] . ' (обновлен)',
                'is_active' => true
            ]);
            echo "✅ Проект обновлен: {$updated['name']}\n";
        }
    } catch (WayGPTException $e) {
        echo "❌ Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }

    echo "\n=== Пример 3: Управление сценариями ===\n\n";

    try {
        $projects = $client->clientListProjects($jwtToken);
        if (empty($projects)) {
            echo "⚠️ Нет проектов для работы со сценариями\n";
            return;
        }

        $projectId = $projects[0]['id'];

        // Список сценариев проекта
        $useCases = $client->clientListUseCases($projectId, $jwtToken);
        echo "Найдено сценариев: " . count($useCases) . "\n";
        foreach ($useCases as $uc) {
            echo "  - {$uc['name']} (key: {$uc['key']}, kind: {$uc['kind']}, активен: " . ($uc['is_active'] ? 'да' : 'нет') . ")\n";
        }

        // Создание нового сценария
        echo "\nСоздание нового сценария...\n";
        $newUseCase = $client->clientCreateUseCase($projectId, $jwtToken, [
            'key' => 'example_chat',
            'name' => 'Пример чата',
            'kind' => 'chat',
            'config' => [
                'system_prompt' => 'Ты дружелюбный помощник. Отвечай кратко и по делу.',
                'models' => [['model_id' => 'gpt-4', 'priority' => 1]],
                'response_format' => 'text',
                'temperature' => 0.7,
                'max_tokens' => 500
            ],
            'is_active' => true
        ]);
        echo "✅ Сценарий создан: {$newUseCase['name']} (ID: {$newUseCase['id']})\n";

        $useCaseId = $newUseCase['id'];

        // Обновление сценария
        echo "\nОбновление сценария...\n";
        $updatedUc = $client->clientUpdateUseCase($projectId, $useCaseId, $jwtToken, [
            'name' => 'Обновленный пример чата',
            'config' => [
                'system_prompt' => 'Ты профессиональный помощник. Отвечай подробно и структурированно.',
                'models' => [['model_id' => 'gpt-4', 'priority' => 1]],
                'response_format' => 'text'
            ]
        ]);
        echo "✅ Сценарий обновлен: {$updatedUc['name']}\n";

        // Получение детальной информации о сценарии
        echo "\nДетали сценария:\n";
        $useCaseDetails = $client->clientGetUseCase($projectId, $useCaseId, $jwtToken);
        echo "  Название: {$useCaseDetails['name']}\n";
        echo "  Ключ: {$useCaseDetails['key']}\n";
        echo "  Тип: {$useCaseDetails['kind']}\n";
        echo "  Конфигурация: " . json_encode($useCaseDetails['config'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";

        // Удаление сценария (раскомментируйте для удаления)
        // echo "\nУдаление сценария...\n";
        // $result = $client->clientDeleteUseCase($projectId, $useCaseId, $jwtToken);
        // echo "✅ Сценарий удален\n";

    } catch (WayGPTException $e) {
        echo "❌ Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }

    echo "\n=== Пример 4: Использование сценария в чате ===\n\n";

    try {
        $projects = $client->clientListProjects($jwtToken);
        if (empty($projects)) {
            echo "⚠️ Нет проектов для работы\n";
            return;
        }

        // Для использования сценария в чате нужен project_key
        // Используем project_key из деталей проекта
        $projectDetails = $client->clientGetProject($projects[0]['id'], $jwtToken);
        $projectKey = $projectDetails['api_key'];

        // Создаем клиент с project_key для использования WayGPT API
        $waygptClient = new WayGPTClient([
            'api_url' => 'https://app.waygpt.ru',
            'project_key' => $projectKey
        ]);

        // Получаем список сценариев (через WayGPT API)
        $useCases = $waygptClient->getUseCases();
        echo "Доступные сценарии (через WayGPT API): " . count($useCases) . "\n";
        foreach ($useCases as $uc) {
            echo "  - " . ($uc['name'] ?? $uc['key']) . " (key: {$uc['key']})\n";
        }

        if (!empty($useCases)) {
            // Используем первый сценарий
            $useCaseKey = $useCases[0]['key'];
            echo "\nИспользование сценария '{$useCaseKey}' в чате...\n";

            $response = $waygptClient->chatCompletions([
                'model' => 'auto',
                'messages' => [
                    ['role' => 'user', 'content' => 'Привет! Расскажи о себе кратко.']
                ],
                'use_case' => $useCaseKey
            ]);
            echo "Ответ: {$response['choices'][0]['message']['content']}\n";
        }
    } catch (WayGPTException $e) {
        echo "❌ Ошибка: {$e->getMessage()} (код: {$e->statusCode})\n";
    }
}

main();
