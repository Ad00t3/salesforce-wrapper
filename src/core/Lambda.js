const AWS = require('aws-sdk');
const awsConfig = require('../config/aws.json');

const lambda = new AWS.Lambda(awsConfig.auth);

export function sendToSalesforceWrapperRouter(payload, errors) {
    lambda.invoke({
        FunctionName: 'arn:aws:lambda:us-east-2:263491656789:function:salesforceWrapperRouter',
        Payload: JSON.stringify(payload)
    }, (err, res) => {
        if (err || !(res.StatusCode >= 200 && res.StatusCode < 300)) { 
            errors.push(`lambda-invocation-failed:${res ? res.StatusCode : 'no-code'}`); 
            console.error(err); 
        }
        else console.log(res);
    });      
}