const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const uuid = require('uuid');
const fs = require('fs');
const http = require('http');
const https = require('https');

// 라우터 설정
const kakaoRouter = express.Router();
const naverRouter = express.Router();
const facebookRouter = express.Router();

app.use(bodyParser.json());

app.use('/kakao', kakaoRouter);
app.use('/naver', naverRouter);
app.use('/facebook', facebookRouter);

// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/echo.hmcchatbot.ze.am/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/echo.hmcchatbot.ze.am/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/echo.hmcchatbot.ze.am/chain.pem', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca
}

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

///////////////////////////
/////////   Kakao  //////// 
///////////////////////////

kakaoRouter.post('/', function (req, res) {
  var state = req.body.userRequest.user.id;
  var uuid_state = state + "&" + uuid.v1();
  var content = req.body.userRequest.utterance;

  //var headers = {
  //  'Content-Type': 'application/json'
  //}

  var formData = {
    "user_key": state,
    "content": content,
    "type": "text",
  }

  console.log("Form: ", formData)

  // API 서버에 요청할 body form. 
  // POST 방식으로 form 변수로 전달함
  request.post("http://58.225.115.230:3101/hmc/message", {form: {
    "user_key": state,
    "content": content,
    "type": "text",
  }} , function (err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: API Server error :: Location : Requesting for api");
    }

    // 응답 역시 콘솔로 표시
    console.log(apiResponse.body)

    var apiResponseBody = JSON.parse(apiResponse.body);
    console.log("\n==========================API response==============================");
    console.log(apiResponseBody);
    console.log("====================================================================\n");

    var responseBody;

    // 응답 결과를 카카오 형식으로 변환해서 카카오 챗봇에 응답함
    // 1. 버튼 응답이 없는 일반 텍스트
    if (apiResponseBody.type == "simpleText") {

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "simpleText": {
                "text": apiResponseBody.text,
              }
            }
          ]
        }
      }

    }
    // 2. 버튼이 존재하는 응답
    else if (apiResponseBody.type == "messageButton") {
      var buttonObj = JSON.parse(apiResponseBody.object1)
      var buttonList = [];
      for (var i = 0; i < buttonObj.length; i++) {
        buttonList.push({
          "action": buttonObj[i].action,
          "label": buttonObj[i].label,
          "webLinkUrl": buttonObj[i].url,
          "messageText": buttonObj[i].messageText,
        });
      }

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "basicCard": {
                "description": apiResponseBody.text,
                "buttons": buttonList,
              }
            }
          ]
        }
      }

    }
    // 3. 이미지가 존재하는 버튼
    else if (apiResponseBody.type == "imageButton") {

      var buttonList = [];
      for (var i = 0; i < apiResponseBody.object2.length; i++) {
        buttonList.push({
          "action": apiResponseBody.object2[i].action,
          "label": apiResponseBody.object2[i].label,
          "url": apiResponseBody.object2[i].url,
          "messageText": apiResponseBody.object2[i].messageText,
        });
      }

      responseBody = {
        "version": "2.0", 
        "template": {
          "outputs": [
            {
              "basicCard": {
                "description": apiResponseBody.text,
                "thumbnail": {
                  "imageUrl": apiResponseBody.object1,
                },
                "buttons": buttonList,
              }
            }
          ]
        }
      }

    }
    // 4. 바로가기 연결 
    else if (apiResponseBody.type == "quickReply") {
      var quickObj = JSON.parse(apiResponseBody.object1)
      var quickList = [];
      for (var i = 0; i < quickObj.length; i++) {
        quickList.push ({
          "action": quickObj[i].action,
          "label": quickObj[i].label,
          "messageText": quickObj[i].messageText,
        });
      }

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "simpleText": {
                "text": apiResponseBody.text,
              }
            }
          ],
          "quickReplies": quickList,
        }
      }

    }
    // 5. 리스트형
    else if (apiResponseBody.type == "list") {

      var itemList = [];
      for (var i = 0; i < apiResponseBody.object1.length; i++) {
        itemList.push ({
          "title": apiResponseBody.object1[i].title,
          "description": apiResponseBody.object1[i].description,
          "imageUrl": apiResponseBody.object1[i].imageUrl,
          "link": {
            "web": apiResponseBody.object1[i].homepage
          }
        });
      }

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "listCard": {
                "header": {
                  "title": apiResponseBody.text
                },
                "items": itemList,
              }
            }
          ],
        }
      }

    }
    // 6. 이미지
    else if (apiResponseBody.type == "image") {

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "simpleImage": {
                "imageUrl": apiResponseBody.object1,
                "altText": "이미지를 찾을 수 없습니다.",
              }
            }
          ],
        }
      }

    }
    // 7. 케로셀 (버튼이 개별적으로 존재하는 리스트)
    else if (apiResponseBody.type == "carousel") {
      var cels = []
      for (var i = 0; i < apiResponseBody.object1.length; i++) {
        cels.push({
          "title": apiResponseBody.object1[i].title,
          "description": apiResponseBody.object1[i].description,
          "thumbnail": {
            "imageUrl": apiResponseBody.object1[i].imageUrl,
          },
          "buttons": [
            {
              "action": "message",
              "label": "여기로 할래",
              "messageText": apiResponseBody.object1[i].title,
            }
          ]
        });
      }

      responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "carousel": {
                "type": "basicCard",
                "items": cels
              }
            }
          ]
        }
      }
    }

    console.log("\n********************PlusFriend Reply form******************************");
    console.log(responseBody.template.outputs);
    console.log("***********************************************************************\n");

    res.send(responseBody);
  });
});

