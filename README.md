# Choose the BEST — голосование

Сайт: **https://poll69.vercel.app/** (Vercel, каждый push в `main` выкатывается сам).

Статическая страница `index.html` + serverless-функции Vercel в `api/` + база **Turso**
(облачный SQLite, libSQL).

## API

- `GET  /api/votes?device=…` — голоса этого устройства (админ с ключом видит все)
- `POST /api/vote` — записать голос. Один голос на устройство в каждом опросе гарантирует
  сама база (`UNIQUE(device, team)`), одновременные голоса не теряются.
- `GET  /api/admin` — проверка ключа админа
- `POST /api/reset` — новый раунд (админ). Голоса не удаляются, а переносятся в `votes_archive`;
  каждая попытка сброса пишется в `admin_log` (время, IP, успех).
- `POST /api/import` — разовый перенос старых голосов (админ).

Таблицы создаются сами при первом запросе.

## Переменные окружения в Vercel (Settings → Environment Variables)

| Имя | Что это |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://<база>-<аккаунт>.turso.io` |
| `TURSO_AUTH_TOKEN` | токен базы из Turso |
| `POLL_ADMIN_KEY` | длинный случайный ключ админа (в коде его нет) |
| `POLL_ADMIN_IPS` | необязательно: IP через запятую, `*` = любой. По умолчанию `88.157.111.3` |

Админка: `https://poll69.vercel.app/#/admin?key=<POLL_ADMIN_KEY>`.

## Сборка страницы

`index.html` собирается из `css/` и `js/`: `python3 build.py`.
