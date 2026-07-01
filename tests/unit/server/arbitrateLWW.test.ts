// Tests pour l'arbitrage LWW (Last-Writer-Wins) côté serveur
//
// Ces tests vérifient la règle d'arbitrage décrite dans sync.ts:
//   _version absent    → apply (compat ancien client)
//   _version >= server → client gagne (apply + bump)
//   _version <  server → serveur gagne (applied:"server" + canonique)
//
// La fonction arbitrateLWW n'étant pas exportée depuis sync.ts,
// on réimplémente ici la règle pure (sans dépendance D1) pour la tester.
// En production, il faudrait exporter la fonction depuis sync.ts.

type LwwDecision =
  | { apply: true; cleanBody: Record<string, unknown> }
  | { apply: false; response: { applied: 'server'; currentVersion: number; data: unknown } };

type SyncStateRow = { version: number; updatedAt: string };

function arbitrateLWW(
  body: Record<string, unknown>,
  current: SyncStateRow | null,
  canonical: unknown,
): LwwDecision {
  const { _version, ...cleanBody } = body as Record<string, unknown> & {
    _version?: number;
  };

  if (typeof _version !== 'number') {
    return { apply: true, cleanBody };
  }
  if (!current) {
    return { apply: true, cleanBody };
  }

  if (_version >= current.version) {
    return { apply: true, cleanBody };
  }

  return {
    apply: false,
    response: {
      applied: 'server',
      currentVersion: current.version,
      data: canonical,
    },
  };
}

describe('arbitrateLWW — règles d\'arbitrage', () => {
  const canonical = { id: 'x', nom: 'version serveur' };

  it('accepte si _version est absent (compat ancien client)', () => {
    const result = arbitrateLWW({ nom: 'test' }, { version: 5, updatedAt: '' }, canonical);
    expect(result.apply).toBe(true);
    expect((result as any).cleanBody).not.toHaveProperty('_version');
  });

  it('accepte si _version n\'est pas un nombre', () => {
    const result = arbitrateLWW({ _version: 'abc', nom: 'test' } as any, { version: 5, updatedAt: '' }, canonical);
    expect(result.apply).toBe(true);
  });

  it('accepte si la ligne n\'existe pas côté serveur', () => {
    const result = arbitrateLWW({ _version: 1, nom: 'test' }, null, canonical);
    expect(result.apply).toBe(true);
  });

  it('accepte si _version === currentVersion (dernier writer gagne)', () => {
    const result = arbitrateLWW({ _version: 3, nom: 'update' }, { version: 3, updatedAt: '' }, canonical);
    expect(result.apply).toBe(true);
  });

  it('accepte si _version > currentVersion (self-healing, client ahead)', () => {
    const result = arbitrateLWW({ _version: 10, nom: 'futur' }, { version: 5, updatedAt: '' }, canonical);
    expect(result.apply).toBe(true);
  });

  it('rejette si _version < currentVersion (serveur gagne)', () => {
    const result = arbitrateLWW({ _version: 2, nom: 'vieux' }, { version: 5, updatedAt: '' }, canonical);
    expect(result.apply).toBe(false);
    if (!result.apply) {
      expect(result.response.applied).toBe('server');
      expect(result.response.currentVersion).toBe(5);
      expect(result.response.data).toEqual(canonical);
    }
  });

  it('nettoie _version du body avant de l\'appliquer', () => {
    const result = arbitrateLWW({ _version: 3, nom: 'test', prix: 100 }, { version: 3, updatedAt: '' }, canonical);
    expect(result.apply).toBe(true);
    if (result.apply) {
      expect(result.cleanBody).not.toHaveProperty('_version');
      expect(result.cleanBody).toEqual({ nom: 'test', prix: 100 });
    }
  });
});

describe('arbitrateLWW — scénarios de conflit réels', () => {
  const canonical = { id: 'client_001', nom: 'Jean', email: 'jean@mail.com' };

  it('conflit: deux clients poussent la même ligne, le dernier gagne', () => {
    // Client A pousse en premier → version 1 → server accepte → bump à 1
    const resultA = arbitrateLWW(
      { _version: 0, nom: 'Client A' },
      null,
      canonical,
    );
    expect(resultA.apply).toBe(true);

    // Client B pousse avec _version=0 alors que server est à 1 → perdu
    const resultB = arbitrateLWW(
      { _version: 0, nom: 'Client B' },
      { version: 1, updatedAt: '' },
      canonical,
    );
    expect(resultB.apply).toBe(false);
  });

  it('conflit: réveil après offline prolongé', () => {
    // Client était à version 2, serveur est à version 8
    const result = arbitrateLWW(
      { _version: 2, nom: 'modif offline' },
      { version: 8, updatedAt: '' },
      canonical,
    );
    expect(result.apply).toBe(false);
  });

  it('auto-réparation: client avec version future (bug possible)', () => {
    // Devrait arriver, mais on self-heal
    const result = arbitrateLWW(
      { _version: 20, nom: 'futur mystérieux' },
      { version: 5, updatedAt: '' },
      canonical,
    );
    expect(result.apply).toBe(true);
  });

  it('première écriture: version 0 acceptée même si serveur a des données', () => {
    const result = arbitrateLWW(
      { _version: 0, nom: 'nouveau' },
      { version: 0, updatedAt: '' },
      canonical,
    );
    expect(result.apply).toBe(true);
  });
});
