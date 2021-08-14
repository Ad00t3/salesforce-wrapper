import config from '../config/config';

const AWS = require('aws-sdk');
const awsConfig = require('../config/aws.json');

const lambda = new AWS.Lambda(awsConfig.auth);
const ssm = new AWS.SSM(awsConfig.auth);

export async function sendToSalesforceWrapperRouter(payload, errors) {
    return new Promise((resolve, reject) => {
        lambda.invoke({
            FunctionName: 'arn:aws:lambda:us-east-2:263491656789:function:salesforceWrapperRouter',
            Payload: JSON.stringify(payload)
        }, (err, res) => {
            if (err) { 
                errors.push('lambda-invocation-error'); 
                console.error(err); 
            }
            if (res && res.Payload) {
                try {
                    const payload = JSON.parse(res.Payload);
                    if (payload.statusCode !== 201)
                        errors.push(`bad-lambda-res:${payload.statusCode}:${payload.body}`);
                    console.log(res);
                } catch (e) {
                    errors.push('lambda-invocation-failed');
                    console.error(e);
                }
            }
            resolve();
        });      
    });
}

export async function getConfigFromParamStore(errors) {
    return new Promise((resolve, reject) => {
        ssm.getParameter({
            Name: 'salesforceWrapperConfig',
            WithDecryption: false
        }, (err, data) => {
            if (err) { 
                errors.push('config-retrieval-error'); 
                console.error(err); 
            }
            const param = data.Parameter;
            if (param && param.Value) {
                try {
                    const obj = JSON.parse(param.Value);
                    config.set('rec', obj.rec);
                    console.log(param);
                } catch (e) {
                    errors.push('config-retrieval-failed');
                    console.error(e);
                }
            }
            resolve();
        });
    });
}