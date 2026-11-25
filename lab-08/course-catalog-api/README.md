# course-catalog-api

Backend of the course catalog: FastAPI, SQLAlchemy 2.1, PostgreSQL, Alembic and GraphQL on Strawberry as a second entrance (Labs 4–8, "Advanced Web Technologies").

## How to run

You need Python 3.11 or newer and PostgreSQL 16 or newer.

Once, as the `postgres` superuser, create the role and the database:

```sql
CREATE ROLE catalog_app LOGIN PASSWORD 'change-me';
CREATE DATABASE course_catalog OWNER catalog_app;
```

Then, from the project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
psql -h localhost -U catalog_app -d course_catalog -v ON_ERROR_STOP=1 -f seed.sql
fastapi dev main.py
```

REST docs: http://localhost:8000/docs. GraphiQL: http://localhost:8000/graphql.
The password `change-me` is for training; real projects don't commit passwords.

## What changed in the API

- **REST errors in Problem Details format (RFC 9457)**: Application rules and database constraint violations now live in `services.py` and raise `ServiceError(code, message)`. In `problem.py`, exception handlers translate `ServiceError` and `StarletteHTTPException` into `application/problem+json` responses with `type` (`https://example.com/problems/<slug>` or `about:blank`), `title`, `status`, `detail`, and `instance`.
- **GraphQL endpoint at `/graphql`**: Mounted via Strawberry's `GraphQLRouter` with a per-request `Context` holding a SQLAlchemy session (`Depends(get_db)`) and per-request DataLoaders. In a browser (`GET /graphql`), it serves the interactive GraphiQL IDE with documentation and autocomplete; ordinary clients send `POST /graphql` with JSON `{ "query": "...", "variables": { ... } }`.
- **Mutations and `userErrors`**: The `enroll` and `likeCourse` mutations return payload envelopes (`EnrollPayload`, `LikePayload`) containing the mutated object and a `userErrors: [UserError!]!` list. Expected application rule violations (`ALREADY_ENROLLED`, `COURSE_NOT_FOUND`, `STUDENT_NOT_FOUND`) arrive inside `data.<mutation>.userErrors` with HTTP 200, whereas syntax, validation, or unexpected server errors arrive in the top-level `errors` key.
- **`X-SQL-Queries` header**: Middleware in `counter.py` listens to SQLAlchemy's `before_cursor_execute` event using a per-request `ContextVar` and writes the exact number of SQL queries executed during the HTTP request into the `X-SQL-Queries` response header.
- **GraphQL server protections**: Added `QueryDepthLimiter(max_depth=5)`, `MaxAliasesLimiter(max_alias_count=10)`, argument validators `check_limit` (1..100) and `parse_id` (valid integer ID), `MaskErrors` (hiding unexpected internal/database exceptions behind `"Unexpected error."` while keeping intentional `GraphQLError` messages visible), and `DisableIntrospection()` controlled by `GRAPHQL_INTROSPECTION` in `.env`.
- **New REST routes for student courses**: Added `GET /students/{id}` and `GET /students/{id}/enrollments` (sharing the `enrollment_details()` query builder with `GET /enrollments`) to support the REST version of the "My courses" page.

## Example queries

The “My courses” query (in the GraphiQL Variables panel: `{"id": "2"}`):

```graphql
query MyCourses($id: ID!) {
  student(id: $id) {
    name
    enrollments {
      id
      course {
        title
        credits
        level
      }
    }
  }
}
```

The `enroll` mutation and its answer on a repeated enrollment (Variables: `{"input": {"courseId": "web-security", "studentId": "3"}}`):

```graphql
mutation Enroll($input: EnrollInput!) {
  enroll(input: $input) {
    enrollment {
      id
      enrolledAt
      course {
        title
      }
    }
    userErrors {
      code
      message
    }
  }
}
```

First run (success):

```json
{
  "data": {
    "enroll": {
      "enrollment": {
        "id": "10",
        "enrolledAt": "2026-11-19T15:02:12.132014+05:00",
        "course": {
          "title": "Web Security Essentials"
        }
      },
      "userErrors": []
    }
  }
}
```

Repeated run (expected rule error in `userErrors`):

```json
{
  "data": {
    "enroll": {
      "enrollment": null,
      "userErrors": [
        {
          "code": "ALREADY_ENROLLED",
          "message": "Student is already enrolled in this course"
        }
      ]
    }
  }
}
```

## REST vs GraphQL comparison

The “My courses” screen of student 2; numbers from `measure.py`, starting data.

