import * as savingsService from '../services/savingsService.js';

export async function listSavings(req, res) {
  res.json(await savingsService.listSavings());
}
