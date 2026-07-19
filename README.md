# Personal Budget Tracker

A self-hosted budget tracker for managing monthly expenses, income, receivables, savings, and zakat from a simple web interface.

The app runs locally with Docker and does not require API keys for the core experience. Optional integrations can be enabled for AI expense parsing, Telegram expense entry, and automatic gold/silver prices.

## Features

- Monthly budget planning by expense category
- Expense and income tracking
- Receivables tracking for money owed to you
- Savings overview and forecast
- Zakat tracking using gold and silver nisab
- Natural-language expense parsing with review before saving
- Optional Telegram bot for adding expenses from your phone

## Requirements

- Git
- Docker Desktop, or Docker Engine with Docker Compose

You do not need to install Node.js or PostgreSQL locally.

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd <repository-folder>
```

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the app:

```bash
docker compose up
```

Open the web app:

```text
http://localhost:5173
```

The first startup installs dependencies, creates the database schema, seeds the default categories, and starts the frontend and backend.

To stop the app, press `Ctrl+C`. If you started it in detached mode, run:

```bash
docker compose down
```

## Configuration

The app works without any optional API keys. Start with this minimal `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/budget_tracker
PORT=4100
VITE_API_URL=http://localhost:4100/api

GROQ_API_KEY=
GROQ_MODEL=

GOLDAPI_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_ID=
```

After changing `.env`, restart the app container:

```bash
docker compose restart app
```

## Optional Integrations

### Groq AI Parsing

Groq improves natural-language expense parsing. Without Groq, the app still runs and uses a simpler local parser.

Add your Groq credentials:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Example input:

```text
2 milks 4dh each, chicken 40dh, bus 4dh
```

The app turns this into editable expense rows before saving.

### Telegram Bot

Telegram lets you send expenses from your phone.

1. Create a bot with `@BotFather`.
2. Copy the bot token into `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_CHAT_ID=
```

3. Restart the app.
4. Send `/start` to your bot.
5. Copy the chat ID returned by the bot into `.env`:

```env
TELEGRAM_ALLOWED_CHAT_ID=your_chat_id
```

6. Restart the app again.

Only the configured chat ID can use the bot. If `TELEGRAM_BOT_TOKEN` is empty, the bot is disabled and the web app still works normally.

### GoldAPI For Zakat

GoldAPI is used to refresh gold and silver prices once per day for zakat nisab calculations.

```env
GOLDAPI_KEY=your_goldapi_key
```

Without `GOLDAPI_KEY`, the app still runs, but automatic nisab price updates are disabled.

## Data Storage

PostgreSQL runs in Docker and stores data in the `budget_postgres` volume. Your data survives normal container restarts and `docker compose down`.

Deleting Docker volumes will delete the database.

## Security Notes

- Do not commit `.env`.
- Keep API keys and Telegram bot tokens private.
- If a token is exposed, revoke it and create a new one.

## License

No license has been specified yet.