| Criterion | REST | GraphQL | Source |
|-----------|------|---------|--------|
| Requests and rounds per screen | 5 requests in 2 rounds (round 1: student + enrollments; round 2: 3 courses) | 1 request in 1 round (`POST /graphql`) | `measure.py`, step 8 |
| Bytes in the responses | 1145 bytes (returns full course and enrollment objects with unused fields) | 339 bytes (returns only `name`, `id`, `title`, `credits`, `level`) | `measure.py`, step 8 |
| SQL queries per screen | 5 SQL queries (1 student + 1 enrollments JOIN + 3 individual course lookups) | 3 SQL queries (1 student + 1 enrollments batch + 1 courses `IN (...)` batch) | `measure.py`, `X-SQL-Queries` |
| SQL growth with more students | Fixed per route (`GET /courses` is 1 query, `GET /enrollments` is 1 JOIN query), or grows linearly if client fetches N items one by one | Without DataLoaders: grew from 7 (3 students) to 27 / 24 (20 students). With DataLoaders: constant 3 queries regardless of student count | `try_n_plus_1.py`, experiments 4–5 |
| Error in the query text | HTTP 404 for unknown route or 422 for invalid query parameters | HTTP 200 with top-level `errors` array (`Cannot query field ... Did you mean ...`) and `data: null` | experiments 1 and 8 |
| Expected rule error (repeated enrollment) | HTTP 409 with `application/problem+json` and `type: .../already-enrolled` | HTTP 200 with `data.enroll.enrollment = null` and `userErrors[0].code = "ALREADY_ENROLLED"` | steps 1 and 4 |
| HTTP cache | Standard HTTP caching works out of the box per resource URL (`GET /courses/{id}`, `Cache-Control`, `ETag`, CDN/browser cache) | All queries go to one `POST /graphql` URL with a JSON body, so standard HTTP/CDN caching by URL does not work without persisted queries or client normalized caches | lecture section 14 |
| Protection from “expensive” queries | Built into each route: fixed query shape, no arbitrary nesting, per-route pagination and rate limiting | Requires explicit GraphQL-level guards: `QueryDepthLimiter(5)`, `MaxAliasesLimiter(10)`, resolver argument checks, `MaskErrors`, and disabling introspection in production | experiments 6 and 7 |

**Conclusion.** I would leave flat, single-resource or cacheable public screens (such as `GET /courses`, `GET /courses/{id}`, and `GET /stats/courses`) on REST because each endpoint executes 1 predictable SQL query, uses simple HTTP status codes, and benefits from standard HTTP caching. I would choose GraphQL for composite, nested views like the “My courses” screen, where GraphQL reduced network traffic from 5 requests across 2 sequential rounds (1145 bytes, 5 SQL queries) down to 1 request in 1 round (339 bytes, 3 SQL queries with DataLoaders). However, exposing GraphQL requires DataLoaders to prevent N+1 query explosion (27 queries down to 3) and explicit depth/alias/error-masking protections.

## Experiment log

