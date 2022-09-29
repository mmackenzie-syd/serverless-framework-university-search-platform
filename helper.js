const algoliasearch = require('algoliasearch');
const algoliaClient = algoliasearch("Your app id here", "secret here");
const algoliaIndex = algoliaClient.initIndex('universities');
const _ = require('lodash');

algoliaIndex.setSettings({
  searchableAttributes: [
    'objectID'
  ],
  attributesForFaceting: [
    'menu.graduate',
    'menu.undergraduate',
    'filterOnly(course.name)',
    'filterOnly(course.level)',
    'filterOnly(course.minimumGreScore)',
    'filterOnly(course.minimumSatScore)',
    'filterOnly(course.tuitionRatePerCredit)'
  ],
  'maxValuesPerFacet': 1000
});

exports.addToAlgolia = data => {
  return algoliaIndex.addObject(data);
};

exports.getMenu = category => {

  facet = (category === 'graduate') ? 'menu.graduate' : 'menu.undergraduate';

  return algoliaIndex.search('', {
    facets: facet,
    maxValuesPerFacet: 1000
  })
    .then(content => {
      const facetResults = content.facets[facet];
      const keys = _.keys(facetResults);
      return keys;
    });

};

exports.searchById = id  => {

  return algoliaIndex.search(id)
    .then(content => {
      return content.hits[0];
    });
};

exports.searchByFilters = params => {

  // bare minimum required
  const name = params.name;
  const level = params.level;
  let filter = `course.level: '${level}' AND course.name: '${name}'`;

  const gre = params.gre;
  const sat = params.sat;
  const tuition = params.tuition;

  if (gre) {
    filter += ` AND course.minimumGreScore < ${gre}`;
  }
  if (sat) {
    filter += ` AND course.minimumSatScore < ${sat}`;
  }
  if (tuition) {
    filter += ` AND course.tuitionRatePerCredit < ${tuition}`;
  }

  console.log('Filter string: ' + filter);

  return algoliaIndex.search({
    hitsPerPage: 100,
    filters: filter,
    attributesToHighlight: []
  })
    .then(results => {
      return results.hits
    });

};

