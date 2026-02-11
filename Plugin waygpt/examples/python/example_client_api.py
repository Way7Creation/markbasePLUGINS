"""
Пример использования WayGPT Client API (Python)
Управление проектами и сценариями через JWT авторизацию

Перед запуском:
1. Установите зависимости: pip install requests
2. Укажите ваши учетные данные в коде
"""

import sys
import os

# Добавляем путь к SDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/python'))

from waygpt_client import WayGPTClient, WayGPTError


def main():
    # Инициализация клиента (для Client API нужен только api_url)
    client = WayGPTClient(
        api_url="https://app.waygpt.ru",  # или ваш домен
    )

    print("=== Пример 1: Авторизация в Client API ===\n")

    try:
        # Авторизация (получение JWT токена)
        login_response = client.client_login(
            email="user@example.com",  # Замените на ваш email
            password="your_password"    # Замените на ваш пароль
        )
        jwt_token = login_response["token"]
        print(f"✅ Авторизация успешна!")
        print(f"Токен действителен: {login_response['expires_in']} секунд")
        print(f"Тип токена: {login_response['token_type']}\n")
    except WayGPTError as e:
        print(f"❌ Ошибка авторизации: {e.message} (код: {e.status_code})")
        return

    print("=== Пример 2: Управление проектами ===\n")

    try:
        # Список проектов
        projects = client.client_list_projects(jwt_token)
        print(f"Найдено проектов: {len(projects)}")
        for project in projects:
            print(f"  - {project['name']} (ID: {project['id']}, активен: {project['is_active']})")

        if projects:
            project_id = projects[0]['id']
            print(f"\nИспользуем проект: {projects[0]['name']}")

            # Получение детальной информации о проекте
            project_details = client.client_get_project(project_id, jwt_token)
            print(f"\nДетали проекта:")
            print(f"  API Key: {project_details['api_key']}")
            print(f"  Разрешенные модели: {project_details.get('allowed_models', [])}")
            print(f"  Разрешенные домены: {project_details.get('allowed_domains', [])}")
            print(f"  HMAC требуется: {project_details.get('hmac_required', False)}")

            # Обновление проекта
            print(f"\nОбновление проекта...")
            updated = client.client_update_project(
                project_id=project_id,
                jwt_token=jwt_token,
                name=f"{projects[0]['name']} (обновлен)",
                is_active=True
            )
            print(f"✅ Проект обновлен: {updated['name']}")

    except WayGPTError as e:
        print(f"❌ Ошибка: {e.message} (код: {e.status_code})")

    print("\n=== Пример 3: Управление сценариями ===\n")

    try:
        if not projects:
            print("⚠️ Нет проектов для работы со сценариями")
            return

        project_id = projects[0]['id']

        # Список сценариев проекта
        use_cases = client.client_list_use_cases(project_id, jwt_token)
        print(f"Найдено сценариев: {len(use_cases)}")
        for uc in use_cases:
            print(f"  - {uc['name']} (key: {uc['key']}, kind: {uc['kind']}, активен: {uc['is_active']})")

        # Создание нового сценария
        print(f"\nСоздание нового сценария...")
        new_use_case = client.client_create_use_case(
            project_id=project_id,
            jwt_token=jwt_token,
            key="example_chat",
            name="Пример чата",
            kind="chat",
            config={
                "system_prompt": "Ты дружелюбный помощник. Отвечай кратко и по делу.",
                "models": [{"model_id": "gpt-4", "priority": 1}],
                "response_format": "text",
                "temperature": 0.7,
                "max_tokens": 500
            },
            is_active=True
        )
        print(f"✅ Сценарий создан: {new_use_case['name']} (ID: {new_use_case['id']})")

        use_case_id = new_use_case['id']

        # Обновление сценария
        print(f"\nОбновление сценария...")
        updated_uc = client.client_update_use_case(
            project_id=project_id,
            use_case_id=use_case_id,
            jwt_token=jwt_token,
            name="Обновленный пример чата",
            config={
                "system_prompt": "Ты профессиональный помощник. Отвечай подробно и структурированно.",
                "models": [{"model_id": "gpt-4", "priority": 1}],
                "response_format": "text"
            }
        )
        print(f"✅ Сценарий обновлен: {updated_uc['name']}")

        # Получение детальной информации о сценарии
        print(f"\nДетали сценария:")
        use_case_details = client.client_get_use_case(project_id, use_case_id, jwt_token)
        print(f"  Название: {use_case_details['name']}")
        print(f"  Ключ: {use_case_details['key']}")
        print(f"  Тип: {use_case_details['kind']}")
        print(f"  Конфигурация: {use_case_details.get('config', {})}")

        # Удаление сценария (раскомментируйте для удаления)
        # print(f"\nУдаление сценария...")
        # result = client.client_delete_use_case(project_id, use_case_id, jwt_token)
        # print(f"✅ Сценарий удален: {result}")

    except WayGPTError as e:
        print(f"❌ Ошибка: {e.message} (код: {e.status_code})")

    print("\n=== Пример 4: Использование сценария в чате ===\n")

    try:
        if not projects:
            print("⚠️ Нет проектов для работы")
            return

        # Для использования сценария в чате нужен project_key
        # Используем project_key из деталей проекта
        project_details = client.client_get_project(projects[0]['id'], jwt_token)
        project_key = project_details['api_key']

        # Создаем клиент с project_key для использования WayGPT API
        waygpt_client = WayGPTClient(
            api_url="https://app.waygpt.ru",
            project_key=project_key
        )

        # Получаем список сценариев (через WayGPT API)
        use_cases = waygpt_client.get_use_cases()
        print(f"Доступные сценарии (через WayGPT API): {len(use_cases)}")
        for uc in use_cases:
            print(f"  - {uc.get('name', uc.get('key'))} (key: {uc.get('key')})")

        if use_cases:
            # Используем первый сценарий
            use_case_key = use_cases[0].get('key')
            print(f"\nИспользование сценария '{use_case_key}' в чате...")

            response = waygpt_client.chat_completions(
                model="auto",
                messages=[
                    {"role": "user", "content": "Привет! Расскажи о себе кратко."}
                ],
                use_case=use_case_key
            )
            print(f"Ответ: {response['choices'][0]['message']['content']}")

    except WayGPTError as e:
        print(f"❌ Ошибка: {e.message} (код: {e.status_code})")


if __name__ == "__main__":
    main()
