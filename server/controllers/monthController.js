import * as monthService from '../services/monthService.js';
import { requireInteger } from '../utils/http.js';

export async function listMonths(req, res) {
  res.json(await monthService.listMonths());
}

export async function currentMonth(req, res) {
  res.json(await monthService.getOrCreateCurrentMonth());
}

export async function createMonth(req, res) {
  const month = await monthService.createMonth({
    year: Number(req.body.year),
    month: Number(req.body.month),
    status: req.body.status || 'open',
    copyFromPrevious: Boolean(req.body.copyFromPrevious)
  });
  res.status(201).json(month);
}

export function parseMonthId(req) {
  return requireInteger(req.params.monthId, 'monthId');
}
