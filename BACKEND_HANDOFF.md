# MCI frontend handoff

This note describes what is in this folder, what it does, and what still needs confirmation from the Java backend team. It is safe to share with the backend developer.

## A simple description to use

> I made an interactive browser prototype for the MCI control screen. It lets someone enter a goal and inspect a run's plan, progress, safety log, example files, and report. Right now it uses sample data in the browser; it is not connected to the Java system. Before I connect it, I need the actual API routes and the JSON/event formats from the backend.

## What is here today

- `index.html`, `styles.css`, and `app.js` make a plain HTML/CSS/JavaScript website. There is no React, Vite, Next.js, or `package.json` in this folder yet.
- A user can enter a goal, see a four-step sample plan, inspect task details, watch simulated progress, search run history, filter audit rows, and preview/download example artifacts.
- Runs created in the browser are saved in that browser's local storage. They are not saved in the Java database.
- The page does not make HTTP requests to the backend. No Gemini call, Java agent, Tool Gateway, Docker task, or database operation is triggered by this page.
- The `?` tour and `Ctrl+K` quick-actions menu explain and navigate the demo. They do not represent backend endpoints.

## What the project documents say

The MCI project report describes a Java 21+ Maven multi-module system, with a command-line interface, Gemini through LangChain4j, a planner, a sequential scheduler, a Tool Gateway, file tools, and persistent run/task/audit/artifact records. It says a REST API and web dashboard are future phases. These are statements from the report; this folder does not contain the Java source code to verify their implementation.

The separate MCI abstract describes the same broad idea: an orchestrator divides a goal among specialized agents, checks tool requests through a gateway, records execution, and combines results. It names PostgreSQL and describes isolated Docker execution.

## Details to reconcile before integration

The source documents do not fully agree, so the frontend should not guess:

- **Database:** the project report says SQLite; the abstract says PostgreSQL. The frontend usually should not need to know which database is behind the API, but the team should confirm the actual project setup.
- **API readiness:** the project report presents REST/SSE and the web UI as future work. The earlier frontend guide gives a proposed API contract. The backend developer should say which routes actually exist.
- **Frontend framework:** the earlier frontend guide suggests React + Vite; the project report says Next.js/React. This folder is currently plain JavaScript, so agree on the target framework before treating it as the final application structure.
- **Agent names:** this demo uses `NAVIGATOR`, `DATA_FILE`, `DOCKER`, and `REPORT`. Confirm the exact backend enum names and whether `DATA_FILE` is the same role as the report's Analysis/File agent.
- **Status values:** the proposed contract uses run states `PENDING`, `RUNNING`, `DONE`, and `FAILED`, with `SKIPPED` for subtasks. This demo also has a local `STOPPED` state for its stop button; confirm how a real backend represents cancellation before wiring that control.
- **Module count:** the report's module table lists seven named modules, while its build-status section says eight modules. Check the actual Maven project if the module count comes up.

## Proposed API in the earlier frontend guide

These paths are a proposal, not a verified backend contract. The guide gives `http://localhost:8080/api` as the proposed base URL:

| Method | Path | Intended screen/action |
|---|---|---|
| POST | `/runs` | Submit a goal and create a run |
| GET | `/runs` | Show recent runs |
| GET | `/runs/{id}` | Load a run and its subtasks |
| GET | `/runs/{id}/audit` | Show/filter tool decisions |
| GET | `/runs/{id}/artifacts` | List generated files |
| GET | `/runs/{id}/artifacts/{artifactId}/download` | Download one file |
| GET | `/runs/{id}/report` | Load the final report |
| GET | `/runs/{id}/events` | Receive live updates using Server-Sent Events (SSE) |

The project report mentions a smaller planned set (`POST /api/runs`, `GET /api/runs/{id}`, and SSE). Ask which routes and response shapes the backend actually implements; do not assume the full table is live.

## Questions for the backend developer

1. Is the REST service implemented yet? What command starts it, and what is its base URL?
2. Which endpoints are available today? Can you share example JSON for a run, subtask, audit entry, artifact, and report?
3. What exact status and agent names should the frontend display? How is a run stopped or cancelled?
4. What are the SSE event names and data fields? How should the page recover if it disconnects?
5. Does the backend allow the frontend's local development address (`http://localhost:5173`) to call it, or does it need a Vite proxy/CORS setting?
6. Should this prototype stay plain JavaScript for now, or should the team move it to React + Vite or Next.js before integration?

## How to show the prototype

From this folder, run `python -m http.server 5173` in PowerShell, then open `http://localhost:5173/`. Keep the terminal open while presenting. The data is illustrative; describe it as a frontend demo, not as live MCI execution.
