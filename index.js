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

  var headers = {
    'Content-Type': 'application/json'
  }

  var formData = {
    "user_key": state,
    "content": content,
    "type": "text",
  }

  // API 서버에 요청할 body form. 
  // POST 방식으로 form 변수로 전달함
  request.post({
    headers: headers,
    url: "http://192.168.123.237:23701/hmc/message", 
    form: formData,
  }, function (err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: API Server error :: Location : Requesting for api");
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
      var buttonObj = JSON.parse(apiResponseBody.object1)
      var buttonList = [];
      for (var i = 0; i < buttonObj.length; i++) {
        if (buttonObj[i].action == "webLink") {
          buttonList.push({
            "action": buttonObj[i].action,
            "label": buttonObj[i].label,
            "url": buttonObj[i].url,
          });
        } else {
            buttonList.push({
            "action": buttonObj[i].action,
            "label": buttonObj[i].label,
            "messageText": buttonObj[i].messageText,
          });
        }
        
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

      var quickList = [];
      for (var i = 0; i < apiResponseBody.object1.length; i++) {
        quickList.push ({
          "action": apiResponseBody.object1[i].action,
          "label": apiResponseBody.object1[i].label,
          "messageText": apiResponseBody.object1[i].messageText,
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
          "quickReplies": object1,
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


app.listen(23702, function() {
	console.log("Example skill server listening on port 23702!");
});