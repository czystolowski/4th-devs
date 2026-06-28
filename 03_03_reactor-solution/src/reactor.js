/**
 * Reactor board logic — pure simulation helpers.
 *
 * Coordinate system (1-based, as returned by the API):
 *   rows 1..5 top-to-bottom, cols 1..7 left-to-right
 *   Player always stays on row 5.
 *   Goal is col 7, row 5.
 *
 * Each command (right / left / wait) advances every block by one step:
 *   - direction "down" → top_row++, bottom_row++
 *     If bottom_row reaches 5, direction flips to "up"
 *   - direction "up"   → top_row--, bottom_row--
 *     If top_row reaches 1, direction flips to "down"
 */

const ROWS = 5;

/**
 * Advance one block by a single step and return the updated block.
 */
export function stepBlock(block) {
  let { col, top_row, bottom_row, direction } = block;

  if (direction === 'down') {
    top_row++;
    bottom_row++;
    // If bottom reached lowest, reverse
    if (bottom_row >= ROWS) {
      bottom_row = ROWS;
      top_row = ROWS - 1;
      direction = 'up';
    }
  } else {
    top_row--;
    bottom_row--;
    // If top reached highest, reverse
    if (top_row <= 1) {
      top_row = 1;
      bottom_row = 2;
      direction = 'down';
    }
  }

  return { col, top_row, bottom_row, direction };
}

/**
 * Advance all blocks by one step.
 */
export function stepAllBlocks(blocks) {
  return blocks.map(stepBlock);
}

/**
 * Check whether the given column is occupied by any block on row 5
 * (i.e. dangerous for the player who always lives on row 5).
 */
export function isColDangerousOnRow5(blocks, col) {
  return blocks.some((b) => b.col === col && b.bottom_row === ROWS);
}

/**
 * Decide the next command given the current state.
 *
 * Strategy (from the task description):
 *  1. Simulate one step forward (blocks advance by 1) for target col = playerCol + 1
 *  2. If the target column is safe after the step → move right
 *  3. Else if waiting is safe (current col safe after step) → wait
 *  4. Else → move left (escape)
 *
 * Returns one of: 'right' | 'wait' | 'left'
 */
export function decideCommand(state) {
  const { player, blocks } = state;
  const playerCol = player.col;

  // Simulate what blocks look like after one step (any command advances them)
  const nextBlocks = stepAllBlocks(blocks);

  const targetCol = playerCol + 1;

  // Is the column we'd move into safe after blocks advance?
  const canMoveRight = !isColDangerousOnRow5(nextBlocks, targetCol);

  if (canMoveRight) {
    return 'right';
  }

  // Can we safely stay in place?
  const canWait = !isColDangerousOnRow5(nextBlocks, playerCol);

  if (canWait) {
    return 'wait';
  }

  // Current position also becoming dangerous → escape left
  return 'left';
}

/**
 * Render the board state as a compact ASCII string for logging.
 */
export function renderBoard(state) {
  if (!state.board) return JSON.stringify(state);
  const rows = state.board.map((row, i) => `${i + 1}: ${row.join(' ')}`);
  const blockInfo = state.blocks
    .map((b) => `col${b.col}[${b.top_row}-${b.bottom_row}]${b.direction[0]}`)
    .join(' ');
  return [...rows, `   Player col${state.player.col}  ${blockInfo}`].join('\n');
}
