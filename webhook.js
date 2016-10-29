var express = require('express');
var bodyParser = require('body-parser');

var env = process.env.NODE_ENV || 'development';
var crypto = require('crypto');

function verifyTrelloWebhookRequest(request, secret, callbackURL) {
  // Double-HMAC to blind any timing channel attacks
  // https://www.isecpartners.com/blog/2011/february/double-hmac-verification.asp
  var base64Digest = function (s) {
    return crypto.createHmac('sha1', secret).update(s).digest('base64');
  }
  var content = JSON.stringify(request.body) + callbackURL;
  var doubleHash = base64Digest(base64Digest(content));
  var headerHash = base64Digest(request.headers['x-trello-webhook']);
  // OMG this took a while to troubleshoot...
  // console.log("body is " + JSON.stringify(request.body));
  // console.log("content is " + content);
  // console.log('x-trello-webhook is ' + request.headers['x-trello-webhook']);
  // console.log("verify" +
  //           JSON.stringify({body: request.body,
  //             callbackURL: callbackURL,
  //             doubleHash: doubleHash,
  //             headerHash: headerHash }));

  return doubleHash == headerHash;
}


var app = express();
app.set('port', (process.env.PORT || 5000));

app.use( bodyParser.json({
		      verify: function (req, res, buf) {
			         req.rawBodyBuffer = buf;
		      }
        }));

app.head("/trello-hook", function(req, res, next) {
  res.send('OK');
});

app.get("/trello-hook", function(req, res, next) {
  res.send('OK');
});

app.post("/trello-hook", function(req, res, next) {
  // console.log("got hook" + req.body);
  if (verifyTrelloWebhookRequest(req, process.env.TRELLO_SECRET, process.env.TRELLO_HOOK_URL)) {
    console.log("OK");
    res.send('OK');
  } else {
    console.log("failed verify");
    res.send('FAIL');
  }
});

var server = app.listen(app.get('port'), function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Node app is listening at http://%s:%s in %s', host, port, env);
});
