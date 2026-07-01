// Tests de régression — documentation des bugs connus
//
// Ces tests sont passifs (documentation uniquement).
// Ils échoueront quand les correctifs seront appliqués : il faudra
// alors les convertir en vrais tests de non-régression.

const KNOWN_BUGS = {
  BUG_001: {
    id: 'BUG-001',
    title: 'Pull écrase les données dirty locales',
    file: 'src/Databases/index.ts — batchApplyRemoteEntries (l.2102-2116)',
    severity: 'critique',
    status: 'non corrigé',
    description: `batchApplyRemoteEntries appelle model.batchUpsert sans vérifier
    si la ligne est dirty localement. Les modifications locales non pushées
    sont silencieusement perdues lors d'un pull.`,
    fix: `Dans batchApplyRemoteEntries, vérifier syncState.get(table, id).dirty
    avant d'upserter. Sauter les lignes dirty (le push gérera le conflit LWW).`,
  },
  BUG_002: {
    id: 'BUG-002',
    title: 'markClean manquant après applied:server',
    file: 'src/context/sync_client.ts — pushSingleDirty (l.957-983)',
    severity: 'important',
    status: 'non corrigé',
    description: `Quand le serveur répond applied:'server' avec des données
    canoniques, applyRemote est appelé mais markClean ne l'est pas.
    dirty reste à 1, provoquant un re-push inutile au cycle suivant.`,
    fix: `Ajouter syncState.markClean(table, id, currentVersion)
    après syncState.applyRemote dans le bloc applied:'server'.`,
  },
  BUG_003: {
    id: 'BUG-003',
    title: 'entreprises jamais synchronisée',
    file: 'src/context/db_sync.ts — CAMEL_TO_SNAKE (l.14-30)',
    severity: 'important',
    status: 'non corrigé',
    description: `CAMEL_TO_SNAKE omet la clé 'entreprises'.
    Les modifications société ne sont jamais pushées vers le serveur.`,
    fix: `Ajouter entreprises: 'entreprises' dans CAMEL_TO_SNAKE
    ET appeler markDirty('entreprises', 'default') dans updateEntreprise().`,
  },
  BUG_004: {
    id: 'BUG-004',
    title: 'prixTTC non recalculé côté serveur après PUT partiel',
    file: '.server-cache/src/routes/sync.ts — PUT /:table/:id (l.378-424)',
    severity: 'mineur',
    status: 'non corrigé',
    description: `Un PUT partiel (sans prixHT/tauxTVA) laisse prixTTC obsolète
    côté serveur. LWW peut propager un prixTTC inconsistent aux autres postes.`,
    fix: `Recalculer prixTTC côté serveur à l'écriture,
    ou exiger la cohérence triple (prixHT, tauxTVA, prixTTC) dans le payload.`,
  },
  BUG_005: {
    id: 'BUG-005',
    title: 'lignes_documents: timestamps absents côté serveur',
    file: '.server-cache/src/models.ts vs src/Databases/index.ts (l.816-833)',
    severity: 'important',
    status: 'non corrigé',
    description: `Le schéma serveur de lignes_documents n'a pas createdAt/updatedAt.
    L'upsert client échoue (NOT NULL ← NULL) après pull.`,
    fix: `Ajouter createdAt/updatedAt au schéma serveur,
    ou retirer NOT NULL côté client.`,
  },
};

describe.skip('BUG-001: Pull écrase les données dirty locales', () => {
  it(`[${KNOWN_BUGS.BUG_001.status}] ${KNOWN_BUGS.BUG_001.title}`, () => {
    console.warn(`
  ╔══════════════════════════════════════════════════════════════╗
  ║ BUG-001 (${KNOWN_BUGS.BUG_001.severity}) — ${KNOWN_BUGS.BUG_001.title}  ║
  ╚══════════════════════════════════════════════════════════════╝
  Fichier :  ${KNOWN_BUGS.BUG_001.file}
  Status :   ${KNOWN_BUGS.BUG_001.status}

  Description :
  ${KNOWN_BUGS.BUG_001.description}

  Correction attendue :
  ${KNOWN_BUGS.BUG_001.fix}
    `);
    expect(KNOWN_BUGS.BUG_001.status).toBe('corrigé');
  });
});

