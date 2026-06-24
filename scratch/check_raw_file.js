const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'user_call_logs.json.raw');
let content = fs.readFileSync(filePath, 'utf-8');

// Let's print the end of the content
console.log('End of content:');
console.log(content.slice(-200));

// Let's try to parse it as JSON by cleaning it
// If it ends inside "unique_phone_records" array, let's close the array and the object
try {
  // Let's find the last complete unique phone record block
  const lastRecordIndex = content.lastIndexOf('},');
  if (lastRecordIndex !== -1) {
    const closedContent = content.slice(0, lastRecordIndex + 1) + '\n  ]\n}';
    const data = JSON.parse(closedContent);
    console.log('Cleaned and parsed successfully!');
    console.log('Unique records count in raw file:', data.unique_phone_records.length);
    fs.writeFileSync(path.join(__dirname, 'user_call_logs_cleaned.json'), JSON.stringify(data, null, 2), 'utf-8');
  } else {
    console.log('Could not find last record');
  }
} catch (e) {
  console.error('Parsing error:', e);
}
