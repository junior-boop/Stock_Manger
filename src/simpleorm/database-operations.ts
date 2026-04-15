/**
 * Helper functions for handling database operations and their results
 */

export interface InsertResult {
  id: number;
  changes: number;
}

export async function handleInsertOperation(
  orm: any,
  tableName: string,
  data: Record<string, unknown>
): Promise<InsertResult> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");

  const query = `
    INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES (${placeholders})
  `;

  const result = await orm.run(query, values);

  if (!result.lastInsertRowid) {
    throw new Error("Impossible de récupérer l'ID de la dernière insertion");
  }

  return {
    id: result.lastInsertRowid,
    changes: result.changes,
  };
}

export async function handleUpdateOperation(
  orm: any,
  tableName: string,
  id: string | number,
  data: Record<string, unknown>
): Promise<number> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");

  const values = [...Object.values(data), id];

  const query = `
    UPDATE ${tableName}
    SET ${updates}
    WHERE id = ?
  `;

  const result = await orm.run(query, values);
  return result.changes;
}

export async function handleDeleteOperation(
  orm: any,
  tableName: string,
  id: string | number
): Promise<number> {
  const query = `
    DELETE FROM ${tableName}
    WHERE id = ?
  `;

  const result = await orm.run(query, [id]);
  return result.changes;
}
