// Rebuilds the Elseworlds catalog: DC films and shows that sit outside the
// shared DCU/DCEU continuity (Joker-verse, Reeves-verse, animated side stories).
// Run after the fetch* scripts (see .github/workflows).
const path = require('path');
const { buildUniverse } = require('./universeBuilder');

const plan = [
  { title: 'Joker', year: '2019', media: 'movie' },
  { title: 'The Batman', year: '2022', media: 'movie' },
  { title: 'The Penguin', year: '2024', media: 'tv' },
  { title: 'Joker: Folie à Deux', year: '2024', media: 'movie' },
  { title: 'The Batman: Part II', year: '2028', media: 'movie' },
  { title: 'Dynamic Duo', year: '2028', media: 'movie' },
];

buildUniverse({
  label: 'Elseworlds',
  outFile: path.join(__dirname, '../Data/elseworldsData.js'),
  plan,
});
