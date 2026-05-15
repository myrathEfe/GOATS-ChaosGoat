# Kintsugi Monkey Banking Frontend

React + Vite dashboard for the Kintsugi Monkey Banking hackathon demo.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

## Environment

Create or export this value for the frontend runtime:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

The frontend only calls the backend REST API. It does not call Gemini directly and does not store API keys.

## Expected Demo Flow

1. Start the backend on `http://localhost:4000`.
2. Start this frontend with `npm run dev`.
3. Open the Vite local URL in the browser.
4. Use **Refresh Health** to verify service state.
5. Use **Run Demo Transaction** to show the normal banking path.
6. Use **Break fraud-check-service** to create a controlled failure.
7. Run another demo transaction and show **Safe Degradation Activated** when manual review is used.
8. Use **Analyze Last Experiment** to load the **Golden Trace** and **Gemini Analysis**.
9. Use **Recover fraud-check-service** to restore service health.
