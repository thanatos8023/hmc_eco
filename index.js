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

  console.log(formData)

  // API 서버에 요청할 body form. 
  // POST 방식으로 form 변수로 전달함
  request.post("http://58.225.115.230:23701/hmc/message", {form: {
    "user_key": state,
    "content": content,
    "type": "text",
  }} , function (err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: API Server error :: Location : Requesting for api");
    }

    // 디버깅을 위해 요청한 body 정보를 콘솔로 표시
    console.log("SERVER :: Kakao Eco :: Kakao Request bodyform ::");
    console.log(body);

    // 응답 역시 콘솔로 표시
    var apiResponseBody = JSON.parse(apiResponse.body);
    console.log("SERVER :: Kakao Eco :: API response data");
    console.log(apiResponseBody);

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

      console.log("SERVER :: DEBUG BUTTONS :: ");
      console.log(buttonList);
      console.log("::::::::::::::::::::::::::::::::::::");

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
    // 카카오톡에서만 확인된 기능
    // 네이버, 페이스북에서는 테스트가 필요함
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

    console.log("SERVER :: Kakao Eco :: Kakao response data");
    console.log(responseBody.template.outputs);

    res.send(responseBody);
  });
});

// /////////////////////////
// /////// naver ////////
// /////////////////////////
'use strict';

const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: 'j1cV8rXKOBx3pjW6ny7b+4UhevfLEAXn4kPs3JvkjI8R6wcgNUyB6Jq08Rr6rCCunGyKj2FNu8ols26PWe809ZX4MNNc20lqPxnk7vo4xRRc6ZBWu/2xs2VW1iD3afqTBpnteURvXz+pVnvbS3PJMgdB04t89/1O/w1cDnyilFU=',
  channelSecret: '83e3ba930ab6223e27fa7fa9709396f8'
}

const client = new line.Client(config);

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
  /*
  // Test code
  var eventObj = req.body.events[0];
  var source = eventObj.source;
  var message = eventObj.message;

  var CHANNEL_ACCESS_TOKEN = 'j1cV8rXKOBx3pjW6ny7b+4UhevfLEAXn4kPs3JvkjI8R6wcgNUyB6Jq08Rr6rCCunGyKj2FNu8ols26PWe809ZX4MNNc20lqPxnk7vo4xRRc6ZBWu/2xs2VW1iD3afqTBpnteURvXz+pVnvbS3PJMgdB04t89/1O/w1cDnyilFU=';

  // req log
  console.log('==========================', new Date(), '============================');
  console.log('[request]', req.body);
  console.log('[request source]', eventObj.source);
  console.log('[request message]', eventObj.message);

  send2Line(CHANNEL_ACCESS_TOKEN, eventObj.replyToken, [{
    "type": "text",
    "text": "테스트 메시지 입니다"
  }]);

  res.sendStatus(200);
  */

  // 본 코드 
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
		url : "http://58.225.115.230:23701/hmc/message",
		form : formData,
	},
	function(err, apiResponse, body) {
		if (err) {
			console.error(err);
			res.status(500).send("SERVER :: API Server error :: Location : Requesting for api : " + err);
		}
		
		var apiResponseBody = JSON.parse(apiResponse.body);
		var responseBody;
		
		console.log("Type of response: " + apiResponseBody.type);

		if (apiResponseBody.type == "simpleText") {
			responseBody = {
				"type" : "text",
				"text" : apiResponseBody.text
			}
		} else if (apiResponseBody.type == "messageButton") {
			var buttonObj = JSON.parse(apiResponseBody.object1);
			var contentList = [];

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
            "type": "message",
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
            "hero": {
              "type": "text",
              "text": apiResponseBody.text,
              "flex": 0,
              "maxLines": 10
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": contentList
            }
          }
        }
      ]

      /*
      responseBody = {
        "type": "template",
        "altText": "This is a buttons template",
        "template": {
            "type": "buttons",
            "text": apiResponseBody.text,
            "actions": actionList
        }
      }
      */
		}

		else if (apiResponseBody.type == "image") {
			var imageObj = JSON
					.parse(apiResponseBody.object1);
			responseBody = {
				"type" : "image",
				"originalContentUrl" : imageObj.url
			}
		}

		else if (apiResponseBody.type == "imageButton") {

			var imageObj = JSOn.parse(apiReponseBody.object1);
			var buttonObj = JSON.parse(apiResponseBody.object2);
			var actionList = [];
			var imageList = [];

			for (var i = 0; i < buttonObj2.length; i++) {
				actionList.push({
					"type" : "uri",
					"action" : buttonObj[i].action,
					"label" : buttonObj[i].label,
					"uri" : buttonObj[i].url,
					"text" : buttonObj[i].messageText,
				});
			}

			responseBody = {
				"type" : "template",
				"template" : {
					"type" : "buttons",
					"text" : apiReponseBody.text,
					"thumbanilImageUrl" : imageObj,
					"imageSize" : "cover",
				},
				"actions" : actionList
			}
		}

		else if (apiResponseBody.type == "quickReply") {
			var quickObj = JSON
					.parse(apiReponseBody.object1);
			var quickList = [];

			for (var i = 0; i < quickObj.length; i++) {
				quickList.push({
					"type" : "action",
					"action" : {
						"type" : quickObj[i].action,
						"label" : quickObj[i].label,
						"text" : quickObj[i].messageText,
					}
				});
			}

			responseBody = {
				"quickReply" : {
					"items" : [ quickList, ]
				}
			}
		}

		else if (apiResponseBody.type == "carousel") {
			var cels = []
			for (var i = 0; i < apiResponseBody.object1.length; i++) {
				cels.push({
					"title" : apiResponseBody.object1[i].title,
					"description" : apiResponseBody.object1[i].description,
					"thumbnailImageUrl" : apiResponseBody.object1[i].imageUrl,
	
					"actions" : [ {
						"action" : "message",
						"label" : "",
						"messageText" : apiResponseBody.object1[i].title,
					} ]
				});
			}
			responseBody = {
				"type" : "template",
				"template" : {
					"type" : "carousel",
					"columns" : [ cels, ]
				}
			}
		}

    console.log("SERVER :: Naver Echo :: Naver response data");
    console.log(responseBody);

    send2Line(CHANNEL_ACCESS_TOKEN, eventObj.replyToken, responseBody);

    res.sendStatus(200);
	});
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


