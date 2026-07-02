import * as monthService from '../services/monthService.js';
import { requireInteger } from '../utils/http.js';

export async function listMonths(req, res) {
  res.json(await monthService.listMonths());
}

export async function listMonthSummaries(req, res) {
  res.json(await monthService.listMonthSummaries());
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

export async function deleteMonth(req, res) {
  res.json(await monthService.deleteMonth(requireInteger(req.params.id, 'id')));
}
