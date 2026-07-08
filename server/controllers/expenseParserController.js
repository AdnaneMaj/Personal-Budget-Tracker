import * as expenseParserService from '../services/expenseParserService.js';

export async function parseExpenseText(req, res) {
  res.json(await expenseParserService.parseExpenseText(req.body));
}
