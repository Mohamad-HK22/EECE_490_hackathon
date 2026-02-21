const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function loadCSV(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      if (value === '' || value === 'nan' || value === 'NaN') return null;
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== '') return num;
      return value;
    },
  });
}

let _cache = {};

function getDataset(name) {
  if (_cache[name]) return _cache[name];
  _cache[name] = loadCSV(name);
  return _cache[name];
}

module.exports = { getDataset };
