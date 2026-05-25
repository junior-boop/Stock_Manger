import crypto from 'node:crypto';
import {
  getAllAdministrateurs,
  createAdministrateur,
  updateAdministrateur,
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
  const created = createAdministrateur({
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
  'parametres:edit': ['super_admin', 'admin'],
  // Articles & collections
  'articles:write': ['super_admin', 'admin', 'gestionnaire'],
  'articles:delete': ['super_admin', 'admin'],
  'collections:write': ['super_admin', 'admin', 'gestionnaire'],
  'collections:delete': ['super_admin', 'admin'],
  // Clients
  'clients:write': ['super_admin', 'admin', 'gestionnaire', 'vendeur'],
  'clients:delete': ['super_admin', 'admin'],
  // Devis
  'devis:create': ['super_admin', 'admin', 'gestionnaire', 'vendeur'],
  'devis:modify': ['super_admin', 'admin'],
  'devis:delete': ['super_admin', 'admin'],
  // Factures
  'factures:create': ['super_admin', 'admin', 'gestionnaire'],
  'factures:modify': ['super_admin', 'admin'],
  'factures:delete': ['super_admin', 'admin'],
  // Paiements
  'paiements:write': ['super_admin', 'admin', 'gestionnaire'],
  // Journal d'audit
  'journal:read': ['super_admin', 'admin'],
  // Demandes de modification
  'demandes:create': ['gestionnaire', 'vendeur'],
  'demandes:validate': ['super_admin', 'admin'],
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