// /////////////////////////
// /////// naver ////////
// /////////////////////////
function send2Line (channelAccessToken, replyToken, messages) {
  var headers = {
    'Content-type' : 'application/json',
    'Authorization' : 'Bearer ' + channelAccessToken
  };

  var options = {
    url: 'https://api.line.me/v2/bot/message/reply',
    method: 'POST',
    headers: headers,
    json: {
      replyToken : replyToken,
      messages : messages
    }
  };

  request(options, function (error, response, body) {
    console.log('response', response.statusCode);
    if (!error && response.statusCode == 200) {
      console.log(body)
    }
    else{ 
      console.log('requestSender', error);
    }
  });
};

naverRouter.post('/', function(req, res) {
  var state = req.body.events[0].source.userId;
  var uuid_state = state + "&" + uuid.v1();
  var content = req.body.events[0].message.text;

  var eventObj = req.body.events[0];
  var source = eventObj.source;
  var message = eventObj.message;

  console.log("uuid: " + state);
  console.log("content: " + content);

  var CHANNEL_ACCESS_TOKEN = 'j1cV8rXKOBx3pjW6ny7b+4UhevfLEAXn4kPs3JvkjI8R6wcgNUyB6Jq08Rr6rCCunGyKj2FNu8ols26PWe809ZX4MNNc20lqPxnk7vo4xRRc6ZBWu/2xs2VW1iD3afqTBpnteURvXz+pVnvbS3PJMgdB04t89/1O/w1cDnyilFU=';

	var headers = {
		'Content-Type' : 'application/json'
	}

	var formData = {
		"user_key" : state,// state,
		"content" : content,// content,
		"type" : "text" ,
	}
	request.post({
		headers : headers,
		//url:"http://192.168.123.237:23701/hmc/message",
		url : "http://58.225.115.230:3101/hmc/message",
		form : formData,
	},
	function(err, apiResponse, body) {
		if (err) {
			console.error(err);
			res.status(500).send("SERVER :: API Server error :: Location : Requesting for api : " + err);
		}
		
		var apiResponseBody = JSON.parse(apiResponse.body);
		var responseBody;
		
    console.log("\n==========================API response==============================");
    console.log(apiResponseBody);
    console.log("====================================================================\n");

    // Text only reply
		if (apiResponseBody.type == "simpleText") {
			responseBody = [
        {
          "type": "flex",
          "altText": "This is a Flex Message",
          "contents": {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type" : "text",
                  "text" : apiResponseBody.text,
                  "wrap": true
                }
              ]
            }
          }
        }
      ]
    }

    // Text with Button reply
    else if (apiResponseBody.type == "messageButton") {
			var buttonObj = JSON.parse(apiResponseBody.object1);
			var contentList = [{
        "type": "text",
        "text": apiResponseBody.text,
        "wrap": true
      }];

			for (var i = 0; i < buttonObj.length; i++) {
        var temp;

        if (buttonObj[i].action == "webLink") {
          // Case of web link
          temp = {
            "type": "button",
            "style": "primary",
            "action": {
              "type": "uri",
              "label": buttonObj[i].label,
              "uri": buttonObj[i].url
            }
          }
        } else {
          // Case of return message
          temp = {
            "type": "button",
            "style": "primary",
            "action": {
              "type": "message",
              "label": buttonObj[i].label,
              "text": buttonObj[i].messageText
            }
          }
        }

        contentList.push(temp)
			}

      responseBody = [
        {
          "type": "flex",
          "altText": "This is a Flex Message",
          "contents": {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": contentList,
              "spacing": "xl"
            }
          },
        }
      ]
		}

    // Image only reply
		else if (apiResponseBody.type == "image") {
			var imageUrl = apiResponseBody.object1;
			responseBody = [
        {
          "type": "flex",
          "altText": "This is a Flex Message",
          "contents": {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "현재 이미지를 제공할 수 없습니다. (" + imageUrl + ")",
                  "wrap": true
                }
              ],
              "spacing": "xl"
            }
          }
        }
      ]
		}

    // Image with Button reply
		else if (apiResponseBody.type == "imageButton") {
			var imageUrl = apiResponseBody.object1;
			var buttonObj = JSON.parse(apiResponseBody.object2);
			var contentList = [
        {
          "type": "text",
          "text": apiResponseBody.text,
          "wrap": true
        }
      ];

			for (var i = 0; i < buttonObj.length; i++) {
        var temp;

        if (buttonObj[i].action == "webLink") {
          // Case of web link
          temp = {
            "type": "button",
            "style": "primary",
            "action": {
              "type": "uri",
              "label": buttonObj[i].label,
              "uri": buttonObj[i].url
            }
          }
        } else {
          // Case of return message
          temp = {
            "type": "button",
            "style": "primary",
            "action": {
              "type": "message",
              "label": buttonObj[i].label,
              "text": buttonObj[i].messageText
            }
          }
        }

        contentList.push(temp)
      }

			responseBody = [
        {
          "type": "flex",
          "altText": "This is a Flex Message",
          "contents": {
            "type": "bubble",
            //"hero": {
            //  "type": "image",
            //  "url": imageUrl,
            //  "aspectMode": "fit"
            //},
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": contentList,
              "spacing": "xl"
            }
          }
        }
      ]
		}

    // Text with Quick replies reply
		else if (apiResponseBody.type == "quickReply") {
			var quickObj = JSON.parse(apiResponseBody.object1);
			var quickList = [];

			for (var i = 0; i < quickObj.length; i++) {
				quickList.push({
					"type" : "action",
					"action" : {
						"type" : "message",
						"label" : quickObj[i].label,
						"text" : quickObj[i].messageText,
					}
				});
			}

      responseBody = [{
        "type": "text",
        "text": apiResponseBody.text,
        "quickReply": {
          "items": quickList
        }
      }]
		}

    // Carousel reply
		else if (apiResponseBody.type == "carousel") {
			var cels = [];
			for (var i = 0; i < apiResponseBody.object1.length; i++) {
        cels.push({
          "type": "bubble",
          "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "xl",
            "contents": [
              {
                "type": "text",
                "text": apiResponseBody.object1[i].title,
                "wrap": true,
                "weight": "bold",
                "size": "xl"
              },
              {
                "type": "text",
                "text": apiResponseBody.object1[i].description,
                "wrap": true,
                "size": "sm"
              },
              {
                "type": "button",
                "style": "primary",
                "action": {
                  "type": "message",
                  "label": "여기가 좋겠다",
                  "text": apiResponseBody.object1[i].title
                }
              }
            ]
          }
        });
			}

      responseBody = [
        {
          "type": "flex",
          "altText": "This is a Flex Message",
          "contents": {
            "type": "carousel",
            "contents": cels
          }
        }
      ];
		}

    console.log("\n*********************Line Reply form******************************");
    console.log(responseBody);
    console.log("******************************************************************\n");

    send2Line(CHANNEL_ACCESS_TOKEN, eventObj.replyToken, responseBody);

    res.sendStatus(200);
	});
});

