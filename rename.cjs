const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.mdx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(__dirname);
let changedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  // Exclude package.json and package-lock.json from aggressive renaming to prevent breaking deps
  if (file.endsWith('package.json') || file.endsWith('package-lock.json')) {
    continue;
  }
  
  // Replace visible names
  newContent = newContent.replace(/Dubbl/g, 'Pixel Marketing');
  newContent = newContent.replace(/dubbl/g, 'Pixel Marketing');
  
  // Fix any URLs that might have been broken (e.g. https://Pixel Marketing.dev -> https://dubbl.dev)
  newContent = newContent.replace(/https:\/\/Pixel Marketing\.dev/g, 'https://dubbl.dev');
  newContent = newContent.replace(/@Pixel Marketing\//g, '@dubbl/');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Replaced in ${changedCount} files.`);
