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
    console.log("SERVER :: Kakao Eco :: API response data");
    console.log(apiResponse.body);

    // 응답 결과를 카카오 형식으로 변환해서 카카오 챗봇에 응답함
    const responseBody = {
      "version": "2.0",
      "template": {
        "outputs": [
          {
            "basicCard": {
              "title": "보물상자",
              "description": "보물상자 안에는 뭐가 있을까",
              "buttons": [
                {
                  "action":  "webLink",
                  "label": "구경하기",
                  "webLinkUrl": "https://e.kakao.com/t/hello-ryan"
                }
              ]
            }
          }
        ]
      }
    }
    res.send(responseBody);
  });
});


app.listen(23702, function() {
	console.log("Example skill server listening on port 23702!");
});