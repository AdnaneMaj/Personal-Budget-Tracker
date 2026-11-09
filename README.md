*Disclaimer : All the content of this repo was vibecoded, except for this line ;)*

# Personal Budget Tracker

This is a budget tracker I built to manage my personal expenses, monthly budget, savings, receivables, and zakat.

I wanted something simple that I can run myself, with the option to add expenses manually or from natural language. The app works without any AI setup, so you can clone it and use the core budget tracker locally with Docker.

## What It Does

- Track monthly expenses and income
- Plan budgets by expense category
- See how much of the month and budget is already used
- Track receivables, meaning money people should give back
- Track savings over time
- Track zakat using gold and silver nisab
- Mark large purchases as spread expenses so they do not distort one month
- Optionally parse expenses with Groq AI

## Run The App

Clone the repo:

```bash
git clone https://github.com/AdnaneMaj/Personal-Budget-Tracker.git
cd Personal-Budget-Tracker
```

Create your `.env` file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start everything:

```bash
docker compose up
```

Then open:

```text
http://localhost:5173
```

## Environment Variables

The app can run with the default `.env.example` values. API keys are optional.

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/budget_tracker
PORT=4100
VITE_API_URL=http://localhost:4100/api

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

GOLDAPI_KEY=

```

After changing `.env`, restart the app:

```bash
docker compose restart app
```

## Development and Self-Hosted Production

Development runs Vite and the API separately with hot reload:

```bash
docker compose up -d
```

Production builds the React app, serves the UI and API from one port, and uses
its own PostgreSQL volume. Copy `.env.production.example` to `.env.production`
and replace the database password before the first deployment, then run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The production app is available locally at `http://127.0.0.1:8080`. It is bound
to localhost intentionally; Tailscale Serve can expose it privately:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' serve --bg --http=8080 8080
```

Use the URL printed by Tailscale from another device in the same tailnet. After
testing a new change in development, deploy it with the same production Compose
command. Useful production commands:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down
```

Do not add `-v` to `down` unless you intentionally want to delete the production
database volume.

## Optional AI Parsing

If you add a Groq API key, the app can turn text like this:

```text
2 milks 4dh each, chicken 40dh, bus 4dh
```

into editable expense rows before saving.

Include a date in the text, for example `Yesterday I bought 5 eggs for 20dh`
or `On 2026-10-12 coffee 15dh`. Dates are extracted separately for each item;
missing or unclear dates stay blank and must be filled in before saving.
Relative dates use the browser's time zone.
If the AI service fails, a basic local draft is provided with a review warning.
The local fallback supports ISO dates, day/month/year dates, and simple relative
dates such as today, yesterday, and a number of days ago.

Run parser regression tests with `npm test`.

Set:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

If you leave Groq empty, the app still works and uses a basic local parser.

## Optional Zakat Price Updates

For zakat, the app can refresh gold and silver prices automatically using GoldAPI.

Set:

```env
GOLDAPI_KEY=your_goldapi_key
```

If this is empty, the app still runs, but automatic nisab price updates are disabled.

## License

No license has been specified yet.
