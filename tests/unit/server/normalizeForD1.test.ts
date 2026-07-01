// Tests pour normalizeForD1 — sérialisation des données pour l'envoi à D1
//
// Le serveur reçoit des objets JS complexes du client et doit les
// linéariser pour les bindings D1 qui n'acceptent que des scalaires.

function normalizeForD1(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object') {
      out[key] = JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      out[key] = value ? 1 : 0;
    } else {
      out[key] = value;
    }
  }
  return out;
}

describe('normalizeForD1', () => {
  it('supprime les undefined', () => {
    const result = normalizeForD1({ a: 1, b: undefined, c: 'hello' });
    expect(result).toEqual({ a: 1, c: 'hello' });
  });

  it('sérialise les objets en JSON string', () => {
    const result = normalizeForD1({ technicienIds: ['t1', 't2'], meta: { key: 'val' } });
    expect(result.technicienIds).toBe(JSON.stringify(['t1', 't2']));
    expect(result.meta).toBe(JSON.stringify({ key: 'val' }));
  });

  it('convertit les booléens en 0/1', () => {
    const result = normalizeForD1({ actif: true, deleted: false });
    expect(result.actif).toBe(1);
    expect(result.deleted).toBe(0);
  });

  it('laisse les scalaires intacts (string, number, null)', () => {
    const result = normalizeForD1({ nom: 'test', prix: 100.5, note: null });
    expect(result.nom).toBe('test');
    expect(result.prix).toBe(100.5);
    expect(result.note).toBeNull();
  });

  it('gère les tableaux de scalaires', () => {
    const result = normalizeForD1({ ids: [1, 2, 3] });
    expect(typeof result.ids).toBe('string');
    expect(JSON.parse(result.ids as string)).toEqual([1, 2, 3]);
  });
});
