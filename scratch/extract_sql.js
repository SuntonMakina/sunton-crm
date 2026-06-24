const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = '/Users/berkhan/.gemini/antigravity-ide/brain/4b3112ee-1d2f-4f06-8c27-0eacd45650bb/.system_generated/logs/transcript.jsonl';

async function extract() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching transcript for function definitions...');

  for await (const line of rl) {
    if (line.includes('handle_webhook_incoming_message') && (line.includes('CREATE OR REPLACE FUNCTION') || line.includes('function') || line.includes('sql') || line.includes('body'))) {
      // Find SQL contents in the JSON line
      try {
        const data = JSON.parse(line);
        // Print tool calls or content that might contain SQL
        if (data.tool_calls) {
          console.log('\n--- Found in Tool Calls ---');
          console.log(JSON.stringify(data.tool_calls, null, 2).substring(0, 2000));
        }
        if (data.content && data.content.includes('CREATE')) {
          console.log('\n--- Found in Content ---');
          console.log(data.content.substring(0, 2000));
        }
      } catch (e) {
        // Fallback simple print if not JSON or parsing fails
        console.log('\n--- Raw Match ---');
        console.log(line.substring(0, 1000));
      }
    }
  }
}

extract();
