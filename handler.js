const AWS = require('aws-sdk');
const eachOf = require('async/eachOf');
const kinesisClient = new AWS.Kinesis({
  'region' : 'us-east-1'
});
const _ = require('lodash');

/* Consumer */
const helper = require('./helper');

const generateId = (zip, courseLevel, courseName) => {

  const newCourseName = courseName.replace(/ /g,'');
  const id =  `${zip}-${courseLevel}-${newCourseName}`;
  return id;
};

const prepareRecord = data => {

  //show the problem of duplication before writing this
  data.objectID = generateId(data.address.zip, data.course.level, data.course.name);

  //phase 2
  data.menu = {};

  if (data.course.level === 'graduate') {
   data.menu['graduate'] = data.course.name;
  }
  else if (data.course.level === 'undergraduate'){
    data.menu['undergraduate'] = data.course.name;
  }

  //phase 3
  data.browseByCity = {
    [data.address.state] : data.address.city
  };

};

const addPartitionKey = record => {

  return {
    'PartitionKey' : record.course.level,
    'Data' : JSON.stringify(record) //new Buffer('...') || 'STRING_VALUE', /* required */
  };

};

module.exports.pushToKinesis = (event, context, callback) => {

  //Step1 : fetch data from third-party api
  const universityList =  require('./university-data.json');

  //Step2: prepare data. Kinesis streams require data in certain format
  const records = [];
  universityList.forEach(university => {

    let sansCourses = _.omit(university, ['courses']);

    _.forEach(university.courses, course => {
      let record = JSON.parse(JSON.stringify(sansCourses));
      record.course = course;
      prepareRecord(record);
      records.push(record);
    });
  });

  const dataToTransmit = _.map(records, addPartitionKey);

  //Step3: Transmit to kinesis stream
  const params = {
    Records: dataToTransmit,
    StreamName: 'university-buffer',
  };

  kinesisClient.putRecords(params, function(err, data) {
    if (err) {
      console.log(err, err.stack); // an error occurred
      callback(err, null);
    }
    else     {
      console.log(data);
      callback(null, data);
    }
  });

};

module.exports.pushToAlgolia = (event, context, callback) => {

  const list = event.Records;

  const iteratee = (record, cb) => {

    // Kinesis data is base64 encoded so decode here
    let retrievedRecord = new Buffer(record.kinesis.data, 'base64').toString();
    let universityInfo = JSON.parse(retrievedRecord);
    console.log('Pushing to algolia: ' + universityInfo.name + universityInfo.course.name);

    helper.addToAlgolia(universityInfo)
      .then(()=> {
        cb();
      })
      .catch(err=> {
        cb(err);
      });
  };

  eachOf(list, iteratee, function(err) {
    if (err) callback(err);

    callback(null, "Number of records pushed to algolia : " + list.length);
  });

};

//menu?category=graduate
module.exports.getMenu = (event, content, callback) => {
  console.log(event); // Contains incoming request data (e.g., query params, headers and more)

  if (!event.queryStringParameters.category) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({ "error": "Invalid request" })
    };
    callback(null, response);
  }
  else {

    helper.getMenu(event.queryStringParameters.category)
      .then(menu => {

        const response = {
          statusCode: 200,
          headers: {
            "Cache-Control": "max-age=86400" //24 hrs
          },
          body: JSON.stringify(menu)
        };
        callback(null, response);

      })
      .catch(err => {
        const response = {
          statusCode: 400,
          body: JSON.stringify(err)
        };

        callback(null, response);
      });
  }

};

//universities/:id
module.exports.getUniversity = (event, content, callback) => {
  const id = event.pathParameters.id;

  if (id) {
    helper.searchById(id)
      .then(results => {

        const response = {
          statusCode: 200,
          body: JSON.stringify(results)
        };

        callback(null, response);

      })
      .catch(err => {
        const response = {
          statusCode: 500,
          body: JSON.stringify(err)
        };
        callback(null, response);
      });
  }
  else {

    const response = {
      statusCode: 400,
      body: JSON.stringify({ "error": "Univeristy id not passed" })
    };
    callback(null, response);

  }

};

//universities?level=graduate&name=computer science&greScore=200  //i.e less than
module.exports.searchUniversities = (event, content, callback) => {

  console.log(event.queryStringParameters); // Contains incoming request data (e.g., query params, headers and more)
  const queryParams = event.queryStringParameters;

  if (queryParams) {
    helper.searchByFilters(queryParams)
      .then(result => {

        const response = {
          statusCode: 200,
          body: JSON.stringify(result)
        };

        callback(null, response);
      })
      .catch(err => {

        const response = {
          statusCode: 500,
          body: JSON.stringify(err)
        };
        callback(null, response);
      });

  }
  else {

    const response = {
      statusCode: 400,
      body: JSON.stringify({ "error": "Invalid request" })
    };
    callback(null, response);

  }

};
