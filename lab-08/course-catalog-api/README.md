# course-catalog-api

Backend of the course catalog: FastAPI, SQLAlchemy 2.1, PostgreSQL, and Alembic migrations (Labs 4–7 of "Advanced Web Technologies").

## How to run

You need Python 3.11 or newer and PostgreSQL 16 or newer.

Once, as the `postgres` superuser, create the role and the database:

```sql
CREATE ROLE catalog_app LOGIN PASSWORD 'change-me';
CREATE DATABASE course_catalog OWNER catalog_app;
```

Then, from the project folder:

```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Note: SQL_ECHO=true can be added to .env for local SQL query logging

# 4. Apply Alembic migrations
alembic upgrade head

# 5. Seed initial data
psql -h localhost -U catalog_app -d course_catalog -v ON_ERROR_STOP=1 -f seed.sql

# 6. Verify connection and models
python check_db.py
python check_models.py

# 7. Start the FastAPI development server
fastapi dev main.py
```

API documentation: http://localhost:8000/docs. The password `change-me` is for teaching; in a real project, passwords are never put into the repository.

To verify error handling against the running server:
```bash
python try_errors.py
```

## What changed in the API

- **Database Persistence**: Courses, students, and enrollments now reside in PostgreSQL (`course_catalog`) via SQLAlchemy 2.x ORM instead of volatile in-memory Python lists. Data survives server restarts.
- **Contract Update for Enrollments**: `POST /enrollments` now expects `studentId: int` instead of `studentName: str`. Because enrollments reference students by foreign key, students must exist in the database (or be created via `POST /students`) before enrolling.
- **New & Extended Routes**:
  - `POST /students`: creates a student record (`name`, `email`) and returns assigned integer ID.
  - `POST /enrollments`: creates enrollment linked by foreign keys to `courses.id` and `students.id`.
  - `GET /enrollments`: returns enrollments with related `courseTitle` and `studentName` joined across relational tables.
  - `GET /stats/courses`: aggregates enrollment counts per course using `LEFT OUTER JOIN` and `COUNT(enrollments.id)` (courses with 0 enrollments correctly report 0).
  - `GET /courses?level=...`: courses now have a required `level` attribute (`beginner`, `intermediate`, `advanced`) with filtering support.
- **Error Handling**: Database constraint violations (`IntegrityError`) are mapped via constraint names to descriptive HTTP responses:
  - `students_email_key` -> `409 Conflict` ("Student with this email already exists")
  - `enrollments_course_id_student_id_key` -> `409 Conflict` ("Student is already enrolled in this course")
  - `enrollments_course_id_fkey` -> `404 Not Found` ("Course not found")
  - `enrollments_student_id_fkey` -> `404 Not Found` ("Student not found")
  - Pre-validation like student name length (`min_length=2`) is handled by Pydantic before reaching the database, returning `422 Unprocessable Content`.

## Migrations

| Command | What it does |
|---|---|
| `alembic upgrade head` | applies all the missing migrations |
| `alembic downgrade -1` | rolls back the last migration |
| `alembic current` | shows the version of the database |
| `alembic history` | shows the chain of migrations |
| `alembic revision --autogenerate -m "text"` | writes a draft from models vs. database |
| `alembic check` | reports whether the models and the database have diverged |
| `alembic upgrade 0001:0002 --sql` | prints the SQL of a migration without running it |
| `alembic stamp head` | marks the database as up to date without running migrations |

## Experiment log

| # | Experiment | What I saw | Cause | How I fixed it |
|---|---|---|---|---|
| 1 | the `uq` template in `naming_convention` changed | `names only in models: ['enrollments_course_id_unique', 'students_email_unique']` | PostgreSQL names UNIQUE constraints with `_key` by default, whereas the modified template created `_unique`. Alembic sees this as a difference. | Restored `%(table_name)s_%(column_0_N_name)s_key` in `db.py`. |
| 2 | `min_length` removed from `StudentIn`, name `N` | `500 Internal Server Error`, server log: `psycopg.errors.CheckViolation: ... violates check constraint "students_name_check"` | Pydantic no longer caught short names, so the invalid input reached DB. The DB CHECK stopped the row, but unhandled constraint resulted in 500. | Restored `Field(min_length=2)` in `StudentIn` so Pydantic rejects with 422 before the database. |
| 3 | a typo in a constraint name in the dictionary | `500 Internal Server Error` on duplicate email, server log: `duplicate key value violates unique constraint "students_email_key"` | `exc.orig.diag.constraint_name` did not match the typo key `students_email_uniq`, so `raise_http_error` treated it as an unexpected error and raised 500. | Fixed key in `CONSTRAINT_ERRORS` back to `students_email_key`. |
| 4 | `title` without `NOT NULL` in the database, `alembic check` | `FAILED: New upgrade operations detected: [[('modify_nullable', None, 'courses', 'title', ...)]]` | `alembic check` detected discrepancy between model (`nullable=False`) and modified database column (`nullable=True`). | Reapplied `ALTER TABLE courses ALTER COLUMN title SET NOT NULL;`. |
| 5 | automatic migration `0002` on existing data | `psycopg.errors.NotNullViolation: column "level" of relation "courses" contains null values` on `ALTER TABLE courses ADD COLUMN level TEXT NOT NULL` | Alembic autogenerates DDL comparing schemas without inspecting table data. Adding a NOT NULL column without a default to non-empty table fails. | Rewrote migration into 3 steps: add nullable column, populate values with UPDATE CASE, then alter column to NOT NULL. |
| 6 | `import models` commented out in `env.py` | `Detected removed table 'enrollments'`, `courses`, `students`. Autogenerate proposed dropping all tables! | Without `import models`, ORM classes were never registered into `Base.metadata`, so Alembic treated existing DB tables as obsolete. | Restored `import models  # noqa: F401` in `alembic/env.py` and deleted generated drop migration. |
| 7 | a `phone` field in the model without a migration | `FAILED: New upgrade operations detected: [('add_column', None, 'students', Column('phone', Text(), ...))]` | `alembic check` detected a model column that did not exist in the database schema. | Removed experimental `phone` column from model (in production, a migration must be created and applied). |
| 8 | two migrations from one revision | `alembic heads` showed 2 heads (`0003`, `0004`). `alembic upgrade head` failed with `Multiple head revisions are present`. | Independent branches generated migrations off `0002`. Alembic does not know execution order without a merge point. | Merged heads via `alembic merge heads -m "..." --rev-id 0005`, then removed experimental files to keep head at `0002`. |

