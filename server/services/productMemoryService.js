import { query } from '../db/pool.js';

export function normalizeProductName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberProduct(row) {
  return {
    ...row,
    id: Number(row.id),
    category_id: Number(row.category_id),
    unit_price: Number(row.unit_price),
    aliases: Array.isArray(row.aliases) ? row.aliases : []
  };
}

export async function listProductMemory() {
  const { rows } = await query(
    `SELECT p.id,
            p.canonical_name,
            p.normalized_name,
            p.category_id,
            c.name AS category_name,
            p.unit_price,
            COALESCE(
              json_agg(pa.alias ORDER BY pa.alias) FILTER (WHERE pa.id IS NOT NULL),
              '[]'::json
            ) AS aliases
     FROM products p
     JOIN expense_categories c ON c.id = p.category_id
     LEFT JOIN product_aliases pa ON pa.product_id = p.id
     GROUP BY p.id, c.name
     ORDER BY p.canonical_name`
  );
  return rows.map(numberProduct);
}

export function productMemoryIndex(products) {
  const byId = new Map();
  const byName = new Map();

  for (const product of products) {
    byId.set(Number(product.id), product);
    const names = [product.canonical_name, ...(product.aliases || [])];
    for (const name of names) {
      const normalized = normalizeProductName(name);
      if (normalized && !byName.has(normalized)) byName.set(normalized, product);
    }
  }

  return { byId, byName };
}

async function addAlias(client, productId, alias) {
  const value = String(alias || '').trim();
  const normalized = normalizeProductName(value);
  if (!normalized) return;

  await client.query(
    `INSERT INTO product_aliases (product_id, alias, normalized_alias)
     VALUES ($1, $2, $3)
     ON CONFLICT (normalized_alias) DO NOTHING`,
    [productId, value, normalized]
  );
}

async function productForUpdate(client, productId) {
  if (!productId) return null;
  const { rows } = await client.query(
    `SELECT id, canonical_name, normalized_name, category_id, unit_price
     FROM products
     WHERE id = $1
     FOR UPDATE`,
    [productId]
  );
  return rows[0] || null;
}

async function productByNameForUpdate(client, normalizedName) {
  if (!normalizedName) return null;
  const { rows } = await client.query(
    `SELECT p.id, p.canonical_name, p.normalized_name, p.category_id, p.unit_price
     FROM products p
     LEFT JOIN product_aliases pa ON pa.product_id = p.id
     WHERE p.normalized_name = $1 OR pa.normalized_alias = $1
     ORDER BY (p.normalized_name = $1) DESC
     LIMIT 1
     FOR UPDATE OF p`,
    [normalizedName]
  );
  return rows[0] || null;
}

export async function learnProduct(client, payload) {
  const canonicalName = String(payload.description || '').trim();
  const normalizedName = normalizeProductName(canonicalName);
  const categoryId = Number(payload.category_id);
  const unitPrice = Number(payload.unit_price);

  if (!normalizedName || !Number.isInteger(categoryId) || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }

  let product = await productForUpdate(client, Number(payload.product_id) || null);
  if (!product) product = await productByNameForUpdate(client, normalizedName);

  if (product) {
    const updated = await client.query(
      `UPDATE products
       SET category_id = $1,
           unit_price = $2,
           updated_at = now()
       WHERE id = $3
       RETURNING id, canonical_name, normalized_name, category_id, unit_price`,
      [categoryId, unitPrice, product.id]
    );
    product = updated.rows[0];
  } else {
    const inserted = await client.query(
      `INSERT INTO products (canonical_name, normalized_name, category_id, unit_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (normalized_name) DO UPDATE
       SET category_id = EXCLUDED.category_id,
           unit_price = EXCLUDED.unit_price,
           updated_at = now()
       RETURNING id, canonical_name, normalized_name, category_id, unit_price`,
      [canonicalName, normalizedName, categoryId, unitPrice]
    );
    product = inserted.rows[0];
  }

  await addAlias(client, product.id, product.canonical_name);
  await addAlias(client, product.id, canonicalName);
  await addAlias(client, product.id, payload.product_alias);

  return numberProduct({ ...product, aliases: [] });
}