// /////////////////////////
// /////// facebook ////////
// /////////////////////////

function handleMessage (sender_psid, recieved_message) {
  //console.log(recieved_message);

  var state = sender_psid;
  var uuid_state = state + "&" + uuid.v1();
  var content;

  if (recieved_message.text) {
    content = recieved_message.text;
  } else {
    content = recieved_message.payload;
  }

  console.log("uuid: " + state);
  console.log("content: " + content);

  var headers = {
    'Content-Type' : 'application/json'
  }

  var formData = {
    "user_key" : state,// state,
    "content" : content,// content,
    "type" : "text" ,
  }
  request.post({
    headers : headers,
    //url:"http://192.168.123.237:23701/hmc/message",
    url : "http://58.225.115.230:3101/hmc/message",
    form : formData,
  },
  function(err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: API Server error :: Location : Requesting for api : " + err);
    }
    
    var apiResponseBody = JSON.parse(apiResponse.body);
    var responseBody;
    
    console.log("\n==========================API response==============================");
    console.log(apiResponseBody);
    console.log("====================================================================\n");

    // Text only reply
    if (apiResponseBody.type == "simpleText") {
      responseBody = {
        "text": apiResponseBody.text
      }
    } 

    // Text with Button reply
    else if (apiResponseBody.type == "messageButton") {
      var buttonObj = JSON.parse(apiResponseBody.object1);
      var buttonList = [];

      for (var i = 0; i < buttonObj.length; i++) {
        var temp;

        if (buttonObj[i].action == "webLink") {
          // Case of web link
          temp = {
            "type": "web_url",
            "url": "https://echo.hmcchatbot.ze.am/facebook/url?url=" + buttonObj[i].url,
            "title": buttonObj[i].label
          }
        } else {
          // Case of return message
          temp = {
            "type": "postback",
            "title": buttonObj[i].label,
            "payload": buttonObj[i].messageText
          }
        }

        buttonList.push(temp)
      }

      responseBody = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": apiResponseBody.text,
            "buttons": buttonList
          }
        }
      }
    }

    // Image only reply
    else if (apiResponseBody.type == "image") {
      var imageUrl = apiResponseBody.object1;

      responseBody = {
        "text": "현재 이미지를 표시할 수 없습니다. ("+imageUrl+")"
      }

      /*
      responseBody = {
        "attachment": {
          "type": "image",
          "payload": {
            "url": imageObj.imageUrl
          }
        }
      }
      */
    }

    // Image with Button reply
    else if (apiResponseBody.type == "imageButton") {
      var imageUrl = apiResponseBody.object1;
      var buttonObj = JSON.parse(apiResponseBody.object2);
      var buttonList = [];

      for (var i = 0; i < buttonObj.length; i++) {
        var temp;

        if (buttonObj[i].action == "webLink") {
          // Case of web link
          temp = {
            "type": "web_url",
            "url": "https://echo.hmcchatbot.ze.am/facebook/url?url=" + buttonObj[i].url,
            "title": buttonObj[i].label
          }
        } else {
          // Case of return message
          temp = {
            "type": "postback",
            "title": buttonObj[i].label,
            "payload": buttonObj[i].messageText
          }
        }

        buttonList.push(temp)
      }

      responseBody = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": [
              {
                "title": "안내",
                "subtitle": apiResponseBody.text,
                "buttons": buttonList  
              }
            ]
          }
        }
      }
    }

    // Text with Quick replies reply
    else if (apiResponseBody.type == "quickReply") {
      var quickObj = JSON.parse(apiResponseBody.object1);
      var quickList = [];

      for (var i = 0; i < quickObj.length; i++) {
        quickList.push({
          "content_type": "text",
          "title" : quickObj[i].label,
          "payload": quickObj[i].messageText
        });
      }

      responseBody = {
        "text": apiResponseBody.text,
        "quick_replies": quickList
      }
    }

    // Carousel reply
    else if (apiResponseBody.type == "carousel") {
      var cels = [];
      for (var i = 0; i < apiResponseBody.object1.length; i++) {
        cels.push({
          "title": apiResponseBody.object1[i].title,
          "subtitle": apiResponseBody.object1[i].description,
          "buttons": [
            {
              "type": "postback",
              "title": "여기가 좋겠다",
              "payload": apiResponseBody.object1[i].title
            }
          ]
        });
      }

      responseBody = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": cels
          }
        }
      }
    }

    console.log("\n*********************Messenger Reply form******************************");
    console.log(responseBody);
    console.log("***********************************************************************\n");

    callSendAPI(sender_psid, responseBody);
  });
}