## Decisions

- **Why API responses are chosen by constraint name rather than SQLSTATE, and why errors are caught after `commit` rather than checked with a `SELECT` in advance**:
  - Multiple distinct constraints share the same SQLSTATE code (e.g. `23505` represents all unique constraint violations; `23503` represents all foreign key violations). Checking `exc.orig.diag.constraint_name` allows us to unambiguously distinguish whether a conflict occurred on `students_email_key` (409 Student with this email already exists) versus `enrollments_course_id_student_id_key` (409 Student is already enrolled in this course), or an invalid course vs invalid student ID (404).
  - Checking in advance with `SELECT` suffers from race conditions (Time-of-Check to Time-of-Use): between reading "email not taken" and executing `INSERT`, another concurrent request can insert the exact same email. Relying on the database to enforce constraints atomically and handling the `IntegrityError` after `commit` is safe, faster, and eliminates redundant queries.
- **Why like is incremented with `UPDATE courses SET likes = likes + 1` rather than reading into Python**:
  - Reading the count into Python (`course.likes += 1`) causes lost updates under concurrency. If two concurrent users like a course with 11 likes simultaneously, both sessions read 11, both compute 12, and both commit 12, causing one like to be lost. An atomic `UPDATE courses SET likes = likes + 1 RETURNING ...` lets PostgreSQL apply the increment directly while holding an exclusive row-level lock during the transaction, guaranteeing both likes increment the counter to 13.
- **Why migration `0002` is split into three steps**:
  - PostgreSQL does not allow adding a `NOT NULL` column without a `DEFAULT` to a table that already contains rows, because existing rows would have `NULL` values. Splitting the operation into 3 atomic steps within a single transaction ensures safety: (1) add column with `nullable=True`, (2) execute data migration query to assign values based on business rules (`CASE WHEN is_elective THEN 'beginner' ELSE 'intermediate' END`), (3) alter the column to `nullable=False`.

## Migration 0002 self-check

| What to check | Result |
|---|---|
| Goal and steps | **Yes** — The goal is clear (add required difficulty level to courses), cleanly split into 3 steps. |
| Data | **Yes** — Existing course records are preserved and assigned difficulty levels based on `is_elective`. |
| Renames and drops | **Yes** — No columns are renamed or dropped in `upgrade()`; existing columns and rows remain intact. |
| Rollback | **Yes** — `downgrade()` drops the added `level` column; cycle `downgrade -1` -> `upgrade head` verified. |
| Verification | **Yes** — SQL verified via `alembic upgrade 0001:0002 --sql`; schema equality confirmed via `alembic check`. |
| History | **Yes** — Single linear history (`0001 -> 0002 (head)`), no diverging branches. |
| Application | **Yes** — Model, Pydantic schemas (`CourseOut`), `seed.sql`, and FastAPI query filter `?level=` updated. |

## Bonus Tasks

- **Task 1 (CHECK constraint autogenerate & `op.f`)**: Alembic autogenerate does not detect `CheckConstraint` by default. Custom migrations require manual DDL with `op.create_check_constraint` and `op.drop_constraint`. In Alembic, wrapping constraint names in `op.f(...)` prevents `naming_convention` from applying double prefixes/suffixes (e.g. preventing `courses_courses_level_check_check`).
- **Task 2 (Column renaming)**: Alembic autogenerate interprets a renamed column as dropping the old column and adding a new column, which destroys existing data. Using `op.alter_column("courses", "description", new_column_name="summary")` renames the column in-place with zero data loss.
- **Task 3 (N+1 query problem)**: Lazy loading on relationships results in 1 query for the course list + N queries for enrollments (7 queries total for 6 courses). Using `selectinload(Course.enrollments)` reduces this to exactly 2 queries (1 query for courses + 1 batched `WHERE course_id IN (...)` query for enrollments).
- **Task 4 (Lost updates in ORM)**: Demonstrated that reading state into memory and assigning `course.likes += 1` across two concurrent sessions resulted in like count 12 instead of 13. Replacing it with SQL expression `Course.likes + 1` let PostgreSQL's row-level lock increment correctly to 13.
- **Task 5 (passive_deletes & ON DELETE CASCADE)**: Setting `passive_deletes=True` on `relationship()` tells SQLAlchemy that the database will handle cascade deletions via `ON DELETE CASCADE`. Without this flag, SQLAlchemy attempts to nullify the foreign key (`SET student_id = NULL`), which fails due to the NOT NULL constraint on `enrollments.student_id`.
