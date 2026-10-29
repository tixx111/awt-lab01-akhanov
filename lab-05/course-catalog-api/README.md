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

## What changed in Lab 5

- CORS allows the exact frontend origin `http://localhost:3000`, so browser Client Components can read API responses. Other origins are not granted permission.
- Course and enrollment JSON uses camelCase (`isElective`, `courseId`, and `studentName`) while Python model fields remain snake_case.
- `POST /courses/{course_id}/like` increments and returns the course, or returns `404` for an unknown course.
- `POST /enrollments` accepts `{"courseId":"web-security","studentName":"Aigerim"}`, validates the name, and returns `201` with an assigned `id`.
- `GET /enrollments` returns the in-memory enrollment records.
