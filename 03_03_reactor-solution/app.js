import { runAgent } from './src/agent.js';

async function main() {
  try {
    const result = await runAgent();
    console.log('✅ Mission accomplished!');
    console.log('Final state:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
