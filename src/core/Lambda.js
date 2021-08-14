const AWS = require('aws-sdk');
const awsConfig = require('../config/aws.json');

const lambda = new AWS.Lambda(awsConfig.auth);

export function sendToSalesforceWrapperRouter(payload, errors) {
    lambda.invoke({
        FunctionName: 'arn:aws:lambda:us-east-2:263491656789:function:salesforceWrapperRouter',
        Payload: JSON.stringify(payload)
    }, (err, res) => {
        if (err) { 
            errors.push(`lambda-invocation-failed`); 
            console.error(err); 
        }
        if (res) {
            if (res.StatusCode !== 201)
                errors.push(`bad-lambda-res:${res.StatusCode}:${res.Payload}`);
            console.log(res);
        }
    });      
}