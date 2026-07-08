import * as zakatService from '../services/zakatService.js';

export async function getZakatSummary(req, res) {
  res.json(await zakatService.getZakatSummary());
}

export async function markZakatPaid(req, res) {
  res.json(await zakatService.markZakatPaid());
}
