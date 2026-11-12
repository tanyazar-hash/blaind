# Размещение «БЛАИНД»

Node.js 22 нужен только для сборки. Публикуйте **содержимое `public/`**, не весь
репозиторий. Дизайн, анимации, модели, фотографии и шрифты общие для всех вариантов.

## Vercel

`npm ci` и `npm run build`; существующий `vercel.json` сохранён.
Не задавайте `STATIC_HOSTING=1` для проекта Vercel. По умолчанию префикс `/`,
публичные данные и админ-панель используют `/api/arena` и `/api/admin`.
HttpOnly/SameSite cookies, CSRF, проверка администратора, CAS и Supabase RLS
сохранены. Настройка базы — в `ADMIN_SETUP.md`.

## GitHub Pages

Settings → Pages → Source: **GitHub Actions**. Workflow `.github/workflows/static.yml`
срабатывает после push в `main` и вручную. Он устанавливает зависимости, собирает
корневой вариант и запускает тесты, затем собирает статический вариант с фактическим
`base_path` из `actions/configure-pages` (обычно `/blaind/`, для собственного домена
пустой). После Chromium-проверки готовых файлов публикуется `public/`. После deploy workflow проверяет уже
опубликованные Pages и Vercel реальным браузером, включая живой рейтинг и входную
страницу админки; пароли не вводятся, записи в базу не выполняются.

Публичная «Арена» читает тот же документ Supabase через REST с **publishable key**
под существующей ролью `anon` и RLS. Service-role ключ не нужен и не должен попадать
в сборку. Ошибки сети/доступа показываются как ошибки, а не подменяются старым JSON.
Начальные данные используются только при отсутствии инициализированной таблицы
или записи, как в серверном варианте.

GitHub Pages не выполняет Node.js и не может создать серверную HttpOnly-сессию.
Поэтому `/blaind/admin/` переводит пользователя **в том же окне верхнего уровня**
на действующую админ-панель Vercel. Пароль вводится только там. Управление общими
данными доступно с обоих сайтов без iframe, междоменных cookies, ослабления CSRF,
токенов в localStorage или новых прав RLS. Изменения появляются на обоих публичных
сайтах при очередном обновлении снимка. Backend необходим для администрирования. Публичный адрес backend не должен
быть закрыт Vercel Deployment Protection/SSO: иначе посетитель попадает на вход
в Vercel до формы входа клуба. Владелец может сделать production-домен публичным
в Project Settings → Deployment Protection или указать публичный production-домен.
Supabase Auth и RLS при этом остаются включены. Workflow отдельно проверяет
опубликованный Pages и Vercel и явно сообщает о блокировке SSO.

## Другой статический хостинг

```sh
npm ci
SITE_BASE_PATH=/ STATIC_HOSTING=1 npm run build
# Или размещение в подпапке:
SITE_BASE_PATH=/club/ STATIC_HOSTING=1 npm run build
```

Загрузите содержимое `public/` в соответствующий каталог. Сервер должен отдавать
`index.html` для каталогов и перенаправлять `/arena` на `/arena/`: это стандартное
поведение GitHub Pages, nginx, Apache и большинства файловых хостингов. SPA fallback
не требуется. Юридические документы имеют собственные `.html`-файлы. Ссылки разделов
используют завершающий `/`, HTML/CSS/JS используют единый префикс сборки. После
смены префикса пересоберите сайт.

Переменные **сборки**:

| Имя | По умолчанию | Назначение |
| --- | --- | --- |
| `SITE_BASE_PATH` | `/` | `/blaind/`, `/club/` или другой путь с начальным и конечным `/` |
| `STATIC_HOSTING` | `0` | `1` включает публичное чтение Supabase и переход к серверной админке |
| `HOSTED_ADMIN_URL` | `https://blaind-tanyazar-hashs-projects.vercel.app/admin/` | HTTPS-адрес защищённой админ-панели |
| `SUPABASE_URL` | Текущий проект из `server/config.js` | Публичный HTTPS-адрес проекта |
| `SUPABASE_PUBLISHABLE_KEY` | Текущий ключ из `server/config.js` | Только `sb_publishable_…`, не service-role/secret |

Если меняется Supabase, задайте одинаковую публичную конфигурацию при сборке статики
и на backend. Не используйте секреты в публичных параметрах. Если другой хостинг
устанавливает CSP, разрешите REST к домену Supabase в `connect-src` и его Storage
в `img-src`; локальные модули, шрифты и модели — с `'self'`. Авторизация остаётся
на backend, где существующий CSP менять не нужно.

## Проверки

```sh
npm run build
npm test
npm run test:browser
node tests/site-browser.cjs
node tests/chip-motion-browser.cjs
node tests/hosting-browser.cjs
SITE_BASE_PATH=/blaind/ STATIC_HOSTING=1 npm run build
SITE_BASE_PATH=/blaind/ STATIC_HOSTING=1 node tests/hosting-browser.cjs
```

Локально используется `/usr/bin/chromium`. CI устанавливает Chromium через Playwright
и задаёт `PLAYWRIGHT_BUNDLED_CHROMIUM=1`. hosting-browser запускает файловый сервер
без Vercel rewrites, проверяет все публичные/юридические страницы и reload, ссылки,
desktop/mobile GLB, WOFF2, фотографии и переход к админке. Ответы Supabase в этом
тесте подставлены явно: это проверка контракта, а не доступности production.
После публикации проверьте оба URL, актуальный рейтинг и вход в существующую
админ-панель. Production не заполняется тестовыми данными.

## Упрощённая структура клуба

Основные страницы: `/`, `/arena/` (рейтинг), `/tournaments/`, `/about/`, `/rental/`.
Они публикуются как отдельные каталоги с index.html. `/atmosphere/` и все документы
сохранены; `/arena/#tournaments` перенаправляет на расписание с учётом префикса.
Данные и защищённый backend не изменены. Текущие проверки и ограничения описаны
в `docs/HANDOFF.md`; старая пятиглавная хореография заменена неподвижной фишкой.
