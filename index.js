var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var os = require('os');
var exphbs = require('express3-handlebars');
var _ = require('lodash');
var paymentHighway = require('paymenthighway-javascript-lib');
var FormBuilder = paymentHighway.FormBuilder;
var PaymentAPI = paymentHighway.PaymentAPI;
var SecureSigner = paymentHighway.SecureSigner;

console.log(FormBuilder);
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

var testKey = 'testKey';
var testSecret = 'testSecret';

var formBuilder = new FormBuilder('POST', testKey, testSecret, 'test', 'test_merchantId', 'https://v1-hub-staging.sph-test-solinor.com');
var paymentAPI = new PaymentAPI('https://v1-hub-staging.sph-test-solinor.com/', testKey, testSecret, 'test', 'test_merchantId');
var secureSigner = new SecureSigner(testKey, testSecret);

var baseUri = "http://localhost:3000";
var language = "EN";

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/add_card', function (req, res) {
    var successUri = baseUri + "/add_card/success";
    var failureUri = baseUri + "/add_card/failure";
    var cancelUri = baseUri + "/add_card/cancel";
    var formContainer = formBuilder.generateAddCardParameters(successUri, failureUri, cancelUri, language);
    var data = {
        action: formContainer.getAction(),
        method: formContainer.method,
        inputs: formContainer.nameValuePairs
    };
    res.render('form', data);
});
app.get('/add_card/success', function(req, res) {
    var validRedirect = validateRedirect(req.query);
    var tokenizationId = req.query['sph-tokenization-id'];
    console.log(tokenizationId);
    paymentAPI.tokenize(tokenizationId)
        .then(function (result) {
            var status;
            if(result.result.code == 100){
                status = "Successful tokenization";
            }
            else {
                status = "Tokenization failed"
            }
            console.log(result);
            var data = {
                validRedirect: validRedirect,
                message: result.result.message,
                card: _.transform(result.card, function(result, value, key) {
                    result.push({name: key, value: value});
                    return result;
                }, []),
                status: status,
                resultCode: result.result.code
            };

            console.log(result);

            res.render("pay_with_card_success", data);
        })
        .catch(function(err){
            res.send(err.message);
        });
});

app.get('/pay_with_card', function (req, res) {
    var successUri = baseUri + "/pay_with_card/success";
    var failureUri = baseUri + "/pay_with_card/failure";
    var cancelUri = baseUri + "/pay_with_card/cancel";
    var description = "10 balloons, 19,50€";
    var currency = "EUR";
    var orderId = "1000123A";

    var formContainer = formBuilder.generatePaymentParameters(successUri, failureUri, cancelUri, language, 1950, currency, orderId, description);
    var data = {
        action: formContainer.getAction(),
        method: formContainer.method,
        inputs: formContainer.nameValuePairs
    };
    res.render('form', data);
});
app.get('/pay_with_card/success', function(req, res) {
    var validRedirect = validateRedirect(req.query);
    var request = new paymentHighway.CommitTransactionRequest(1950, "EUR");
    var transactionId = req.query['sph-transaction-id'];
    console.log(transactionId);
    paymentAPI.commitTransaction(transactionId, request)
        .then(function (result) {
            var status;
            if(result.result.code == 100){
                status = "Successful commit";
            }
            else {
                status = "Commit failed"
            }
            var data = {
                validRedirect: validRedirect,
                message: result.result.message,
                card: _.transform(result.card, function(result, value, key) {
                        result.push({name: key, value: value});
                        return result;
                    }, []),
                status: status,
                resultCode: result.result.code
            };

            console.log(result);

            res.render("pay_with_card_success", data);
        })
        .catch(function(err){
            res.send(err.message);
        });
});
app.get('/pay_with_card/failure', function(req, res) {
    res.render('failure', {message: req.query['sph-failure']});
});
app.get('/pay_with_card/cancel', function(req, res) {
    var data = {
        parameters: _.transform(req.query, function (result, value, key) {
            result.push({name: key, value: value});
            return result;
        }, [])
    };
    res.render('cancel', data);
});


app.listen(app.get('port'), function () {
    console.log('listening on *:' + app.get('port'));
});

function validateRedirect(requestParams) {
    return secureSigner.validateFormRedirect(requestParams);
}