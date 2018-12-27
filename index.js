const express = require('express');
const app = express();
const logger = require('morgan');
const bodyParser = require('body-parser');
const querystring = require('querystring');

const request = require('request');
const uuid = require('uuid');
const fs = require('fs');

// 라우터 설정
const kakaoRouter = express.Router();
const naverRouter = express.Router();
const facebookRouter = express.Router();

app.use(logger('dev', {}));
app.use(bodyParser.json());

app.use('/kakao', kakaoRouter);
app.use('/naver', naverRouter);
app.use('/facebook', facebookRouter);


///////////////////////////
/////////   Kakao  //////// 
///////////////////////////

kakaoRouter.post('/', function (req, res) {
  var state = req.body.userRequest.user.id;
  var uuid_state = state + "&" + uuid.v1();
  var content = req.body.userRequest.utterance;
  console.log("uuid_state : " + uuid_state)
  console.log("state : " + state);
  console.log("content : " + content);

  // API 서버에 요청할 body form. 
  // POST 방식으로 form 변수로 전달함
  var requestBody = {
    "user_key": state,
    "type": "text",
    "content": content,
  }

  var requestHeader = {
    "Coontent-Type": "application/json",
  }

  // request form for API server
  var options = {
    "url": "http://58.225.115.230:23701/hmc/message",
    "method": "POST",
    "headers": JSON.stringify(requestHeader),
    "body": JSON.stringify(requestBody),
  }

  request.post({
    url: "http://58.225.115.230:23701/hmc/message", 
    form: {
      user_key: state,
      type: "text",
      content: content,
    }
  }, function (err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: Kakao ECO Server error :: Location : Requesting for kakao");
    }

    // 디버깅을 위해 요청한 body 정보를 콘솔로 표시
    //console.log("SERVER :: Kakao Eco :: Kakao Request bodyform ::");
    //console.log(body);

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

      var buttonList = [];
      for (var i = 0; i < apiResponseBody.keyboard.buttons.length; i++) {
        buttonList.push({
          "action": apiResponseBody.buttons[i].action,
          "label": apiResponseBody.buttons[i].label,
          "url": apiResponseBody.buttons[i].url,
          "messageText": apiResponseBody.buttons[i].messageText,
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
      for (var i = 0; i < apiResponseBody.buttons.length; i++) {
        buttonList.push({
          "action": apiResponseBody.buttons[i].action,
          "label": apiResponseBody.buttons[i].label,
          "url": apiResponseBody.buttons[i].url,
          "messageText": apiResponseBody.buttons[i].messageText,
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
                  "imageUrl": apiResponseBody.imageUrl,
                }
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

      var quickList = [];
      for (var i = 0; i < apiResponseBody.quickReplies.length; i++) {
        quickList.push ({
          "action": apiResponseBody.quickReplies[i].action,
          "label": apiResponseBody.quickReplies[i].label,
          "messageText": apiResponseBody.quickReplies[i].messageText,
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
      for (var i = 0; i < apiResponseBody.items.length; i++) {
        itemList.push ({
          "title": apiResponseBody.items[i].title,
          "description": apiResponseBody.items[i].description,
          "imageUrl": apiResponseBody.items[i].imageUrl,
          "link": {
            "web": apiResponseBody.items[i].homepage
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
                "imageUrl": 
                "altText": "이미지를 찾을 수 없습니다.",
              }
            }
          ],
        }
      }

    }


    console.log("SERVER :: Kakao Eco :: Kakao response data");
    console.log(responseBody.template.outputs);

    res.send(responseBody);
  });
});


app.listen(23702, function() {
	console.log("Example skill server listening on port 23702!");
});