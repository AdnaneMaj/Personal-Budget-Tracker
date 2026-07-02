import * as dashboardService from '../services/dashboardService.js';
import { requireInteger } from '../utils/http.js';

export async function getDashboard(req, res) {
  res.json(await dashboardService.getDashboard(requireInteger(req.params.monthId, 'monthId')));
}
