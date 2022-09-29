* Copied from Shreya Vakil udemy course, code along serverless

In order to run the project follow the following steps:

1. clone the project
2. open the serverless.yml file
    a. Under the provider section enter the role:arn . Enter that this user has permissions to write to Kinesis streams
    b. For pushToAlgolia function, under the stream arn, enter an arn for a kinesis stream

3. Open helper.js
   a. Enter algolia app-id and secret on line 2
