// Rebuilds the DCAU (DC Animated Universe) catalog: the Bruce Timm shows and
// films in viewing order. None of these live in the main data files, so they
// are fetched once from TMDB and stored in Data/dcauData.js.
const path = require('path');
const { buildUniverse } = require('./universeBuilder');

const plan = [
  { title: 'Batman: The Animated Series', year: '1992', media: 'tv' },
  { title: 'Batman: Mask of the Phantasm', year: '1993', media: 'movie' },
  { title: 'Superman: The Animated Series', year: '1996', media: 'tv' },
  { title: 'The New Batman Adventures', year: '1997', media: 'tv' },
  { title: 'Batman & Mr. Freeze: SubZero', year: '1998', media: 'movie' },
  { title: 'Batman Beyond', year: '1999', media: 'tv' },
  { title: 'Batman Beyond: Return of the Joker', year: '2000', media: 'movie' },
  { title: 'Static Shock', year: '2000', media: 'tv' },
  { title: 'The Zeta Project', year: '2001', media: 'tv' },
  { title: 'Justice League', year: '2001', media: 'tv' },
  { title: 'Batman: Mystery of the Batwoman', year: '2003', media: 'movie' },
  { title: 'Justice League Unlimited', year: '2004', media: 'tv' },
];

buildUniverse({
  label: 'DCAU',
  outFile: path.join(__dirname, '../Data/dcauData.js'),
  plan,
});
