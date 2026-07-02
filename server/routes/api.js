import express from 'express';
import { config } from '../config.js';
import { asyncHandler } from '../utils/http.js';
import * as monthController from '../controllers/monthController.js';
import * as categoryController from '../controllers/categoryController.js';
import * as budgetController from '../controllers/budgetController.js';
import * as transactionController from '../controllers/transactionController.js';
import * as savingsController from '../controllers/savingsController.js';
import * as dashboardController from '../controllers/dashboardController.js';

export const apiRouter = express.Router();

apiRouter.get('/config', (req, res) => {
  res.json({ currency: config.currency });
});

apiRouter.get('/months', asyncHandler(monthController.listMonths));
apiRouter.get('/months/current', asyncHandler(monthController.currentMonth));
apiRouter.post('/months', asyncHandler(monthController.createMonth));

apiRouter.get('/categories/:type', asyncHandler(categoryController.listCategories));
apiRouter.post('/categories/:type', asyncHandler(categoryController.createCategory));
apiRouter.patch('/categories/:type/:id', asyncHandler(categoryController.updateCategory));
apiRouter.delete('/categories/:type/:id', asyncHandler(categoryController.deactivateCategory));

apiRouter.get('/budget/:monthId', asyncHandler(budgetController.getBudget));
apiRouter.patch('/budget-lines/:id', asyncHandler(budgetController.updateBudgetLine));

apiRouter.get('/transactions/expenses', asyncHandler(transactionController.listExpenseTransactions));
apiRouter.post('/transactions/expenses', asyncHandler(transactionController.createExpenseTransaction));
apiRouter.patch('/transactions/expenses/:id', asyncHandler(transactionController.updateExpenseTransaction));
apiRouter.delete('/transactions/expenses/:id', asyncHandler(transactionController.deleteExpenseTransaction));

apiRouter.get('/transactions/income', asyncHandler(transactionController.listIncomeEntries));
apiRouter.post('/transactions/income', asyncHandler(transactionController.createIncomeEntry));
apiRouter.patch('/transactions/income/:id', asyncHandler(transactionController.updateIncomeEntry));
apiRouter.delete('/transactions/income/:id', asyncHandler(transactionController.deleteIncomeEntry));

apiRouter.get('/savings', asyncHandler(savingsController.listSavings));

apiRouter.get('/dashboard/:monthId', asyncHandler(dashboardController.getDashboard));
