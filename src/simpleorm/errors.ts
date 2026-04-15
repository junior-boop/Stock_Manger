export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public query?: string,
    public params?: any[]
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    public operation?: string,
    public data?: any
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Codes d'erreur standardisés
export const ErrorCodes = {
  // Erreurs de base de données
  INVALID_QUERY: "INVALID_QUERY",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",
  TABLE_NOT_FOUND: "TABLE_NOT_FOUND",
  COLUMN_NOT_FOUND: "COLUMN_NOT_FOUND",
  DUPLICATE_KEY: "DUPLICATE_KEY",

  // Erreurs de synchronisation
  SYNC_CONFLICT: "SYNC_CONFLICT",
  NETWORK_ERROR: "NETWORK_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  OPERATION_FAILED: "OPERATION_FAILED",

  // Erreurs de validation
  INVALID_TYPE: "INVALID_TYPE",
  REQUIRED_FIELD: "REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE",
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
