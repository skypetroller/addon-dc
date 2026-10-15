// Rebuilds the DCAMU catalog: the 15-film DC Animated Movie Universe, in story
// order — Flashpoint Paradox through Justice League Dark: Apokolips War.
// All entries already live in animationsData.js (refreshed weekly).
const path = require('path');
const { buildUniverse } = require('./universeBuilder');

const plan = [
  { title: 'Justice League: The Flashpoint Paradox', year: '2013', media: 'movie' },
  { title: 'Justice League: War', year: '2014', media: 'movie' },
  { title: 'Son of Batman', year: '2014', media: 'movie' },
  { title: 'Justice League: Throne of Atlantis', year: '2015', media: 'movie' },
  { title: 'Batman vs. Robin', year: '2015', media: 'movie' },
  { title: 'Batman: Bad Blood', year: '2016', media: 'movie' },
  { title: 'Justice League vs. Teen Titans', year: '2016', media: 'movie' },
  { title: 'Justice League Dark', year: '2017', media: 'movie' },
  { title: 'Teen Titans: The Judas Contract', year: '2017', media: 'movie' },
  { title: 'Suicide Squad: Hell to Pay', year: '2018', media: 'movie' },
  { title: 'The Death of Superman', year: '2018', media: 'movie' },
  { title: 'Reign of the Supermen', year: '2019', media: 'movie' },
  { title: 'Batman: Hush', year: '2019', media: 'movie' },
  { title: 'Wonder Woman: Bloodlines', year: '2019', media: 'movie' },
  { title: 'Justice League Dark: Apokolips War', year: '2020', media: 'movie' },
];

buildUniverse({
  label: 'DCAMU',
  outFile: path.join(__dirname, '../Data/dcamuData.js'),
  plan,
});
