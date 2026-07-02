import * as budgetService from '../services/budgetService.js';
import { requireInteger } from '../utils/http.js';

export async function getBudget(req, res) {
  res.json(await budgetService.getBudget(requireInteger(req.params.monthId, 'monthId')));
}

export async function updateBudgetLine(req, res) {
  res.json(await budgetService.updateBudgetLine(requireInteger(req.params.id, 'id'), req.body));
}
