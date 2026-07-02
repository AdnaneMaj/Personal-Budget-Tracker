import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4100),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/budget_tracker',
  currency: 'MAD'
};
