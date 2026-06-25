# Frontend Documentation

The frontend is a modern **Single Page Application (SPA)** built using **React**, **Vite**, **TypeScript**, and **Tailwind CSS (v4)** for styling. It communicates with the Go API via asynchronous fetch calls using cookie-based credentials.

---

## Directory Structure

```text
frontend/
├── src/
│   ├── assets/
│   ├── components/            # Reusable UI elements
│   ├── pages/
│   │   ├── Login.tsx          # Login form with status alerts
│   │   ├── Login.test.tsx     # Vitest tests for the Login flow
│   │   ├── Dashboard.tsx      # Main application hub (secrets, metrics, sidebar, modals)
│   │   └── Dashboard.test.tsx # Vitest tests for Dashboard rendering and lists
│   ├── services/
│   │   └── api.ts             # Fetch client configured with CORS credentials
│   ├── App.tsx                # Session checker, loader, and router router layout
│   ├── main.tsx               # DOM renderer entrypoint
│   ├── index.css              # Tailwind v4 import root
│   └── setupTests.ts          # Vitest testing-library config
├── index.html
├── package.json
└── vite.config.ts             # Vite/Vitest custom port 4000 config
```

---

## Core Views & Components

### 1. App Entrypoint (`App.tsx`)
* On mount, calls `GET /api/auth/session` to check if a valid cookie session exists.
* Renders a spinner loader while resolving.
* If authenticated, renders the `Dashboard` component. Otherwise, redirects to the `Login` component.

### 2. Login Flow (`pages/Login.tsx`)
* Standard form collecting operator name and password.
* Sends credentials to `POST /api/auth/login`.
* On success, updates parent state to authenticated.

### 3. Dashboard Hub (`pages/Dashboard.tsx`)
* **Metrics Cards**: Displays dynamic statistics (Total, Active, Revoked, Expired) calculated from the secrets list.
* **Secrets List Table**: Renders active, expired, and revoked secrets. Provides quick buttons for actions:
  * *Olho (View)*: Triggers decrypt request and displays the secret value in a modal.
  * *Relógio (History)*: Shows the version timeline modal.
  * *Mais (+)*: Opens the update form to spawn a new version.
  * *Lixeira (Revoke)*: Changes status of the secret to `REVOKED`.
* **Sidebar Logs**: Dynamically polls and displays a timeline of the last 50 audit log events from the API.

---

## Testing Strategy (Vitest)
* Utilizes **Vitest** + **React Testing Library** + **JSDOM** to test components in isolation.
* API calls are mocked using `vi.mock` to ensure unit test determinism.
* Test execution:
  ```bash
  npm run test
  ```
