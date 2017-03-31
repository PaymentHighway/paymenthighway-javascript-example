var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var os = require('os');
var exphbs = require('express-handlebars');
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

var formBuilder = new FormBuilder('POST', testKey, testSecret, 'test', 'test_merchantId', 'https://v1-hub-masterpass.sph-test-solinor.com');
var paymentAPI = new PaymentAPI('https://v1-hub-masterpass.sph-test-solinor.com', testKey, testSecret, 'test', 'test_merchantId');
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

  var skipPaymentSelector = req.query.skipPaymentSelector;

  var skip = undefined;
  if(skipPaymentSelector){
    skip = true;
  }

  var formContainer = formBuilder.generatePaymentParameters(successUri, failureUri, cancelUri, language, 1950, currency,
    orderId, description, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, skip);

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
      console.log(err);
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

app.get('/pay_with_token_and_cvc', function (req, res) {
  var successUri = baseUri + "/success";
  var failureUri = baseUri + "/failure";
  var cancelUri = baseUri + "/cancel";

  var amount = 1990;
  var currency = "EUR";
  var orderId = "1000123A";
  var description = "A Box of Dreams. 19,90€";

  var token = req.query.token;

  var formContainer = formBuilder.generatePayWithTokenAndCvcParameters(token, successUri, failureUri, cancelUri, language, amount, currency, orderId, description);
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
      var cvcRequired = false;
      if(result.card.cvc_required == 'yes'){
        cvcRequired = true;
      }
      var data = {
        validRedirect: validRedirect,
        cvcRequired: cvcRequired,
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

app.listen(app.get('port'), function () {
  console.log('listening on *:' + app.get('port'));
});

function validateRedirect(requestParams) {
  return secureSigner.validateFormRedirect(requestParams);
}