# Course Catalog API

A standalone FastAPI backend for the course catalog.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
fastapi dev main.py
```

Open the interactive API documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## What was verified

- `GET /` returns `{"message": "Course Catalog API is running"}`.
- `GET /courses` returns all six courses, sorted by likes with `ai-integration` first.
- `GET /courses/web-security` returns the Web Security Essentials course.
- `GET /courses/nope` returns `404` with `{"detail": "Course not found"}`.
- `GET /courses?is_elective=true` returns `ai-integration` and `api-design`.
- `GET /courses?is_elective=false` returns the four required courses.
- `GET /courses?sort=title` returns courses alphabetically by title.
- `GET /courses?page=1&page_size=2` returns `ai-integration` and `modern-frontend`.
- `GET /courses?page=2&page_size=2` returns `web-security` and `backend-fastapi`.
- `GET /courses?page=3&page_size=2` returns `databases-postgresql` and `api-design`.
- `GET /courses?page=4&page_size=2` returns an empty list.

## Bonus features

- `sort` accepts only `popular` or `title`; other values return `422`.
- `page` must be at least 1, and `page_size` must be between 1 and 100.
- `GET /courses?q=react` searches course titles case-insensitively.
- `GET /courses?q=api` returns `backend-fastapi` and `api-design`.
- `GET /stats` returns `{"total": 6, "total_credits": 28, "electives": 2}`.
