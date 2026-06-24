const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'whatsapp-session');

function run() {
  console.log('Cleaning up Baileys sync state to force a history resync...');
  if (!fs.existsSync(SESSION_DIR)) {
    console.log('Session directory not found.');
    return;
  }

  const files = fs.readdirSync(SESSION_DIR);
  let deletedCount = 0;

  for (const file of files) {
    // We only delete app-state keys and versions to clear sync state
    const shouldDelete = file.startsWith('app-state-sync-key-') || 
                         file.startsWith('app-state-sync-version-') ||
                         file.startsWith('pre-key-') ||
                         file.startsWith('session-');

    if (shouldDelete) {
      const filePath = path.join(SESSION_DIR, file);
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (err) {
        console.error(`Error deleting file ${file}:`, err.message);
      }
    }
  }

  console.log(`Successfully deleted ${deletedCount} sync state files.`);
  console.log('Gateway is ready to reconnect and request history sync.');
}

run();