function callSendAPI (sender_psid, response) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": {"access_token": PAGE_ACCESS_TOKEN},
    "method": "POST",
    "json": request_body
  }, function (err, res, body) {
    if (!err) {
      console.log('message sent!');
    }
    else {
      console.error("Unable to send message " + err)
    }
  });
}

facebookRouter.get('/privacy', function (req, res) {
  res.sendFile(__dirname + "/views/HMC+챗봇+처리방침.html")
});

//const PAGE_ACCESS_TOKEN = 'EAALh6iqMeHoBAJH5scsmKvWBHZB2KY8ZBvNh1uSgQqJnCcga0cne1n4KrtD0drAQvYYW9vFZAVEAHNW5ZClvdEJvEPefkz9Crt8LvaJ0GQ7ZCYUSAPn2cbNziFEZC0B1vPiYGK8lH9Rtb6jrx9jQJ8ZBDClvb8MBi8aHcwugen3qgZDZD';
const PAGE_ACCESS_TOKEN = 'EAAHuvRvN99UBAI36JACect6DcUvFatxXKyviEfnbMqy80XSHSJNqpeJYFpfqwLVFCFiqALveG4gh7ZCN2NI9dRHNGLSexfX9TYTZBd6Xg0ZC5EEpwZC8SicyReTEq1LjRWf0LIPWQQVK7Sn1m22bY3Ngfxte6LKXgeIYi4RghQZDZD'
//const PAGE_ACCESS_TOKEN = 'EAAibloBcJtABABP8Y5vZAozIl1wHsZCl43V68OWBIqKZCxnhN2xiSlXsl5XeUhgFwliIfQ1f4e1szsmZAMkwWORzYZAZCAWygZBwHmlv6YkhCELtR8gcZA1Rm5VyXRhoexZAqUHx8PMr6B7YiPbafqFQ2KC7xAC2LZBvb9YW7qZCy63ppecYPSs2jKlCqL0BFLowNIZD';
const VERIFY_TOKEN = "VERIFY_TOKEN";

