// Tests pour parseJsonFields — parsing des champs stockés en JSON string
// dans la base locale (technicienIds, devisIds, etc.)

function parseJsonFields(table: string, row: any): any {
  const JSON_FIELDS: Record<string, string[]> = {
    taches_projet: ['technicienIds'],
    projets: ['technicienIds', 'devisIds'],
  };

  const fields = JSON_FIELDS[table];
  if (!fields || !row || typeof row !== 'object') return row;

  const out = { ...row };
  for (const field of fields) {
    const v = out[field];
    if (typeof v === 'string') {
      try {
        out[field] = JSON.parse(v);
      } catch {
        /* on laisse la valeur telle quelle */
      }
    }
  }
  return out;
}

describe('parseJsonFields', () => {
  it('parse technicienIds pour taches_projet', () => {
    const row = { id: 't1', technicienIds: '["uid1","uid2"]' };
    const result = parseJsonFields('taches_projet', row);
    expect(result.technicienIds).toEqual(['uid1', 'uid2']);
  });

  it('parse devisIds pour projets', () => {
    const row = { id: 'p1', devisIds: '["d1","d2"]', technicienIds: '["t1"]' };
    const result = parseJsonFields('projets', row);
    expect(result.devisIds).toEqual(['d1', 'd2']);
    expect(result.technicienIds).toEqual(['t1']);
  });

  it('ne casse pas si le champ est déjà un tableau', () => {
    const row = { id: 't1', technicienIds: ['uid1'] };
    const result = parseJsonFields('taches_projet', row);
    expect(result.technicienIds).toEqual(['uid1']);
  });

  it('ne casse pas si le champ est null', () => {
    const row = { id: 't1', technicienIds: null };
    const result = parseJsonFields('taches_projet', row);
    expect(result.technicienIds).toBeNull();
  });

  it('ignore les tables sans JSON fields', () => {
    const row = { id: 'c1', nom: 'test' };
    const result = parseJsonFields('clients', row);
    expect(result).toEqual(row);
  });

  it('ignore les chords JSON invalides', () => {
    const row = { id: 't1', technicienIds: 'pas du json{]}' };
    const result = parseJsonFields('taches_projet', row);
    expect(result.technicienIds).toBe('pas du json{]}');
  });
});
