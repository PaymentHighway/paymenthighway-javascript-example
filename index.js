var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var os = require('os');
var exphbs = require('express3-handlebars');
var _ = require('lodash');
var paymentHighway = require('paymenthighway');
var FormBuilder = paymentHighway.FormBuilder;
var PaymentAPI = paymentHighway.PaymentAPI;
var SecureSigner = paymentHighway.SecureSigner;

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

var testKey = 'testKey';
var testSecret = 'testSecret';

var formBuilder = new FormBuilder('POST', testKey, testSecret, 'test', 'test_merchantId', 'http://localhost:9000');
var paymentAPI = new PaymentAPI('http://localhost:9000', testKey, testSecret, 'test', 'test_merchantId');
var secureSigner = new SecureSigner(testKey, testSecret);

var baseUri = "http://localhost:3000";
var language = "EN";

app.get('/', function (req, res) {
  res.render('index');
});

app.get('/add_card', function (req, res) {
  var successUri = baseUri + "/add_card/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";
  var formContainer = formBuilder.generateAddCardParameters(successUri, failureUri, cancelUri, language);
  var data = {
    action: formContainer.getAction(),
    method: formContainer.method,
    inputs: formContainer.nameValuePairs
  };
  res.render('form', data);
});
app.get('/add_card/success', function (req, res) {
  var validRedirect = validateRedirect(req.query);
  var tokenizationId = req.query['sph-tokenization-id'];

  paymentAPI.tokenization(tokenizationId)
    .then(function (result) {
      var status;
      if (result.result.code == 100) {
        status = "Successful tokenization";
      }
      else {
        status = "Tokenization failed"
      }

      var data = {
        validRedirect: validRedirect,
        message: result.result.message,
        card: _.transform(result.card, function (result, value, key) {
          result.push({name: key, value: value});
          return result;
        }, []),
        cardToken: result.card_token,
        status: status,
        resultCode: result.result.code
      };

      res.render("add_card_success", data);
    })
    .catch(function (err) {
      res.send(err.message);
    });
});


app.get('/pay_with_token', function (req, res) {
  var token = new paymentHighway.Token(req.query.token);
  var request = new paymentHighway.TransactionRequest(token, 1990, "EUR");
  paymentAPI.initTransaction()
    .then(function (init) {
      return paymentAPI.debitTransaction(init.id, request);
    })
    .then(function (result) {
      var status;
      if (result.result.code == 100) {
        status = "Successful payment with token";
      }
      else {
        status = "Payment with failed"
      }
      var data = {
        message: result.result.message,
        status: status,
        resultCode: result.result.code
      };

      res.render("pay_with_token_success", data);
    })
    .catch(function (err) {
      res.send(err.message);
    });
});


app.get('/pay_with_card', function (req, res) {
  var successUri = baseUri + "/pay_with_card/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";
  var description = "10 balloons, 19,50€";
  var currency = "EUR";
  var orderId = "1000123A";

  var formContainer = formBuilder.generatePaymentParameters(successUri, failureUri, cancelUri, language, 1950, currency,
    orderId, description, undefined, undefined, undefined, undefined, '#aabbcc', undefined,
    'https://preview.paymenthighway.fi/dev/images/ph-logo-250x250.png');
  var data = {
    action: formContainer.getAction(),
    method: formContainer.method,
    inputs: formContainer.nameValuePairs
  };
  res.render('form', data);
});
app.get('/pay_with_card/success', function (req, res) {
  var validRedirect = validateRedirect(req.query);
  var request = new paymentHighway.CommitTransactionRequest(1950, "EUR");
  var transactionId = req.query['sph-transaction-id'];

  paymentAPI.commitTransaction(transactionId, request)
    .then(function (result) {
      var status;
      if (result.result.code == 100) {
        status = "Successful commit";
      }
      else {
        status = "Commit failed"
      }
      var data = {
        validRedirect: validRedirect,
        message: result.result.message,
        card: _.transform(result.card, function (result, value, key) {
          result.push({name: key, value: value});
          return result;
        }, []),
        status: status,
        resultCode: result.result.code
      };

      res.render("pay_with_card_success", data);
    })
    .catch(function (err) {
      res.send(err.message);
    });
});

app.get('/pay_with_mobilepay', function (req, res) {
  var successUri = baseUri + "/pay_with_card/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";
  var description = "10 balloons, 19,50€";
  var currency = "EUR";
  var orderId = "1000123A";

  var formContainer = formBuilder.generatePayWithMobilePayParameters(successUri, failureUri, cancelUri, language, 1950,
    currency, orderId, description, undefined, 'https://preview.paymenthighway.fi/dev/images/ph-logo-250x250.png',
    undefined, 'Jaskan kenkä asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf as f gu');
  var data = {
    action: formContainer.getAction(),
    method: formContainer.method,
    inputs: formContainer.nameValuePairs
  };
  res.render('form', data);
});

app.get('/add_and_pay_with_card', function (req, res) {
  var successUri = baseUri + "/add_and_pay_with_card/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";

  var amount = 1990;
  var currency = "EUR";
  var orderId = "1000123A";
  var description = "A Box of Dreams. 19,90€";

  var formContainer = formBuilder.generateAddCardAndPaymentParameters(successUri, failureUri, cancelUri, language, amount, currency, orderId, description);
  var data = {
    action: formContainer.getAction(),
    method: formContainer.method,
    inputs: formContainer.nameValuePairs
  };
  res.render('form', data);
});

