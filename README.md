# Taskline frontend demo

This is a browser-only prototype of the multi-agent operations dashboard in `frontend.pdf`. It is designed so you can explore the workflow before connecting the Java backend.

For an honest backend handoff, current limitations, and questions to confirm, see `BACKEND_HANDOFF.md`.

## Start the page

Open PowerShell in this folder and run:

```powershell
python -m http.server 5173
```

If Python's `py` launcher is installed, `py -m http.server 5173` also works. Leave the terminal open and visit <http://localhost:5173/>. Press Ctrl+C in PowerShell to stop the server.

## Explore the demo

1. Submit an objective. A new run opens with a four-step dependency plan.
2. Click a task card to inspect its description, dependencies, attempts, and result.
3. Watch the simulated event feed advance. The example intentionally includes two denied tool calls, which remain visible in the audit log.
4. Use the tabs to filter and expand audit rows, preview and download files, and open the report.
5. Use Run history to search and filter earlier objectives. Runs are saved in this browser using local storage.
6. Click the `?` button for a quick tour. Press **Ctrl+K** (or **Cmd+K** on Mac) to open Quick actions and jump to a page, start a run, or reopen a recent run.

The dashboard also uses small entrance, hover, progress, and completion effects. If your computer is set to reduce motion, those animations are minimized automatically.

## Files

- `index.html` is the small HTML entry point. It loads the styles and application script.
- `styles.css` controls layout, colors, the task board, responsive behavior, and dialogs.
- `app.js` contains the demo data, browser interactions, run simulation, filters, and download previews.

This starter uses plain browser JavaScript and no package installation so the first project is easy to run and study. The original guide recommends React + Vite + TypeScript for the full frontend; we can migrate the working screens into that stack once you are comfortable with the page.

## What still needs the backend

This frontend demo does not start real agents or use an LLM. New runs, live activity, tool decisions, reports, and files are simulated locally. The page does not yet call the API. When the backend is ready, confirm its contract against `frontend.pdf`, then replace the simulation with requests to `http://localhost:8080/api` through a shared API layer. The browser must never hold secrets or run agents itself.
