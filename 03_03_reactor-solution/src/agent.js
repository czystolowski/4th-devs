import { sendCommand } from './helpers/api.js';
import { decideCommand, renderBoard } from './reactor.js';

const GOAL_COL = 7;
const MAX_STEPS = 200;

/**
 * Run the reactor navigation agent.
 * Sends 'start', then loops: inspect state → decide → act, until goal reached.
 */
export async function runAgent() {
  console.log('🤖 Starting reactor navigation agent...\n');

  // Always start fresh
  let state = await sendCommand('start');
  console.log('Board after START:\n' + renderBoard(state) + '\n');

  if (state.code && state.code < 0) {
    throw new Error('Start failed: ' + state.message);
  }

  let steps = 0;

  while (steps < MAX_STEPS) {
    // Check if goal already reached
    if (state.reached_goal) {
      console.log('🎉 Goal reached!');
      return state;
    }

    // Also check by player position
    if (state.player?.col === GOAL_COL) {
      console.log('🎉 Player is at goal column!');
      return state;
    }

    const command = decideCommand(state);
    steps++;

    process.stdout.write(`Step ${steps}: col ${state.player.col} → ${command.toUpperCase()} ... `);

    state = await sendCommand(command);

    if (!state.board) {
      // Check if it's actually a success flag (goal reached with a flag message)
      if (state.message && state.message.startsWith('{FLG:')) {
        console.log('\n🎉 Goal reached! Flag:', state.message, '\n');
        return state;
      }
      // Error response (e.g. crushed)
      console.log('FAIL:', state.message);
      throw new Error('Robot failed: ' + state.message);
    }

    console.log(`col ${state.player.col}  reached_goal=${state.reached_goal}`);

    if (state.reached_goal) {
      console.log('\n🎉 Goal reached in', steps, 'steps!\n');
      return state;
    }
  }

  throw new Error('Exceeded max steps (' + MAX_STEPS + ') without reaching goal.');
}