app.get('/masterpass', function(req, res) {
  var successUri = baseUri + "/pay_with_card/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";
  var amount = 1990;
  var currency = "EUR";
  var orderId = "masterpass123";
  var description = "A Box of Dreams. 19,90€";

  var formContainer = formBuilder.generateMasterPassParameters(successUri, failureUri, cancelUri, language, amount, currency, orderId, description)
  var data = {
    action: formContainer.getAction(),
    method: formContainer.method,
    inputs: formContainer.nameValuePairs
  };
  res.render('form', data);
});

app.get('/add_and_pay_with_card/success', function (req, res) {
  var validRedirect = validateRedirect(req.query);
  var request = new paymentHighway.CommitTransactionRequest(1950, "EUR");
  var transactionId = req.query['sph-transaction-id'];

  paymentAPI.commitTransaction(transactionId, request)
    .then(function (result) {
      var status;
      if (result.result.code == 100) {
        status = "Successful commit";
      }
      else {
        status = "Commit failed"
      }
      var data = {
        validRedirect: validRedirect,
        message: result.result.message,
        card: _.transform(result.card, function (result, value, key) {
          result.push({name: key, value: value});
          return result;
        }, []),
        cardToken: result.card_token,
        status: status,
        resultCode: result.result.code
      };

      res.render("add_and_pay_with_card_success", data);
    })
    .catch(function (err) {
      res.send(err.message);
    });
});


app.get('/failure', function (req, res) {
  res.render('failure', {message: req.query['sph-failure']});
});
app.get('/cancel', function (req, res) {
  var data = {
    parameters: _.transform(req.query, function (result, value, key) {
      result.push({name: key, value: value});
      return result;
    }, [])
  };
  res.render('cancel', data);
});

app.get('/foo', function (req, res) {
  var a = {
    "sph-amount": "199500",
    "signature": "SPH1 testKey a0297d624d6e2d4ec89828269badeab43d60d1ace17ae5e2f40d0fcc76be523a",
    "sph-account": "test",
    "sph-currency": "EUR",
    "sph-merchant": "test_merchantId",
    "sph-transaction-id": "544cb35f-a0d7-4cb7-98c0-c735048a9c8d",
    "sph-order": "101",
    "sph-timestamp": "2016-11-18T07:59:15Z",
    "sph-request-id": "27224bae-92b4-42b8-98b5-4c0193a4fe60",
    "sph-success": "OK"
  };
  var b = {
    'sph-api-version': '20151028',
    'sph-account': 'test',
    'sph-merchant': 'test_merchantId',
    'sph-timestamp': '2016-11-30T09:31:16Z',
    'sph-cancel-url': 'https://solinor.fi',
    'sph-failure-url': 'http://www.solinor.com',
    'sph-success-url': 'https://www.paymenthighway.fi/',
    'sph-request-id': '78c32913-1ceb-41e0-bb66-a5b73438796b',
    'language': 'EN',
    'sph-token': '71435029-fbb6-4506-aa86-8529efb640b0',
    'sph-skip-form-notifications': 'false',
    'sph-exit-iframe-on-three-d-secure': 'false',
    'sph-use-three-d-secure': 'false',
    'signature': 'SPH1 testKey 336c729ec15f3fc9fc236f8e90988367e10c5c554107edd0212cb71cf776390d'

  };
//  SPH1 testKey 5ebd6c058ded0e201f2c01dfde2423c257798573414644c17e5cb1f0458398ce'

  var uri = '/form/view/pay_with_token_and_cvc';

  var kvs =[
  {first: "sph-api-version", second: "20151028"},
  {first: "sph-account", second: "test"},
  {first: "sph-merchant", second: "test_merchantId"},
  {first: "sph-timestamp", second: "2016-11-30T13:20:32Z"},
  {first: "sph-cancel-url", second: "https://solinor.fi"},
  {first: "sph-failure-url", second: "http://www.solinor.com"},
  {first: "sph-success-url", second: "https://www.paymenthighway.fi/"},
  {first: "sph-request-id", second: "454be628-8ba2-4a47-b1ca-a340aaa90e3d"},
  {first: "language", second: "EN"},
  {first: "sph-token", second: "71435029-fbb6-4506-aa86-8529efb640b0"},
  {first: "sph-skip-form-notifications", second: "false"},
  {first: "sph-exit-iframe-on-three-d-secure", second: "false"},
  {first: "sph-use-three-d-secure", second: "false"}
  ]

  var asd = ""
  var foo = secureSigner.createSignature('POST', uri, kvs, "")
  var qwerty = "POST\n/form/view/add_card\nsph-account:test\nsph-api-version:20151028\nsph-cancel-url:https://solinor.fi\nsph-failure-url:https://paymenthighway.fi/index-en.html\nsph-merchant:test_merchantId\nsph-request-id:3a6aa052-00ca-431a-8486-bd063e462bb4\nsph-success-url:https://www.paymenthighway.fi/\nsph-timestamp:2016-11-30T12:59:57Z"
  // var foo = validateRedirect(b);
  res.render('foo', {message: foo});
});


app.listen(app.get('port'), function () {
  console.log('listening on *:' + app.get('port'));
});

function validateRedirect(requestParams) {
  return secureSigner.validateFormRedirect(requestParams);
}