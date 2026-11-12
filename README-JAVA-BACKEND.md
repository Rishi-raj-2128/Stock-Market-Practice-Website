# Stock Insight — Java backend

The React + TypeScript frontend remains in `client/`. The replacement backend is in `backend/` and uses Java 17+, Spring Boot 3, Spring Security, BCrypt, JWT cookies, and JSON-file user storage.

## Requirements

- Java 17 or newer
- Maven 3.8+ (or use the Maven wrapper if you add one)
- Node.js 18+

## Run locally

Terminal 1 — start the Spring Boot API from the repository root:

```bash
mvn -f backend/pom.xml spring-boot:run
```

The API listens on http://localhost:8080.

Terminal 2 — start the React frontend:

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally http://localhost:5173). Vite forwards `/api` requests to the Java API.

## API compatibility

- `POST /api/auth/signup` — JSON body: `{ "email": "...", "password": "..." }`
- `POST /api/auth/login` — same body
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/history?symbol=RELIANCE.NS&range=5y&interval=1d`

Authentication keeps the existing `stock_insight_token` HttpOnly cookie name and seven-day lifetime. Passwords are BCrypt-hashed. The response user object does not expose password hashes.

## JSON user storage

At first run, the backend creates `data/users.json` automatically. This file is intentionally ignored by Git. `data/users.example.json` documents the empty format. JSON storage is suitable only for local learning/demo use; use a database such as PostgreSQL for concurrent or production deployments.

If you previously committed real user records to a public repository, deleting the current file does not remove it from Git history. Rotate any affected passwords and consider rewriting repository history if the exposure requires it.

## Configuration

Set `JWT_SECRET_BASE64` to a private Base64-encoded secret of at least 32 bytes for deployments. Set `COOKIE_SECURE=true` when serving over HTTPS. The checked-in default is development-only.

## Notes

The old `server.js` is retained temporarily as a reference/rollback file, but the npm development script now starts Vite and proxies API calls to Spring Boot. Portfolio and watchlist data remain in the browser's local storage, as they did before this backend migration.
