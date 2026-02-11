# Синхронизация PUBLIC с публичным репозиторием

Папка `INTEGRATION/PUBLIC/` синхронизируется с публичным репозиторием [markbasePLUGINS](https://github.com/Way7Creation/markbasePLUGINS) для внешних разработчиков.

## Как это работает

- **Основной репозиторий** (`markbaseCORE`): содержит всю папку `INTEGRATION/` как часть проекта
- **Публичный репозиторий** (`markbasePLUGINS`): содержит только содержимое `INTEGRATION/PUBLIC/` для разработчиков

## Что публикуется

```
PUBLIC/
├── README.md              ← Главная документация для разработчиков
├── auth-widget/           ← WaySenID SDK, CSS, OAuth, One Tap
│   ├── README.md
│   ├── INTEGRATION.md
│   ├── ONETAP.md
│   ├── waysenid.css
│   └── plugin.json
├── plugins/               ← API-плагины модулей
│   ├── README.md
│   ├── billing/
│   ├── captcha/
│   ├── monitoring/
│   ├── registry/
│   ├── security/
│   ├── uam/
│   ├── wallet/
│   └── docker-performance/
└── SYNC.md                ← Этот файл
```

## Что НЕ публикуется

Папка `INTEGRATION/MARKBASE/` остаётся **только в приватном репозитории**:
- `design/` — внутренний стайлгайд (Header, Sidebar, Footer)
- `auth/` — провайдеры, Dashboard, Admin Panel

## Синхронизация изменений

После коммита в основной репозиторий:

### Windows:
```bash
scripts\sync-plugins.bat
```

### Linux/Mac:
```bash
./scripts/sync-plugins.sh
```

### Вручную:
```bash
git subtree push --prefix=INTEGRATION/PUBLIC plugins-public main
```

## Настройка

Remote для публичного репозитория:
- **Remote name**: `plugins-public`
- **URL**: `https://github.com/Way7Creation/markbasePLUGINS.git`

Если нужно пересоздать remote:
```bash
git remote remove plugins-public
git remote add plugins-public https://github.com/Way7Creation/markbasePLUGINS.git
```

## Важно

- Все изменения в `PUBLIC/` сначала коммитятся в основной репозиторий
- Затем синхронизируются в публичный через `git subtree push`
- Пользователи клонируют публичный репозиторий: `git clone https://github.com/Way7Creation/markbasePLUGINS.git`
- **НИКОГДА** не публикуйте содержимое `MARKBASE/` — это внутренние спецификации
