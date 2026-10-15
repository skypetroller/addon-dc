// Rebuilds the Arrowverse catalog: the CW multiverse shows in premiere order.
// Entries come from seriesData where possible (refreshed weekly); anything
// missing is fetched once from TMDB and then reused.
const path = require('path');
const { buildUniverse } = require('./universeBuilder');

const plan = [
  { title: 'Arrow', year: '2012', media: 'tv' },
  { title: 'The Flash', year: '2014', media: 'tv' },
  { title: 'Constantine', year: '2014', media: 'tv' },
  { title: 'Supergirl', year: '2015', media: 'tv' },
  { title: "DC's Legends of Tomorrow", year: '2016', media: 'tv' },
  { title: 'Black Lightning', year: '2018', media: 'tv' },
  { title: 'Batwoman', year: '2019', media: 'tv' },
  { title: 'Superman & Lois', year: '2021', media: 'tv' },
];

buildUniverse({
  label: 'Arrowverse',
  outFile: path.join(__dirname, '../Data/arrowverseData.js'),
  plan,
});
