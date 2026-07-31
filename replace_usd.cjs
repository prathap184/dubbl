const fs = require('fs');
const path = require('path');

const directoriesToScan = ['app', 'lib', 'components'];

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace common fallback patterns
  content = content.replace(/\.default\("USD"\)/g, '.default("INR")');
  content = content.replace(/\?\? "USD"/g, '?? "INR"');
  content = content.replace(/\|\| "USD"/g, '|| "INR"');
  content = content.replace(/currencyCode: "USD"/g, 'currencyCode: "INR"');
  content = content.replace(/currency: "USD"/g, 'currency: "INR"');
  content = content.replace(/currency: 'USD'/g, "currency: 'INR'");
  content = content.replace(/currencyCode: 'USD'/g, "currencyCode: 'INR'");
  // Also fix the text descriptions in zod schemas
  content = content.replace(/defaults to USD/g, 'defaults to INR');
  content = content.replace(/default USD/g, 'default INR');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

for (const dir of directoriesToScan) {
  if (fs.existsSync(dir)) {
    scanDirectory(dir);
  }
}
console.log('Replacement script complete!');
