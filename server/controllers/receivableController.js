import * as receivableService from '../services/receivableService.js';
import { requireInteger } from '../utils/http.js';

export async function listReceivables(req, res) {
  res.json(await receivableService.listReceivables({
    monthId: requireInteger(req.query.monthId, 'monthId')
  }));
}

export async function createReceivable(req, res) {
  res.status(201).json(await receivableService.createReceivable(req.body));
}

export async function updateReceivable(req, res) {
  res.json(await receivableService.updateReceivable(requireInteger(req.params.id, 'id'), req.body));
}

export async function deleteReceivable(req, res) {
  res.json(await receivableService.deleteReceivable(requireInteger(req.params.id, 'id')));
}
