"""WayGPT Client - Python SDK для интеграции с AI Server."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Iterator, List, Optional, Union, cast

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class WayGPTError(Exception):
    """Базовый класс для ошибок WayGPT API"""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class WayGPTClient:
    """Клиент для работы с WayGPT API"""

    def __init__(
        self,
        api_url: Optional[str] = None,
        project_key: Optional[str] = None,
        project_id: Optional[str] = None,
        hmac_secret: Optional[str] = None,
        use_hmac: bool = False,
        timeout: int = 60,
        max_retries: int = 3
    ) -> None:
        """
        Инициализация клиента

        Args:
            api_url: URL API сервера (по умолчанию из WAYGPT_API_URL)
            project_key: Project Key (по умолчанию из WAYGPT_PROJECT_KEY)
            project_id: Project ID для HMAC (по умолчанию из WAYGPT_PROJECT_ID)
            hmac_secret: HMAC Secret (по умолчанию из WAYGPT_HMAC_SECRET)
            use_hmac: Включить HMAC подпись (по умолчанию из WAYGPT_USE_HMAC)
            timeout: Таймаут запросов в секундах
            max_retries: Максимальное количество повторов при ошибках
        """
        self.api_url = (api_url or os.getenv("WAYGPT_API_URL") or "https://app.waygpt.ru").rstrip("/")
        _pk = project_key or os.getenv("WAYGPT_PROJECT_KEY")
        self.project_key = _pk
        self.project_id = project_id or os.getenv("WAYGPT_PROJECT_ID")
        self.hmac_secret = hmac_secret or os.getenv("WAYGPT_HMAC_SECRET")
        self.use_hmac = use_hmac or (os.getenv("WAYGPT_USE_HMAC", "false").lower() == "true")
        self.timeout = timeout

        if not _pk or not str(_pk).strip():
            raise ValueError("project_key обязателен. Укажите при инициализации или через WAYGPT_PROJECT_KEY")

        if self.use_hmac:
            if not self.project_id:
                raise ValueError("project_id обязателен при использовании HMAC")
            if not self.hmac_secret:
                raise ValueError("hmac_secret обязателен при использовании HMAC")

        # Настройка сессии с retry
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _generate_hmac_signature(
        self,
        method: str,
        path: str,
        body: Optional[Union[str, bytes, Dict[str, Any]]],
        timestamp: int,
        nonce: str
    ) -> str:
        """Генерация HMAC подписи"""
        # Преобразуем body в bytes (используем стандартную сериализацию как в requests)
        if isinstance(body, dict):
            body_string = json.dumps(body, ensure_ascii=False, sort_keys=False)
            body_bytes = body_string.encode("utf-8")
        elif isinstance(body, str):
            body_bytes = body.encode("utf-8")
        elif isinstance(body, bytes):
            body_bytes = body
        else:
            body_bytes = b""

        # Хешируем body
        body_hash = hashlib.sha256(body_bytes).hexdigest()

        # Формируем canonical string
        canonical = "\n".join([
            method.upper(),
            path,
            f"sha256(body)={body_hash}",
            f"timestamp={timestamp}",
            f"nonce={nonce}",
            f"project={self.project_id}",
        ])

        # Создаём подпись (вызывается только при use_hmac; secret и project_id проверены в __init__)
        _secret = self.hmac_secret if self.hmac_secret is not None else ""
        signature = hmac.new(
            _secret.encode("utf-8"),
            canonical.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return signature

    def _prepare_headers(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """Подготовка заголовков запроса"""
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "x-project-key": str(self.project_key),
        }

        if self.use_hmac:
            timestamp = int(time.time())
            nonce = secrets.token_hex(16)
            signature = self._generate_hmac_signature(method, path, body, timestamp, nonce)

            headers.update({
                "X-MB-Timestamp": str(timestamp),
                "X-MB-Nonce": nonce,
                "X-MB-Signature": signature,
            })

        return headers

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        stream: bool = False
    ) -> Union[Dict[str, Any], List[Any], requests.Response]:
        """
        Выполнение HTTP запроса

        Args:
            method: HTTP метод (GET, POST, PUT)
            endpoint: Endpoint (например, "/api/v1/waygpt/models")
            data: Тело запроса (для POST/PUT)
            stream: Включить стриминг ответа

        Returns:
            Dict для обычных запросов, Response для стриминга

        Raises:
            WayGPTError: При ошибках API
        """
        url = f"{self.api_url}{endpoint}"
        headers = self._prepare_headers(method, endpoint, data)

        try:
            if method == "GET":
                response = self.session.get(url, headers=headers, timeout=self.timeout, stream=stream)
            elif method == "POST":
                response = self.session.post(
                    url,
                    headers=headers,
                    json=data,
                    timeout=self.timeout,
                    stream=stream
                )
            elif method == "PUT":
                response = self.session.put(
                    url,
                    headers=headers,
                    json=data,
                    timeout=self.timeout
                )
            else:
                raise ValueError(f"Неподдерживаемый метод: {method}")

            # Обработка ошибок
            if response.status_code >= 400:
                error_data: Optional[Dict[str, Any]] = None
                try:
                    error_data = response.json()
                    error_message = (error_data.get("detail") or error_data.get("message") or "Unknown error") if isinstance(error_data, dict) else "Unknown error"
                except Exception:
                    error_message = response.text or f"HTTP {response.status_code}"

                raise WayGPTError(
                    message=str(error_message),
                    status_code=response.status_code,
                    response=error_data
                )

            if stream:
                return response

            return response.json()

        except requests.exceptions.RequestException as e:
            raise WayGPTError(f"Ошибка сети: {str(e)}")
        except WayGPTError:
            raise
        except Exception as e:
            raise WayGPTError(f"Неожиданная ошибка: {str(e)}")

    # ==================== Chat Completions ====================

    def chat_completions(
        self,
        model: str = "auto",
        messages: Optional[List[Dict[str, Any]]] = None,
        use_case_id: Optional[str] = None,
        use_case: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **kwargs: Any
    ) -> Union[Dict[str, Any], Iterator[Dict[str, Any]]]:
        """
        Создание текстового ответа

        Args:
            model: ID модели или "auto"
            messages: Список сообщений [{"role": "user", "content": "..."}]
            use_case_id: Устаревший алиас. Используйте use_case (ключ сценария).
            use_case: Ключ сценария (например "support_chat"). См. get_use_cases().
            temperature: Температура генерации (0.0-2.0)
            max_tokens: Максимальная длина ответа
            stream: Включить стриминг
            **kwargs: Дополнительные параметры

        Returns:
            Dict с ответом или Iterator для стриминга
        """
        if messages is None:
            messages = []

        data = {
            "model": model,
            "messages": messages,
            **kwargs
        }

        uc = use_case or use_case_id or kwargs.get("use_case")
        if uc:
            data["use_case"] = str(uc).strip()
        if temperature is not None:
            data["temperature"] = temperature
        if max_tokens is not None:
            data["max_tokens"] = max_tokens
        if stream:
            data["stream"] = True

        if stream:
            return self._chat_completions_stream(data)
        out = self._make_request("POST", "/api/v1/waygpt/chat/completions", data)
        return cast(Dict[str, Any], out)

    def _chat_completions_stream(self, data: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
        """Стриминг ответов chat completions"""
        resp = self._make_request("POST", "/api/v1/waygpt/chat/completions", data, stream=True)
        assert isinstance(resp, requests.Response)

        try:
            for line in resp.iter_lines():
                if not line:
                    continue

                line_str = line.decode("utf-8")
                if line_str.startswith('data: '):
                    data_str = line_str[6:]  # Убираем "data: "
                    if data_str.strip() == '[DONE]':
                        break

                    try:
                        chunk = json.loads(data_str)
                        yield chunk
                    except json.JSONDecodeError:
                        continue
        finally:
            resp.close()

    def chat_completions_stream(
        self,
        model: str = "auto",
        messages: Optional[List[Dict[str, Any]]] = None,
        use_case_id: Optional[str] = None,
        use_case: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> Iterator[Dict[str, Any]]:
        """
        Стриминг ответов (удобный метод)

        Args:
            model: ID модели или "auto"
            messages: Список сообщений
            use_case_id: Устаревший алиас. Используйте use_case (ключ сценария).
            use_case: Ключ сценария (например "support_chat")
            temperature: Температура генерации
            max_tokens: Максимальная длина ответа
            **kwargs: Дополнительные параметры

        Yields:
            Dict с чанками ответа
        """
        gen = self.chat_completions(
            model=model,
            messages=messages,
            use_case_id=use_case_id,
            use_case=use_case,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs
        )
        return cast(Iterator[Dict[str, Any]], gen)

    # ==================== Image Generations ====================

    def image_generations(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Генерация изображений

        Args:
            prompt: Описание изображения
            model: Модель генерации (опционально)
            size: Размер изображения (например, "1024x1024")
            n: Количество изображений
            **kwargs: Дополнительные параметры

        Returns:
            Dict с результатами генерации
        """
        data = {
            "prompt": prompt,
            "size": size,
            "n": n,
            **kwargs
        }

        if model:
            data["model"] = model

        return cast(Dict[str, Any], self._make_request("POST", "/api/v1/waygpt/images/generations", data))

    # ==================== Video Generations ====================

    def video_generations(
        self,
        prompt: str,
        model: Optional[str] = None,
        duration: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Генерация видео

        Args:
            prompt: Описание видео
            model: Модель генерации (опционально)
            duration: Длительность в секундах
            **kwargs: Дополнительные параметры

        Returns:
            Dict с job_id задачи
        """
        data = {
            "prompt": prompt,
            **kwargs
        }

        if model:
            data["model"] = model
        if duration:
            data["duration"] = duration

        return cast(Dict[str, Any], self._make_request("POST", "/api/v1/waygpt/videos/generations", data))

    # ==================== Media Jobs ====================

    def get_media_job(self, job_id: str) -> Dict[str, Any]:
        """
        Получение статуса задачи генерации медиа

        Args:
            job_id: ID задачи

        Returns:
            Dict со статусом задачи
        """
        return self._make_request("GET", f"/api/v1/waygpt/media/jobs/{job_id}")

    def cancel_media_job(self, job_id: str) -> Dict[str, Any]:
        """
        Отмена задачи генерации медиа

        Args:
            job_id: ID задачи

        Returns:
            Dict с результатом отмены
        """
        return cast(Dict[str, Any], self._make_request("POST", f"/api/v1/waygpt/media/jobs/{job_id}/cancel"))

    # ==================== Models ====================

    def get_models(self) -> List[str]:
        """
        Получение списка доступных моделей

        Returns:
            List[str] с ID моделей
        """
        return cast(List[str], self._make_request("GET", "/api/v1/waygpt/models"))

    def get_models_full(self) -> List[Dict]:
        """
        Получение полной информации о моделях

        Returns:
            List[Dict] с информацией о моделях
        """
        return cast(List[Dict[str, Any]], self._make_request("GET", "/api/v1/waygpt/models/full"))

    # ==================== Use Cases ====================

    def get_use_cases(self, detailed: bool = False) -> List[Dict[str, Any]]:
        """
        Получение списка сценариев проекта

        Args:
            detailed: Если True, запрашивает полную информацию (если поддерживается API)

        Returns:
            List[Dict] со сценариями. Каждый сценарий содержит:
            - key: Ключ сценария
            - name: Название сценария
            - kind: Тип сценария (chat, image_generation, video_generation, etc.)
            - config: Конфигурация сценария (system_prompt, models, parameters, и т.д.)
            При detailed=True также может содержать id, description, created_at, updated_at
        """
        endpoint = "/api/v1/waygpt/use-cases"
        if detailed:
            endpoint += "?detailed=true"
        return cast(List[Dict[str, Any]], self._make_request("GET", endpoint))

    # ==================== Widget Token ====================

    def create_widget_token(
        self,
        ttl_seconds: int = 600,
        site_domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Создание токена для виджета (браузер)

        Args:
            ttl_seconds: Время жизни токена в секундах
            site_domain: Домен сайта (опционально)

        Returns:
            Dict с токеном
        """
        data: Dict[str, Any] = {"ttl_seconds": ttl_seconds}
        if site_domain:
            data["site_domain"] = site_domain
        return cast(Dict[str, Any], self._make_request("POST", "/api/v1/widget/token", data))

    # ==================== Client API (JWT) ====================
    # Методы для управления проектами и сценариями через Client API с JWT авторизацией

    def _prepare_client_headers(self, jwt_token: str) -> Dict[str, str]:
        """Подготовка заголовков для Client API с JWT токеном"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }

    def _make_client_request(
        self,
        method: str,
        endpoint: str,
        jwt_token: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Union[Dict[str, Any], List[Any]]:
        """
        Выполнение HTTP запроса к Client API с JWT токеном

        Args:
            method: HTTP метод (GET, POST, PUT, DELETE)
            endpoint: Endpoint (например, "/api/v1/client/projects")
            jwt_token: JWT токен для авторизации
            data: Тело запроса (для POST/PUT)

        Returns:
            Dict или List с ответом API

        Raises:
            WayGPTError: При ошибках API
        """
        url = f"{self.api_url}{endpoint}"
        headers = self._prepare_client_headers(jwt_token)

        try:
            if method == "GET":
                response = self.session.get(url, headers=headers, timeout=self.timeout)
            elif method == "POST":
                response = self.session.post(url, headers=headers, json=data, timeout=self.timeout)
            elif method == "PUT":
                response = self.session.put(url, headers=headers, json=data, timeout=self.timeout)
            elif method == "DELETE":
                response = self.session.delete(url, headers=headers, timeout=self.timeout)
            else:
                raise ValueError(f"Неподдерживаемый метод: {method}")

            if response.status_code >= 400:
                error_data: Optional[Dict[str, Any]] = None
                try:
                    error_data = response.json()
                    error_message = (error_data.get("detail") or error_data.get("message") or "Unknown error") if isinstance(error_data, dict) else "Unknown error"
                except Exception:
                    error_message = response.text or f"HTTP {response.status_code}"

                raise WayGPTError(
                    message=str(error_message),
                    status_code=response.status_code,
                    response=error_data
                )

            return response.json()

        except requests.exceptions.RequestException as e:
            raise WayGPTError(f"Ошибка сети: {str(e)}")
        except WayGPTError:
            raise
        except Exception as e:
            raise WayGPTError(f"Неожиданная ошибка: {str(e)}")

    def client_login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Авторизация в Client API (получение JWT токена)

        Args:
            email: Email пользователя
            password: Пароль пользователя

        Returns:
            Dict с токеном и информацией о сроке действия
        """
        url = f"{self.api_url}/api/v1/auth/login/access-token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "username": email,
            "password": password
        }

        try:
            response = self.session.post(url, headers=headers, data=data, timeout=self.timeout)
            if response.status_code >= 400:
                error_data: Optional[Dict[str, Any]] = None
                try:
                    error_data = response.json()
                    error_message = (error_data.get("detail") or error_data.get("message") or "Unknown error") if isinstance(error_data, dict) else "Unknown error"
                except Exception:
                    error_message = response.text or f"HTTP {response.status_code}"

                raise WayGPTError(
                    message=str(error_message),
                    status_code=response.status_code,
                    response=error_data
                )

            result = response.json()
            # Добавляем expires_in для совместимости с требованиями
            if "access_token" in result:
                # По умолчанию токен живет 60 минут (3600 секунд)
                result["token"] = result["access_token"]
                result["expires_in"] = 3600
                result["token_type"] = result.get("token_type", "bearer")
            return result

        except requests.exceptions.RequestException as e:
            raise WayGPTError(f"Ошибка сети: {str(e)}")
        except WayGPTError:
            raise
        except Exception as e:
            raise WayGPTError(f"Неожиданная ошибка: {str(e)}")

    # ==================== Projects Management ====================

    def client_list_projects(self, jwt_token: str) -> List[Dict[str, Any]]:
        """
        Получение списка проектов пользователя

        Args:
            jwt_token: JWT токен для авторизации

        Returns:
            List[Dict] со списком проектов
        """
        return cast(List[Dict[str, Any]], self._make_client_request("GET", "/api/v1/client/projects", jwt_token))

    def client_get_project(self, project_id: str, jwt_token: str) -> Dict[str, Any]:
        """
        Получение детальной информации о проекте

        Args:
            project_id: ID проекта (UUID)
            jwt_token: JWT токен для авторизации

        Returns:
            Dict с информацией о проекте
        """
        return cast(Dict[str, Any], self._make_client_request("GET", f"/api/v1/client/projects/{project_id}/settings", jwt_token))

    def client_create_project(self, name: str, jwt_token: str) -> Dict[str, Any]:
        """
        Создание нового проекта

        Args:
            name: Название проекта
            jwt_token: JWT токен для авторизации

        Returns:
            Dict с информацией о созданном проекте
        """
        data = {"name": name}
        return cast(Dict[str, Any], self._make_client_request("POST", "/api/v1/client/projects", jwt_token, data))

    def client_update_project(
        self,
        project_id: str,
        jwt_token: str,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        allowed_models: Optional[List[str]] = None,
        allowed_domains: Optional[List[str]] = None,
        hmac_required: Optional[bool] = None,
        rate_limit_rpm: Optional[int] = None,
        rate_limit_rpd: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Обновление проекта

        Args:
            project_id: ID проекта (UUID)
            jwt_token: JWT токен для авторизации
            name: Новое название проекта
            is_active: Активен ли проект
            allowed_models: Список разрешенных моделей
            allowed_domains: Список разрешенных доменов
            hmac_required: Требовать ли HMAC подпись
            rate_limit_rpm: Лимит запросов в минуту
            rate_limit_rpd: Лимит запросов в день

        Returns:
            Dict с обновленной информацией о проекте
        """
        data: Dict[str, Any] = {}
        if name is not None:
            data["name"] = name
        if is_active is not None:
            data["is_active"] = is_active
        if allowed_models is not None:
            data["allowed_models"] = allowed_models
        if allowed_domains is not None:
            data["allowed_domains"] = allowed_domains
        if hmac_required is not None:
            data["hmac_required"] = hmac_required
        if rate_limit_rpm is not None:
            data["rate_limit_rpm"] = rate_limit_rpm
        if rate_limit_rpd is not None:
            data["rate_limit_rpd"] = rate_limit_rpd

        return cast(Dict[str, Any], self._make_client_request("PUT", f"/api/v1/client/projects/{project_id}", jwt_token, data))

    def client_delete_project(self, project_id: str, jwt_token: str) -> Dict[str, Any]:
        """
        Удаление проекта

        Args:
            project_id: ID проекта (UUID)
            jwt_token: JWT токен для авторизации

        Returns:
            Dict с результатом удаления
        """
        return cast(Dict[str, Any], self._make_client_request("DELETE", f"/api/v1/client/projects/{project_id}", jwt_token))

    # ==================== Use Cases Management (Client API) ====================

    def client_list_use_cases(self, project_id: str, jwt_token: str) -> List[Dict[str, Any]]:
        """
        Получение списка сценариев проекта (через Client API)

        Args:
            project_id: ID проекта (UUID)
            jwt_token: JWT токен для авторизации

        Returns:
            List[Dict] со списком сценариев с полной информацией
        """
        return cast(List[Dict[str, Any]], self._make_client_request("GET", f"/api/v1/client/projects/{project_id}/use-cases", jwt_token))

    def client_get_use_case(self, project_id: str, use_case_id: str, jwt_token: str) -> Dict[str, Any]:
        """
        Получение детальной информации о сценарии

        Args:
            project_id: ID проекта (UUID)
            use_case_id: ID сценария (UUID)
            jwt_token: JWT токен для авторизации

        Returns:
            Dict с информацией о сценарии
        """
        # Получаем список и находим нужный сценарий
        use_cases = self.client_list_use_cases(project_id, jwt_token)
        for uc in use_cases:
            if uc.get("id") == use_case_id:
                return uc
        raise WayGPTError(f"Сценарий с ID {use_case_id} не найден", status_code=404)

    def client_create_use_case(
        self,
        project_id: str,
        jwt_token: str,
        key: str,
        name: str,
        kind: str = "chat",
        config: Optional[Dict[str, Any]] = None,
        is_active: bool = True
    ) -> Dict[str, Any]:
        """
        Создание нового сценария

        Args:
            project_id: ID проекта (UUID)
            jwt_token: JWT токен для авторизации
            key: Ключ сценария (уникальный в рамках проекта)
            name: Название сценария
            kind: Тип сценария (chat, catalog_extract, multimodal, image_generation, video_generation, multi)
            config: Конфигурация сценария (system_prompt, models, и т.д.)
            is_active: Активен ли сценарий

        Returns:
            Dict с информацией о созданном сценарии
        """
        data: Dict[str, Any] = {
            "key": key,
            "name": name,
            "kind": kind,
            "is_active": is_active
        }
        if config is not None:
            data["config"] = config

        return cast(Dict[str, Any], self._make_client_request("POST", f"/api/v1/client/projects/{project_id}/use-cases", jwt_token, data))

    def client_update_use_case(
        self,
        project_id: str,
        use_case_id: str,
        jwt_token: str,
        key: Optional[str] = None,
        name: Optional[str] = None,
        kind: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Обновление сценария

        Args:
            project_id: ID проекта (UUID)
            use_case_id: ID сценария (UUID)
            jwt_token: JWT токен для авторизации
            key: Новый ключ сценария
            name: Новое название сценария
            kind: Новый тип сценария
            config: Новая конфигурация сценария
            is_active: Новый статус активности

        Returns:
            Dict с обновленной информацией о сценарии
        """
        data: Dict[str, Any] = {}
        if key is not None:
            data["key"] = key
        if name is not None:
            data["name"] = name
        if kind is not None:
            data["kind"] = kind
        if config is not None:
            data["config"] = config
        if is_active is not None:
            data["is_active"] = is_active

        return cast(Dict[str, Any], self._make_client_request("PUT", f"/api/v1/client/projects/{project_id}/use-cases/{use_case_id}", jwt_token, data))

    def client_delete_use_case(self, project_id: str, use_case_id: str, jwt_token: str) -> Dict[str, Any]:
        """
        Удаление сценария

        Args:
            project_id: ID проекта (UUID)
            use_case_id: ID сценария (UUID)
            jwt_token: JWT токен для авторизации

        Returns:
            Dict с результатом удаления
        """
        return cast(Dict[str, Any], self._make_client_request("DELETE", f"/api/v1/client/projects/{project_id}/use-cases/{use_case_id}", jwt_token))
