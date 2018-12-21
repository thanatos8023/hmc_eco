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
  console.log("uuid_state : " + uuid_state)
  console.log("state : " + state);

  // 온도는 시동 걸기에서만 입력됨
  if (req.body.action.params.sys_unit_temperature == null) {
    var degree = req.body.action.params.degree;
    if (degree === "적정") {
      var temperature = 23;
    } else if (degree === "최대") {
      var temperature = 32;
    } else if (degree === "최저") {
      var temperature = 16;
    } else if (degree === "따뜻") {
      var temperature = 28;
    } else if (degree === "시원") {
      var temperature = 19;
    }
    console.log("temperature : " + temp);
  } else if (req.body.action.params.sys_unit_temperature != null) {
    var temp = JSON.parse(req.body.action.params.sys_unit_temperature);
    var temperature = temp.amount; 
    console.log("temperature : " + temperature);
  } else {
    var temperature = null;
  }

  // API 서버에 요청할 body form. 
  // POST 방식으로 form 변수로 전달함
  var requestBody = {
    state: state,
    uuid_state: uuid_state,
    temperature: temperature,
  }

  request.post({
    url: 'http://58.225.115.230:23701',
    body: requestBody
  }, function (err, apiResponse, body) {
    if (err) {
      console.error(err);
      res.status(500).send("SERVER :: Kakao ECO Server error :: Location : Requesting for kakao");
    }

    // 디버깅을 위해 요청한 body 정보를 콘솔로 표시
    console.log("SERVER :: Kakao Eco :: Kakao Request bodyform ::");
    console.log(body);

    // 응답 역시 콘솔로 표시
    console.log("SERVER :: Kakao Eco :: API response data");
    console.log(apiResponse);

    // 응답 결과를 카카오 형식으로 변환해서 카카오 챗봇에 응답함
    res.send(apiResponse);
  });
});


app.listen(23702, function() {
	console.log("Example skill server listening on port 23702!");
});