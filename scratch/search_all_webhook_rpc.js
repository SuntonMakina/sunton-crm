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

  let matchCount = 0;
  for await (const line of rl) {
    if (line.includes('handle_webhook_incoming_message') && line.includes('CREATE OR REPLACE FUNCTION')) {
      try {
        const data = JSON.parse(line);
        let content = data.content || '';
        if (data.tool_calls) {
          content += JSON.stringify(data.tool_calls);
        }
        
        const startIdx = content.indexOf('CREATE OR REPLACE FUNCTION public.handle_webhook_incoming_message');
        if (startIdx !== -1) {
          matchCount++;
          console.log(`\n=== MATCH #${matchCount} (Length: ${content.length}) ===`);
          console.log(content.substring(startIdx, startIdx + 4000));
        }
      } catch (e) {}
    }
  }
}

extract();
