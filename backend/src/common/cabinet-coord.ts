/**
 * Formate une position de cellule de cabinet.
 *   column 1 -> 'A', 2 -> 'B', ...
 *   row     1 -> '1', 2 -> '2', ...
 * Retourne par exemple "A1", "C7".
 */
export function formatCellCoord(row: number, column: number): string {
  if (!column || !row) return '';
  const col = column > 0 && column <= 26
    ? String.fromCharCode('A'.charCodeAt(0) + (column - 1))
    : `C${column}`;
  return `${col}${row}`;
}
