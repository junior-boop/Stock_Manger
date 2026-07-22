import crypto from 'node:crypto';
import {
  getAllAdministrateurs,
  createAdministrateur,
  updateAdministrateur,
  deleteAdministrateur,
} from './index';
import type { Administrateur, RoleAdmin } from './db';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export type SessionUser = Omit<Administrateur, 'motDePasseHash'>;

let currentUser: SessionUser | null = null;

function stripHash(admin: Administrateur): SessionUser {
  const { motDePasseHash, ...safe } = admin;
  return safe;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST, maxmem: SCRYPT_MAXMEM })
    .toString('hex');
  return `scrypt$${SCRYPT_COST}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const cost = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];
  const computed = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, { N: cost, maxmem: SCRYPT_MAXMEM })
    .toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(computed, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getCurrentUser(): SessionUser | null {
  return currentUser;
}

export async function isSetupDone(): Promise<boolean> {
  const admins = await getAllAdministrateurs();
  return !!admins && admins.length > 0;
}

export async function setupFirstAdmin(data: {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  motDePasse: string;
}): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  if (await isSetupDone()) {
    return { ok: false, error: 'Configuration déjà effectuée' };
  }
  if (!data.email || !data.motDePasse) {
    return { ok: false, error: 'Email et mot de passe requis' };
  }
  if (data.motDePasse.length < 6) {
    return { ok: false, error: 'Mot de passe trop court (minimum 6 caractères)' };
  }

  const motDePasseHash = hashPassword(data.motDePasse);
  const created = await createAdministrateur({
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    telephone: data.telephone,
    role: 'super_admin',
    motDePasseHash,
    avatar: undefined,
    statut: 'actif',
    derniereConnexion: new Date().toISOString(),
  } as Omit<Administrateur, 'id' | 'createdAt' | 'updatedAt'>);

  if (!created) return { ok: false, error: 'Erreur lors de la création' };

  const safe = stripHash(created as Administrateur);
  currentUser = safe;
  return { ok: true, user: safe };
}

const DEMO_EMAIL = 'demo.local@kataleya.app';

export async function setupDemoAccount(data: {
  nom: string;
  prenom: string;
  motDePasse: string;
}): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  if (await isSetupDone()) {
    return { ok: false, error: 'Configuration déjà effectuée' };
  }
  if (!data.nom || !data.prenom || !data.motDePasse) {
    return { ok: false, error: 'Nom, prénom et mot de passe requis' };
  }
  if (data.motDePasse.length < 6) {
    return { ok: false, error: 'Mot de passe trop court (minimum 6 caractères)' };
  }

  const motDePasseHash = hashPassword(data.motDePasse);
  const created = await createAdministrateur({
    nom: data.nom,
    prenom: data.prenom,
    email: DEMO_EMAIL,
    role: 'demo',
    motDePasseHash,
    avatar: undefined,
    statut: 'actif',
    derniereConnexion: new Date().toISOString(),
  } as Omit<Administrateur, 'id' | 'createdAt' | 'updatedAt'>);

  if (!created) return { ok: false, error: 'Erreur lors de la création' };

  const safe = stripHash(created as Administrateur);
  currentUser = safe;
  return { ok: true, user: safe };
}

export async function login(
  email: string,
  motDePasse: string,
): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  const admins = await getAllAdministrateurs();
  if (!admins) return { ok: false, error: 'Erreur base de données' };

  const admin = admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!admin) return { ok: false, error: 'Identifiants invalides' };
  if (admin.statut !== 'actif') return { ok: false, error: 'Compte désactivé' };

  if (!verifyPassword(motDePasse, admin.motDePasseHash)) {
    return { ok: false, error: 'Identifiants invalides' };
  }

  updateAdministrateur(admin.id, {
    derniereConnexion: new Date().toISOString(),
  } as Partial<Administrateur>);

  const safe = stripHash(admin);
  currentUser = safe;
  return { ok: true, user: safe };
}

export function logout(): void {
  currentUser = null;
}

const PERMISSIONS: Record<string, RoleAdmin[]> = {
  // Admins / utilisateurs
  'admins:manage': ['super_admin'],
  // Paramètres entreprise
  'parametres:edit': ['super_admin', 'admin', 'demo'],
  // Articles & collections
  'articles:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
  'articles:delete': ['super_admin', 'admin', 'demo'],
  'collections:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
  'collections:delete': ['super_admin', 'admin', 'demo'],
  // Clients
  'clients:write': ['super_admin', 'admin', 'gestionnaire', 'vendeur', 'demo'],
  'clients:delete': ['super_admin', 'admin', 'demo'],
  // Devis
  'devis:create': ['super_admin', 'admin', 'gestionnaire', 'vendeur', 'demo'],
  'devis:modify': ['super_admin', 'admin', 'demo'],
  'devis:delete': ['super_admin', 'admin', 'demo'],
  // Factures
  'factures:create': ['super_admin', 'admin', 'gestionnaire', 'demo'],
  'factures:modify': ['super_admin', 'admin', 'demo'],
  'factures:delete': ['super_admin', 'admin', 'demo'],
  // Paiements
  'paiements:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
  // Journal d'audit
  'journal:read': ['super_admin', 'admin', 'demo'],
  // Demandes de modification
  'demandes:create': ['gestionnaire', 'vendeur'],
  'demandes:validate': ['super_admin', 'admin', 'demo'],
};

export function hasPermission(action: string, user: SessionUser | null = currentUser): boolean {
  if (!user) return false;
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(user.role);
}

export function requireAuth(): SessionUser {
  if (!currentUser) throw new Error('Non authentifié');
  return currentUser;
}

export function requirePermission(action: string): SessionUser {
  const user = requireAuth();
  if (!hasPermission(action, user)) {
    throw new Error(`Permission refusée: ${action}`);
  }
  return user;
}

export async function createUser(data: {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: RoleAdmin;
  motDePasse: string;
  statut?: 'actif' | 'inactif' | 'archivé';
}): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  if (!hasPermission('admins:manage')) {
    return { ok: false, error: 'Permission refusée' };
  }
  if (!data.email || !data.motDePasse || !data.nom || !data.prenom || !data.role) {
    return { ok: false, error: 'Champs requis manquants' };
  }
  if (data.motDePasse.length < 6) {
    return { ok: false, error: 'Mot de passe trop court (minimum 6 caractères)' };
  }
  const admins = await getAllAdministrateurs();
  if (admins?.some((a) => a.email.toLowerCase() === data.email.toLowerCase())) {
    return { ok: false, error: 'Email déjà utilisé' };
  }
  const created = await createAdministrateur({
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    telephone: data.telephone,
    role: data.role,
    motDePasseHash: hashPassword(data.motDePasse),
    avatar: undefined,
    statut: data.statut ?? 'actif',
    derniereConnexion: undefined,
  } as unknown as Omit<Administrateur, 'id' | 'createdAt' | 'updatedAt'>);
  if (!created) return { ok: false, error: 'Erreur lors de la création' };
  return { ok: true, user: stripHash(created as unknown as Administrateur) };
}

// Ingère un user provenant du serveur (lors du linking poste) : crée la fiche
// locale si absente, met à jour le hash sinon. Active la session si demandé.
// Le hash provient de /public/sync-credentials et permet les logins hors-ligne.
export async function ingestServerUser(
  serverUser: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    role: RoleAdmin;
    motDePasseHash: string;
    statut?: 'actif' | 'inactif' | 'archivé';
  },
  setSession = true,
): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  if (!serverUser?.id || !serverUser?.email || !serverUser?.motDePasseHash) {
    return { ok: false, error: 'Données serveur incomplètes' };
  }
  const admins = await getAllAdministrateurs();
  const existing = admins?.find(
    (a) => a.id === serverUser.id || a.email.toLowerCase() === serverUser.email.toLowerCase(),
  );
  const now = new Date().toISOString();
  let saved: Administrateur | null = null;
  if (existing) {
    if (existing.id !== serverUser.id) {
      // L'admin local a un ID différent du serveur (ex: créé en local puis
      // rattaché à un serveur). On migre vers l'ID serveur pour que les
      // références (createdBy, sync_state) restent cohérentes.
      const deleted = await deleteAdministrateur(existing.id);
      if (!deleted) return { ok: false, error: 'Échec migration ID admin' };
      saved = (await createAdministrateur({
        nom: serverUser.nom,
        prenom: serverUser.prenom,
        email: serverUser.email,
        telephone: serverUser.telephone,
        role: serverUser.role,
        motDePasseHash: serverUser.motDePasseHash,
        avatar: existing.avatar,
        statut: serverUser.statut ?? existing.statut,
        derniereConnexion: now,
      } as unknown as Omit<Administrateur, 'id' | 'createdAt' | 'updatedAt'>,
        { fromSync: true, id: serverUser.id },
      )) as Administrateur | null;
    } else {
      const updated = updateAdministrateur(existing.id, {
        nom: serverUser.nom,
        prenom: serverUser.prenom,
        email: serverUser.email,
        telephone: serverUser.telephone,
        role: serverUser.role,
        motDePasseHash: serverUser.motDePasseHash,
        statut: serverUser.statut ?? 'actif',
        derniereConnexion: now,
      } as Partial<Administrateur>);
      saved = updated ? ({ ...existing, ...updated } as Administrateur) : null;
    }
  } else {
    saved = (await createAdministrateur({
      nom: serverUser.nom,
      prenom: serverUser.prenom,
      email: serverUser.email,
      telephone: serverUser.telephone,
      role: serverUser.role,
      motDePasseHash: serverUser.motDePasseHash,
      avatar: undefined,
      statut: serverUser.statut ?? 'actif',
      derniereConnexion: now,
    } as unknown as Omit<Administrateur, 'id' | 'createdAt' | 'updatedAt'>,
      { fromSync: true, id: serverUser.id },
    )) as Administrateur | null;
  }
  if (!saved) return { ok: false, error: 'Échec persistance locale' };
  const safe = stripHash(saved);
  if (setSession) currentUser = safe;
  return { ok: true, user: safe };
}

export async function updateUserPassword(
  id: string,
  motDePasse: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasPermission('admins:manage')) {
    return { ok: false, error: 'Permission refusée' };
  }
  if (!motDePasse || motDePasse.length < 6) {
    return { ok: false, error: 'Mot de passe trop court (minimum 6 caractères)' };
  }
  const result = updateAdministrateur(id, {
    motDePasseHash: hashPassword(motDePasse),
  } as Partial<Administrateur>);
  if (!result) return { ok: false, error: 'Erreur lors de la mise à jour' };
  return { ok: true };
}