| # | Experiment | What I saw | Cause | How I fixed it |
|---|------------|------------|-------|----------------|
| 1 | a typo in a field name, an argument name in `snake_case` | Status `200 OK`, `"data": null`, and `"errors"` with `"Cannot query field 'titel' on type 'Course'. Did you mean 'title', 'level', or 'likes'?"` and `"Unknown argument 'is_elective' on field 'Query.courses'. Did you mean 'isElective'?"` | GraphQL validates query fields and camelCase argument names against the schema before execution and reports validation failures in `errors` over HTTP 200 | Fixed the query field name to `title` and the argument name to `isElective` |
| 2 | `\| None` removed from the `course` query, a nonexistent course | Status `200 OK`, `"data": null`, and `"Cannot return null for non-nullable field Query.course."`; even when querying an existing course `a` alongside nonexistent `b`, the entire `data` became `null` | Null propagation rule: when a non-nullable (`Course!`) field returns `null`, GraphQL propagates `null` up to the nearest nullable parent (the root `data`) and discards sibling results | Restored `-> CourseType \| None` on `Query.course` so the schema type is nullable `Course` |
| 3 | a mutation with the GET method | HTTP status `400 Bad Request` with plain-text body `mutations are not allowed when using GET`, and course `likes` remained unchanged | By HTTP conventions `GET` must be safe and idempotent; Strawberry rejects mutations over `GET` at the protocol level before execution | Sent mutations only via `POST /graphql` with a JSON body |
| 4 | `more_students.sql`: 3 and 20 students, the SQL counter | With 3 students both nested queries ran `7` SQL queries; after `more_students.sql` (20 students), `students → enrollments → course` ran `27` SQL queries (`1 + 20 + 6`) and `enrollments → course, student` ran `24` (`1 + 6 + 17`) | N+1 problem caused by SQLAlchemy lazy loading inside synchronous attribute access: each student's `enrollments` and each distinct `course`/`student` triggered a separate `SELECT` | Added per-request `DataLoader`s in `Context` (`batch_loader`), reducing both queries to `3` SQL statements (`1` per nesting level) for both 3 and 20 students |
| 5 | a DataLoader batch function that doesn't sort rows by key | `students` query failed with `"Received wrong number of results in dataloader, expected: 3, received: 6"`; `enrollments` query returned 200 without errors, but 4 of 6 enrollments showed the wrong course title | DataLoader matches returned values to requested keys by list position (`len(results) == len(keys)`). Returning raw DB rows in `ORDER BY id DESC` order broke the length for 1-to-many and silently mismatched courses by position when lengths happened to match (3 keys, 3 courses) | Restored `git restore graphql_api.py` so `batch_loader` groups rows into `groups[key]` and returns `[groups[key] for key in keys]` (or one object/`None` per key) in key order |
| 6 | six dangerous queries without protection and with it | Without protection: depth-6 cycle, 12 aliases (`flood_likes.py` added 12 likes in 24 SQL queries), and introspection all succeeded; `limit: -1`, `id: "abc"`, and 20-digit `id` leaked Python/psycopg errors and raw SQL text. With protection: depth 6 rejected (`max_depth=5`), 12 aliases rejected (`Allowed: 10`, 0 SQL queries), `limit: -1` and `id: "abc"` returned clean validation messages, and 20-digit `id` returned `"Unexpected error."` | Without explicit limits, GraphQL allows arbitrary nesting, alias batching, and leaks unhandled exception messages in `errors`. Note: without protection the client learned table/column names and SQL syntax; we wrote `check_limit` and `parse_id` so invalid client inputs get actionable messages instead of generic `"Unexpected error."`; lowering `max_depth` to 2 would break the legitimate depth-3 “My courses” query (`student → enrollments → course`) | Enabled `QueryDepthLimiter(5)`, `MaxAliasesLimiter(10)`, `MaskErrors(should_mask_error=should_mask)`, `check_limit`, and `parse_id`, then re-seeded the database |
| 7 | introspection off, a typo in a field name | With `GRAPHQL_INTROSPECTION=false`, `{ __schema { queryType { name } } }` was rejected with `"GraphQL introspection has been disabled..."`, while `{ cours { title } }` still returned `"Cannot query field 'cours' on type 'Query'. Did you mean 'course' or 'courses'?"` | `DisableIntrospection` blocks `__schema` and `__type` queries, hiding the full schema map, but the parser's `"Did you mean ..."` suggestions still reveal real field names on typos — so disabling introspection is not a substitute for authorization | Removed `GRAPHQL_INTROSPECTION=false` from `.env` for local development after verifying the setting |
| 8 | client failures: a typo, no `errors` check, the API stopped | 1) Typo with `errors` check: `GraphQLRequestError: Cannot query field 'titel' on type 'Course'...` 2) Typo without `errors` check: `TypeError: Cannot destructure property 'student' of '(intermediate value)' as it is null` 3) API stopped: `TypeError: fetch failed` | GraphQL returns HTTP 200 even when a query fails (`data: null, errors: [...]`), so `res.ok` alone passes and crashes the UI later with an obscure `null` destructuring error unless `body.errors?.length` is checked explicitly | Restored the `if (body.errors?.length) throw new GraphQLRequestError(body.errors)` check in `lib/graphql.ts` and fixed the query in `app/my-courses/page.tsx` |

## Decisions

- **Why the rules and their errors live in `services.py` instead of being checked in both layers:** If constraint names and business rules were duplicated in both FastAPI routes and Strawberry resolvers, any new rule or message change would have to be updated in two places and the two APIs would inevitably drift apart. Keeping the database logic and `ServiceError` codes in `services.py` ensures a single source of truth while allowing REST (`problem.py`) to translate codes into HTTP status codes + Problem Details and GraphQL (`graphql_api.py`) to translate the exact same codes into `userErrors`.
- **Why loaders are created in `Context` per request and match rows to keys by value:** A `DataLoader` caches loaded keys in memory; if a single loader instance were shared across the whole application, one request could see stale data or another user's cached records. Inside `batch_loader`, database `WHERE col IN (...)` queries return rows in arbitrary order and omit keys that have zero matching rows, so grouping rows into a dictionary by key (`groups[key]`) and assembling the return list in the exact order of `keys` guarantees the DataLoader contract (same length and same order as `keys`).
- **Why the protection is two-layered (`check_limit` / `parse_id` plus `MaskErrors`):** When a client passes an invalid argument such as `limit: -1` or `id: "abc"`, returning a specific `GraphQLError` (`"limit must be between 1 and 100"`, `"Invalid ID: 'abc'"`) tells the caller how to fix their request without exposing server internals. For unforeseen exceptions (such as a `bigint` overflow in PostgreSQL, a database outage, or a bug in a resolver), `MaskErrors` intercepts the exception and returns `"Unexpected error."` to the client so SQL queries, table names, and stack traces never leak outside the server logs.
