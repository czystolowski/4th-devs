import { runAgent } from './src/agent.js';

async function main() {
  try {
    console.log('🚀 Starting firmware debugging agent...\n');
    
    const result = await runAgent();
    
    console.log('\n✅ Mission accomplished!');
    console.log('Result:', result);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();


