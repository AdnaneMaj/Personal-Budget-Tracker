import * as transactionService from '../services/transactionService.js';
import { requireInteger } from '../utils/http.js';

export async function listExpenseTransactions(req, res) {
  res.json(await transactionService.listExpenseTransactions({
    monthId: requireInteger(req.query.monthId, 'monthId'),
    categoryId: req.query.categoryId ? requireInteger(req.query.categoryId, 'categoryId') : null,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir
  }));
}

export async function createExpenseTransaction(req, res) {
  res.status(201).json(await transactionService.createExpenseTransaction(req.body));
}

export async function createExpenseTransactions(req, res) {
  res.status(201).json(await transactionService.createExpenseTransactions(req.body.transactions));
}

export async function updateExpenseTransaction(req, res) {
  res.json(await transactionService.updateExpenseTransaction(requireInteger(req.params.id, 'id'), req.body));
}

export async function deleteExpenseTransaction(req, res) {
  res.json(await transactionService.deleteExpenseTransaction(requireInteger(req.params.id, 'id')));
}

export async function listIncomeEntries(req, res) {
  res.json(await transactionService.listIncomeEntries({
    monthId: requireInteger(req.query.monthId, 'monthId'),
    categoryId: req.query.categoryId ? requireInteger(req.query.categoryId, 'categoryId') : null,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir
  }));
}

export async function createIncomeEntry(req, res) {
  res.status(201).json(await transactionService.createIncomeEntry(req.body));
}

export async function updateIncomeEntry(req, res) {
  res.json(await transactionService.updateIncomeEntry(requireInteger(req.params.id, 'id'), req.body));
}

export async function deleteIncomeEntry(req, res) {
  res.json(await transactionService.deleteIncomeEntry(requireInteger(req.params.id, 'id')));
}
