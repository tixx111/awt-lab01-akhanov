# Course Catalog

A Next.js 16 course catalog for the Advanced Web Technologies course.

Lab 2 styling uses Tailwind CSS, shadcn/ui cards, responsive grids, and styled navigation.

## Included

- Home, About, Courses, and dynamic course detail routes
- Course data loaded from the FastAPI backend
- Dynamic server-rendered course pages with fresh API data
- Loading and not-found states
- A typed `LikeButton` Client Component using local state
- Responsive course cards styled with Tailwind CSS and shadcn/ui
- System-based dark mode styling for the navigation and course cards

## Run locally

Start the backend first:

```bash
cd course-catalog-api
source .venv/bin/activate
fastapi dev main.py
```

Then start the frontend in a second terminal:

```bash
cd course-catalog
npm install
npm run dev
```

The frontend requires these local environment variables in `.env.local`:

```env
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`API_URL` is used by Server Components, while `NEXT_PUBLIC_API_URL` is exposed to browser Client Components.

## Breakage journal

| Breakage | Console/Network evidence | Cause |
|---|---|---|
| Trailing slash in `allow_origins` | CORS error; preflight status 400 | The configured origin did not exactly match `http://localhost:3000`. |
| Wrong frontend port | CORS error; response has no `access-control-allow-origin` | `localhost:3001` is a different origin from the allowed port 3000. |
| Wrong API address | Request went to `/undefined/courses` with 404 | The browser variable was missing or the dev server had not been restarted. |
| Missing JSON content type | Enrollment POST returned 422; no OPTIONS row | FastAPI could not parse the body as JSON, and the request stayed simple. |
| Backend Python error | Network showed 500 and the backend terminal showed a traceback | The server exception occurred before a valid response; this was not a CORS permission problem. |

## Decisions

`generateStaticParams` was removed because course data now belongs to the backend and must be fetched fresh instead of being requested during the build. The like request has no body or special headers, so it is a simple POST without preflight; enrollment sends JSON with `Content-Type: application/json`, so the browser performs an OPTIONS preflight.