describe.skip('BUG-002: markClean manquant après server-overwrite', () => {
  it(`[${KNOWN_BUGS.BUG_002.status}] ${KNOWN_BUGS.BUG_002.title}`, () => {
    console.warn(`
  ╔══════════════════════════════════════════════════════════════╗
  ║ BUG-002 (${KNOWN_BUGS.BUG_002.severity}) — ${KNOWN_BUGS.BUG_002.title}║
  ╚══════════════════════════════════════════════════════════════╝
  Fichier :  ${KNOWN_BUGS.BUG_002.file}
  Status :   ${KNOWN_BUGS.BUG_002.status}

  Description :
  ${KNOWN_BUGS.BUG_002.description}

  Correction attendue :
  ${KNOWN_BUGS.BUG_002.fix}
    `);
    expect(KNOWN_BUGS.BUG_002.status).toBe('corrigé');
  });
});

describe.skip('BUG-003: entreprises jamais synchronisée', () => {
  it(`[${KNOWN_BUGS.BUG_003.status}] ${KNOWN_BUGS.BUG_003.title}`, () => {
    console.warn(`
  ╔══════════════════════════════════════════════════════════════╗
  ║ BUG-003 (${KNOWN_BUGS.BUG_003.severity}) — ${KNOWN_BUGS.BUG_003.title}║
  ╚══════════════════════════════════════════════════════════════╝
  Fichier :  ${KNOWN_BUGS.BUG_003.file}
  Status :   ${KNOWN_BUGS.BUG_003.status}

  Description :
  ${KNOWN_BUGS.BUG_003.description}

  Correction attendue :
  ${KNOWN_BUGS.BUG_003.fix}
    `);
    expect(KNOWN_BUGS.BUG_003.status).toBe('corrigé');
  });
});

describe.skip('BUG-004: prixTTC stale après PUT partiel', () => {
  it(`[${KNOWN_BUGS.BUG_004.status}] ${KNOWN_BUGS.BUG_004.title}`, () => {
    console.warn(`
  ╔══════════════════════════════════════════════════════════════╗
  ║ BUG-004 (${KNOWN_BUGS.BUG_004.severity}) — ${KNOWN_BUGS.BUG_004.title}║
  ╚══════════════════════════════════════════════════════════════╝
  Fichier :  ${KNOWN_BUGS.BUG_004.file}
  Status :   ${KNOWN_BUGS.BUG_004.status}

  Description :
  ${KNOWN_BUGS.BUG_004.description}

  Correction attendue :
  ${KNOWN_BUGS.BUG_004.fix}
    `);
    expect(KNOWN_BUGS.BUG_004.status).toBe('corrigé');
  });
});

describe.skip('BUG-005: lignes_documents timestamps manquants', () => {
  it(`[${KNOWN_BUGS.BUG_005.status}] ${KNOWN_BUGS.BUG_005.title}`, () => {
    console.warn(`
  ╔══════════════════════════════════════════════════════════════╗
  ║ BUG-005 (${KNOWN_BUGS.BUG_005.severity}) — ${KNOWN_BUGS.BUG_005.title}║
  ╚══════════════════════════════════════════════════════════════╝
  Fichier :  ${KNOWN_BUGS.BUG_005.file}
  Status :   ${KNOWN_BUGS.BUG_005.status}

  Description :
  ${KNOWN_BUGS.BUG_005.description}

  Correction attendue :
  ${KNOWN_BUGS.BUG_005.fix}
    `);
    expect(KNOWN_BUGS.BUG_005.status).toBe('corrigé');
  });
});
