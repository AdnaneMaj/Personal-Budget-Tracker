import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4100),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/budget_tracker',
  currency: 'MAD',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || '',
  goldApiKey: process.env.GOLDAPI_KEY || '',
  goldApiBaseUrl: process.env.GOLDAPI_BASE_URL || 'https://www.goldapi.io/api',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAllowedChatId: process.env.TELEGRAM_ALLOWED_CHAT_ID || ''
};