facebookRouter.get('/', function (req, res) {
  console.log(req.query['hub.verify_token']);
  if (VERIFY_TOKEN === req.query['hub.verify_token']) {
    return res.send(req.query['hub.challenge']);
  }
  res.send("wrong token");
});

facebookRouter.get('/url', function (req, res) {
  console.log(req.query);
  var url = req.query.url;
  if (url.indexOf("stg.kr-ccapi") > 0) {
    url = 'https://stg.kr-ccapi.hyundai.com/api/v1/user/oauth2/authorize?client_id=03f251b4-75ca-4042-bbc1-c8375a767a82&redirect_uri=http://58.225.115.230:3101/hmc/oauth2url&response_type=code&state=' + req.query.state;
  }  
  res.redirect(url);
});

facebookRouter.post('/', function (req, res) {
  let body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(function (entry) {
      let webhook_event = entry.messaging[0];
      //console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;
      //console.log('sender PSID: ' + sender_psid);

      if (webhook_event.message) {
        //console.log(webhook_event.message);
        handleMessage(sender_psid, webhook_event.message);
      }
      else if (webhook_event.postback) {
        //console.log(webhook_event.postback);
        handleMessage(sender_psid, webhook_event.postback);
      }
    });
    res.send("EVENT_RECEIVED");
  }
  else {
    res.sendStatus(400);
  }
});

// https serving on 443 port (global)

httpServer.listen(80, () => {
  console.log('HTTP Server running on port 80');
});

httpsServer.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});

//JSON OBJECT를 String 형으로 변환
function _stringify(_jsonObj) {
	var jsonObj = _jsonObj;
	var returnStr = JSON.stringify(jsonObj);
	if (returnStr) {
		returnStr = returnStr.replace(/\\"/gi, "\\@");
		returnStr = returnStr.replace(/"/gi, "");
		returnStr = returnStr.replace(/\\@/gi, "\"");
		returnStr = returnStr.replace(/\\r/gi, "");
		returnStr = returnStr.replace(/\\n/gi, "<br>");
	} else {
		returnStr = '';
	}
	return returnStr;
};


