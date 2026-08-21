# Task Management API

Учебный backend на [NestJS](https://nestjs.com): REST API для управления задачами с JWT-аутентификацией.

Проект сделан по курсу **[NestJS Zero to Hero](https://www.udemy.com/course/nestjs-zero-to-hero/)** (Udemy, Ariel Weinberger).

## Стек

- NestJS 11, TypeScript, Express
- PostgreSQL и TypeORM
- Passport JWT и `@nestjs/jwt`
- Argon2 для хеширования паролей
- `class-validator` / `class-transformer`
- `@nestjs/config` и Joi
- [Bun](https://bun.sh)

## Основные фичи

То, что обычно разбирают в курсе и что реализовано в этом репозитории:

- **Модульная архитектура.** `AuthModule` и `TasksModule` с контроллерами, сервисами и сущностями. Auth экспортирует JWT-стратегию и Passport, чтобы Tasks мог закрыть свои маршруты.
- **Гварды.** Весь `TasksController` обёрнут в `@UseGuards(AuthGuard())` — без Bearer-токена запросы не проходят. Стратегия по умолчанию — JWT.
- **JWT-стратегия.** `JwtStrategy` достаёт токен из `Authorization: Bearer`, проверяет подпись и кладёт пользователя в `request.user`.
- **Кастомный декоратор.** `@GetUser()` читает пользователя из request и прокидывает его в хендлер — без ручного доступа к `req`.
- **Интерсепторы.** Глобальный `TransformInterceptor` прогоняет ответы через `instanceToPlain`. У задачи поле `user` помечено `@Exclude()`, поэтому связь с пользователем в JSON не утекает.
- **Валидация.** Глобальный `ValidationPipe` + DTO (`CreateTaskDto`, `AuthCredentialsDto`, `FilterTasksDto`, `UpdateTaskStatusDto`). Невалидное тело или query отсекается до сервиса.
- **Конфиг по окружениям.** `ConfigModule` грузит `.env.stage.${STAGE}`, схема Joi требует `STAGE`, `DB_*` и `JWT_*`. Подключение TypeORM собирается через `ConfigService`.
- **Логирование.** `Logger` в bootstrap (порт), verbose-логи в контроллере задач (кто создаёт / читает список), error + stack в сервисе при падении query builder.
- **Исключения Nest.** `UnauthorizedException` при неверном логине, `ConflictException` при занятом username (Postgres `23505`), `NotFoundException` если задачи нет или она чужая, `InternalServerErrorException` на неожиданных ошибках БД.
- **Связь user ↔ tasks.** Задача принадлежит пользователю (`ManyToOne` / `OneToMany`). Список, получение, смена статуса и удаление фильтруются по текущему user — чужие задачи не видны.
- **Фильтрация через QueryBuilder.** `GET /tasks` принимает `status` и `search` (подстрока в title/description, без учёта регистра).
- **Хеши паролей.** При signup пароль хешируется Argon2, при signin — `argon2.verify`.
- **CORS.** Включён в `main.ts`, чтобы фронтенд с другого origin мог ходить в API.

## Структура

```
src/
├── main.ts                     # bootstrap, CORS, ValidationPipe, interceptor
├── app.module.ts               # Config + TypeORM + модули
├── config.schema.ts            # Joi: STAGE, DB_*, JWT_*
├── transform.interceptor.ts    # instanceToPlain для ответов
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts      # POST /auth/signup, /auth/signin
│   ├── auth.service.ts
│   ├── jwt.strategy.ts         # Bearer token → пользователь
│   ├── users.repository.ts
│   ├── user.entity.ts
│   ├── get-user.decorator.ts
│   └── dto/auth-credentials.dto.ts
└── tasks/
    ├── tasks.module.ts
    ├── tasks.controller.ts     # CRUD /tasks (все эндпоинты под JWT)
    ├── tasks.service.ts
    ├── task.entity.ts          # OPEN | IN_PROGRESS | DONE
    └── dto/
        ├── create-task.dto.ts
        ├── filter-tasks.dto.ts
        └── update-task-status.dto.ts
```

## Требования

- [Bun](https://bun.sh) (или Node.js 20+)
- PostgreSQL 14+

## Локальный запуск

### 1. PostgreSQL

Нужна база `task-management` и пользователь, как в `.env.stage.dev`:

```bash
createdb task-management
```

Либо Docker:

```bash
docker run --name tm-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=task-management \
  -p 5432:5432 \
  -d postgres:16
```

TypeORM поднимает схему сам (`synchronize: true`) — миграции не нужны.

### 2. Переменные окружения

При `bun run start:dev` подставляется `STAGE=dev`, конфиг читается из `.env.stage.dev`.

Ожидаемые ключи (см. `src/config.schema.ts`):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=task-management

JWT_SECRET=<случайная строка>
JWT_EXPIRES_IN=3600
```

Порт сервера: `PORT` или **4000** по умолчанию.

### 3. Установка и старт

```bash
bun install
bun run start:dev
```

Сервер: `http://localhost:4000`.

Другие скрипты:

- `bun run start` — без watch
- `bun run start:debug` — debug + watch, `STAGE=dev`
- `bun run build` / `bun run start:prod` — прод (`STAGE=prod`, нужен `.env.stage.prod`)
- `bun run lint`
- `bun run test` / `bun run test:e2e`

## API

Базовый URL: `http://localhost:4000`.

### Auth

- `POST /auth/signup` — регистрация
- `POST /auth/signin` — логин, ответ `{ accessToken }`

Тело:

```json
{
  "username": "alice",
  "password": "secret1"
}
```

- `username`: 4–20 символов
- `password`: 6–32 символа

```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret1"}'

curl -X POST http://localhost:4000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret1"}'
```

Дальше: `Authorization: Bearer <accessToken>`.

### Tasks

Все маршруты требуют JWT.

- `POST /tasks` — создать задачу (`status: OPEN`)
- `GET /tasks` — список своих задач
- `GET /tasks/:id` — одна задача
- `PATCH /tasks/:id/status` — сменить статус
- `DELETE /tasks/:id` — удалить

Создание:

```json
{
  "title": "Write README",
  "description": "Document the NestJS course project"
}
```

Статус: `OPEN` | `IN_PROGRESS` | `DONE`.

Фильтры `GET /tasks`:

- `status` — точное значение enum
- `search` — подстрока в `title` или `description`

```bash
curl "http://localhost:4000/tasks?status=OPEN&search=readme" \
  -H "Authorization: Bearer <token>"
```

```bash
curl -X PATCH http://localhost:4000/tasks/<id>/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
```

## Заметки учебного проекта

- `synchronize: true` удобно для курса, для продакшена нужны миграции.
- `.env.stage.prod` в репозитории пустой — перед `start:prod` его нужно заполнить.
- JWT-секрет в `.env.stage.dev` только для локальной разработки.
- Курс: [NestJS Zero to Hero — Modern TypeScript Back-end Development](https://www.udemy.com/course/nestjs-zero-to-hero/).
