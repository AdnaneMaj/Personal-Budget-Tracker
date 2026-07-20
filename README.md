*Disclaimer : All the content of this repo was vibecoded, except for this line ;)*

# Personal Budget Tracker

This is a budget tracker I built to manage my personal expenses, monthly budget, savings, receivables, and zakat.

I wanted something simple that I can run myself, with the option to add expenses manually, from natural language, or through Telegram. The app works without any AI or Telegram setup, so you can clone it and use the core budget tracker locally with Docker.

## What It Does

- Track monthly expenses and income
- Plan budgets by expense category
- See how much of the month and budget is already used
- Track receivables, meaning money people should give back
- Track savings over time
- Track zakat using gold and silver nisab
- Mark large purchases as spread expenses so they do not distort one month
- Optionally parse expenses with Groq AI
- Optionally add expenses from Telegram

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

TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_ID=
```

After changing `.env`, restart the app:

```bash
docker compose restart app
```

## Optional AI Parsing

If you add a Groq API key, the app can turn text like this:

```text
2 milks 4dh each, chicken 40dh, bus 4dh
```

into editable expense rows before saving.

Set:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

If you leave Groq empty, the app still works and uses a basic local parser.

## Optional Telegram Bot

Telegram is useful if you want to add expenses from your phone.

1. Create a bot using `@BotFather`.
2. Put the token in `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_CHAT_ID=
```

3. Restart the app.
4. Send `/start` to your bot.
5. The bot will reply with your chat ID.
6. Put that chat ID in `.env`:

```env
TELEGRAM_ALLOWED_CHAT_ID=your_chat_id
```

7. Restart the app again.

Only the configured chat ID can use the bot. If the Telegram token is empty, the bot is disabled.

## Optional Zakat Price Updates

For zakat, the app can refresh gold and silver prices automatically using GoldAPI.

Set:

```env
GOLDAPI_KEY=your_goldapi_key
```

If this is empty, the app still runs, but automatic nisab price updates are disabled.

## License

No license has been specified yet.
