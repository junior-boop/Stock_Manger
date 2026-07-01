// Tests pour les helpers d'images utilisés dans la synchronisation

function imageBasename(name: string): string {
  const m = String(name).split(/[\\/]/);
  return m[m.length - 1] || '';
}

function normalizeImagesForSync(table: string, row: any): any {
  if (table !== 'articles' || !row || typeof row !== 'object') return row;
  const raw = row.images;
  if (raw == null) return row;
  let arr: unknown;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return row;
  }
  if (!Array.isArray(arr)) return row;
  const basenames = arr.map((x: string) => imageBasename(String(x))).filter(Boolean);
  return { ...row, images: JSON.stringify(basenames) };
}

function extractImageNames(table: string, row: any): string[] {
  if (table !== 'articles' || !row || typeof row !== 'object') return [];
  const raw = row.images;
  if (raw == null) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((x: string) => imageBasename(String(x))).filter(Boolean);
  } catch {
    return [];
  }
}

describe('imageBasename', () => {
  it('extrait le basename d\'un chemin Windows', () => {
    expect(imageBasename('C:\\photos\\image1.jpg')).toBe('image1.jpg');
  });

  it('extrait le basename d\'un chemin Unix', () => {
    expect(imageBasename('/home/user/photos/image1.jpg')).toBe('image1.jpg');
  });

  it('retourne le nom si déjà un basename', () => {
    expect(imageBasename('image1.jpg')).toBe('image1.jpg');
  });

  it('retourne vide pour une chaîne vide', () => {
    expect(imageBasename('')).toBe('');
  });

  it('gère les séparateurs mixtes', () => {
    expect(imageBasename('photos\\images/photo.jpg')).toBe('photo.jpg');
  });
});

describe('normalizeImagesForSync', () => {
  it('normalise les chemins absolus en basenames', () => {
    const row = { id: 'a1', images: JSON.stringify(['C:\\photos\\img1.jpg', '/var/img2.png']) };
    const result = normalizeImagesForSync('articles', row);
    expect(JSON.parse(result.images)).toEqual(['img1.jpg', 'img2.png']);
  });

  it('laisse intacts les basenames', () => {
    const row = { id: 'a1', images: JSON.stringify(['img1.jpg', 'img2.png']) };
    const result = normalizeImagesForSync('articles', row);
    expect(JSON.parse(result.images)).toEqual(['img1.jpg', 'img2.png']);
  });

  it('ne touche pas aux autres tables', () => {
    const row = { id: 'c1', images: 'whatever' };
    expect(normalizeImagesForSync('clients', row)).toEqual(row);
  });

  it('gère les images null', () => {
    expect(normalizeImagesForSync('articles', { id: 'a1', images: null })).toEqual({ id: 'a1', images: null });
  });

  it('gère les images undefined', () => {
    expect(normalizeImagesForSync('articles', { id: 'a1' })).toEqual({ id: 'a1' });
  });

  it('gère les images déjà en tableau', () => {
    const row = { id: 'a1', images: ['img1.jpg', 'img2.png'] };
    const result = normalizeImagesForSync('articles', row);
    expect(JSON.parse(result.images)).toEqual(['img1.jpg', 'img2.png']);
  });
});

describe('extractImageNames', () => {
  it('extrait les basenames d\'une chaîne JSON', () => {
    const row = { id: 'a1', images: JSON.stringify(['C:\\photos\\img1.jpg', 'img2.png']) };
    expect(extractImageNames('articles', row)).toEqual(['img1.jpg', 'img2.png']);
  });

  it('retourne vide pour une table non-article', () => {
    expect(extractImageNames('clients', { id: 'c1', images: '[]' })).toEqual([]);
  });

  it('retourne vide si images est null', () => {
    expect(extractImageNames('articles', { id: 'a1', images: null })).toEqual([]);
  });
});
