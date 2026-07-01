// Tests pour normalizeForSqlite — sérialisation des données pour SQLite local

function normalizeForSqlite(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  return out;
}

describe('normalizeForSqlite', () => {
  it('supprime les undefined', () => {
    expect(normalizeForSqlite({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('sérialise les objets en JSON string', () => {
    const result = normalizeForSqlite({ data: { nested: true } });
    expect(result.data).toBe('{"nested":true}');
  });

  it('sérialise les tableaux en JSON string', () => {
    const result = normalizeForSqlite({ tags: ['a', 'b'] });
    expect(result.tags).toBe('["a","b"]');
  });

  it('laisse les primitives intactes', () => {
    const result = normalizeForSqlite({ nom: 'test', age: 30, prix: 99.99 });
    expect(result).toEqual({ nom: 'test', age: 30, prix: 99.99 });
  });

  it('passe les null tels quels', () => {
    const result = normalizeForSqlite({ nom: null });
    expect(result.nom).toBeNull();
  });

  it('gère un objet vide', () => {
    expect(normalizeForSqlite({})).toEqual({});
  });
});
