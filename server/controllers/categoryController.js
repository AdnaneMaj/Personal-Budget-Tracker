import * as categoryService from '../services/categoryService.js';
import { requireInteger } from '../utils/http.js';

export async function listCategories(req, res) {
  res.json(await categoryService.listCategories(req.params.type));
}

export async function createCategory(req, res) {
  res.status(201).json(await categoryService.createCategory(req.params.type, req.body));
}

export async function updateCategory(req, res) {
  res.json(await categoryService.updateCategory(req.params.type, requireInteger(req.params.id, 'id'), req.body));
}

export async function deactivateCategory(req, res) {
  res.json(await categoryService.deactivateCategory(req.params.type, requireInteger(req.params.id, 'id')));
}
