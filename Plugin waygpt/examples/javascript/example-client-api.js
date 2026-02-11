/**
 * Пример использования WayGPT Client API (JavaScript/Node.js)
 * Управление проектами и сценариями через JWT авторизацию
 * 
 * Перед запуском:
 * 1. Установите зависимости: npm install axios
 * 2. Укажите ваши учетные данные в коде
 */

const { WayGPTClient, WayGPTError } = require('../../src/javascript/waygpt-client');

async function main() {
    // Инициализация клиента (для Client API нужен только apiUrl)
    const client = new WayGPTClient({
        apiUrl: 'https://app.waygpt.ru', // или ваш домен
    });

    console.log('=== Пример 1: Авторизация в Client API ===\n');

    let jwtToken;
    try {
        // Авторизация (получение JWT токена)
        const loginResponse = await client.clientLogin(
            'user@example.com', // Замените на ваш email
            'your_password'     // Замените на ваш пароль
        );
        jwtToken = loginResponse.token;
        console.log('✅ Авторизация успешна!');
        console.log(`Токен действителен: ${loginResponse.expires_in} секунд`);
        console.log(`Тип токена: ${loginResponse.token_type}\n`);
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`❌ Ошибка авторизации: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error(`❌ Ошибка: ${error.message}`);
        }
        return;
    }

    console.log('=== Пример 2: Управление проектами ===\n');

    try {
        // Список проектов
        const projects = await client.clientListProjects(jwtToken);
        console.log(`Найдено проектов: ${projects.length}`);
        projects.forEach(project => {
            console.log(`  - ${project.name} (ID: ${project.id}, активен: ${project.is_active})`);
        });

        if (projects.length > 0) {
            const projectId = projects[0].id;
            console.log(`\nИспользуем проект: ${projects[0].name}`);

            // Получение детальной информации о проекте
            const projectDetails = await client.clientGetProject(projectId, jwtToken);
            console.log('\nДетали проекта:');
            console.log(`  API Key: ${projectDetails.api_key}`);
            console.log(`  Разрешенные модели: ${projectDetails.allowed_models || []}`);
            console.log(`  Разрешенные домены: ${projectDetails.allowed_domains || []}`);
            console.log(`  HMAC требуется: ${projectDetails.hmac_required || false}`);

            // Обновление проекта
            console.log('\nОбновление проекта...');
            const updated = await client.clientUpdateProject(projectId, jwtToken, {
                name: `${projects[0].name} (обновлен)`,
                isActive: true
            });
            console.log(`✅ Проект обновлен: ${updated.name}`);
        }
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`❌ Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error(`❌ Ошибка: ${error.message}`);
        }
    }

    console.log('\n=== Пример 3: Управление сценариями ===\n');

    try {
        const projects = await client.clientListProjects(jwtToken);
        if (projects.length === 0) {
            console.log('⚠️ Нет проектов для работы со сценариями');
            return;
        }

        const projectId = projects[0].id;

        // Список сценариев проекта
        const useCases = await client.clientListUseCases(projectId, jwtToken);
        console.log(`Найдено сценариев: ${useCases.length}`);
        useCases.forEach(uc => {
            console.log(`  - ${uc.name} (key: ${uc.key}, kind: ${uc.kind}, активен: ${uc.is_active})`);
        });

        // Создание нового сценария
        console.log('\nСоздание нового сценария...');
        const newUseCase = await client.clientCreateUseCase(projectId, jwtToken, {
            key: 'example_chat',
            name: 'Пример чата',
            kind: 'chat',
            config: {
                system_prompt: 'Ты дружелюбный помощник. Отвечай кратко и по делу.',
                models: [{ model_id: 'gpt-4', priority: 1 }],
                response_format: 'text',
                temperature: 0.7,
                max_tokens: 500
            },
            isActive: true
        });
        console.log(`✅ Сценарий создан: ${newUseCase.name} (ID: ${newUseCase.id})`);

        const useCaseId = newUseCase.id;

        // Обновление сценария
        console.log('\nОбновление сценария...');
        const updatedUc = await client.clientUpdateUseCase(projectId, useCaseId, jwtToken, {
            name: 'Обновленный пример чата',
            config: {
                system_prompt: 'Ты профессиональный помощник. Отвечай подробно и структурированно.',
                models: [{ model_id: 'gpt-4', priority: 1 }],
                response_format: 'text'
            }
        });
        console.log(`✅ Сценарий обновлен: ${updatedUc.name}`);

        // Получение детальной информации о сценарии
        console.log('\nДетали сценария:');
        const useCaseDetails = await client.clientGetUseCase(projectId, useCaseId, jwtToken);
        console.log(`  Название: ${useCaseDetails.name}`);
        console.log(`  Ключ: ${useCaseDetails.key}`);
        console.log(`  Тип: ${useCaseDetails.kind}`);
        console.log(`  Конфигурация:`, useCaseDetails.config || {});

        // Удаление сценария (раскомментируйте для удаления)
        // console.log('\nУдаление сценария...');
        // const result = await client.clientDeleteUseCase(projectId, useCaseId, jwtToken);
        // console.log(`✅ Сценарий удален:`, result);

    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`❌ Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error(`❌ Ошибка: ${error.message}`);
        }
    }

    console.log('\n=== Пример 4: Использование сценария в чате ===\n');

    try {
        const projects = await client.clientListProjects(jwtToken);
        if (projects.length === 0) {
            console.log('⚠️ Нет проектов для работы');
            return;
        }

        // Для использования сценария в чате нужен projectKey
        // Используем projectKey из деталей проекта
        const projectDetails = await client.clientGetProject(projects[0].id, jwtToken);
        const projectKey = projectDetails.api_key;

        // Создаем клиент с projectKey для использования WayGPT API
        const waygptClient = new WayGPTClient({
            apiUrl: 'https://app.waygpt.ru',
            projectKey: projectKey
        });

        // Получаем список сценариев (через WayGPT API)
        const useCases = await waygptClient.getUseCases();
        console.log(`Доступные сценарии (через WayGPT API): ${useCases.length}`);
        useCases.forEach(uc => {
            console.log(`  - ${uc.name || uc.key} (key: ${uc.key})`);
        });

        if (useCases.length > 0) {
            // Используем первый сценарий
            const useCaseKey = useCases[0].key;
            console.log(`\nИспользование сценария '${useCaseKey}' в чате...`);

            const response = await waygptClient.chatCompletions({
                model: 'auto',
                messages: [
                    { role: 'user', content: 'Привет! Расскажи о себе кратко.' }
                ],
                useCase: useCaseKey
            });
            console.log(`Ответ: ${response.choices[0].message.content}`);
        }
    } catch (error) {
        if (error instanceof WayGPTError) {
            console.error(`❌ Ошибка: ${error.message} (код: ${error.statusCode})`);
        } else {
            console.error(`❌ Ошибка: ${error.message}`);
        }
    }
}

main().catch(console.error);
