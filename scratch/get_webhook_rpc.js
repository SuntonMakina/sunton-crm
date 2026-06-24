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

  for await (const line of rl) {
    if (line.includes('CREATE OR REPLACE FUNCTION public.handle_webhook_incoming_message')) {
      try {
        const data = JSON.parse(line);
        if (data.content) {
          const startIdx = data.content.indexOf('CREATE OR REPLACE FUNCTION public.handle_webhook_incoming_message');
          if (startIdx !== -1) {
            console.log(data.content.substring(startIdx, startIdx + 3000));
            return;
          }
        }
      } catch (e) {}
    }
  }
}

extract();
