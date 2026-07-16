require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. 환경 변수에서 구글 API 키 및 수파베이스 설정값을 안전하게 읽어옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Google Generative AI 초기화
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 2. 가장 똑똑하고 빠른 제미나이 2.0 플래시 모델로 세팅
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { responseMimeType: 'application/json' }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 메소드만 허용됩니다.' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 비어있습니다.' });

  try {
    // 1단계: 제미나이를 이용해 질문에서 주소 정보와 위경도 추출
    const geocodePrompt = `
      사용자의 질문: "${message}"
      위 질문에서 찾고자 하는 한국의 동네 이름(지역명)과 그 지역의 대략적인 위도(lat)와 경도(lon)를 분석하여 JSON 형식으로만 응답해줘.
      반드시 아래 JSON 포맷을 유지해야 하며, 다른 텍스트 설명은 절대로 추가하지 마.
      {
        "location": "서울시 마포구 합정동",
        "lat": 37.549,
        "lon": 126.913
      }
    `;

    const geocodeResult = await model.generateContent(geocodePrompt);
    const geocodeText = geocodeResult.response.text();

    let locationInfo = { location: '서울특별시', lat: 37.566, lon: 126.978 };
    try {
      const jsonMatch = geocodeText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        locationInfo = JSON.parse(jsonMatch[0]);
      } else {
        locationInfo = JSON.parse(geocodeText);
      }
    } catch (e) {
      console.error('위경도 파싱 실패, 기본값 사용. 원본 텍스트:', geocodeText);
    }

    const { location, lat, lon } = locationInfo;

    // 2단계: Open-Meteo 기상청 API 직접 호출
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=Asia/Seoul`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherJson = await weatherResponse.json();

    const weatherData = {
      TA: weatherJson.current?.temperature_2m,          // 기온
      REH: weatherJson.current?.relative_humidity_2m,    // 습도
      PREP_VAL: weatherJson.current?.precipitation,      // 강수량
      WM_CODE: weatherJson.current?.weather_code         // 날씨 코드
    };

    // 3단계: 제미나이 2.0으로 실시간 날씨 요약본 생성
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const weatherPrompt = `
      당신은 실시간 날씨 정보를 안내해 주는 친근하고 똑똑한 AI 비서입니다.
      사용자를 부를 때는 반드시 존칭을 사용하여 **"체이스"**라고 불러주세요.
      Open-Meteo API로부터 실시간 조회된 기상 정보를 참고하여 답변해 주세요.

      [사용자 질문] "${message}"
      [조회된 지역명] ${location} (위도: ${lat}, 경도: ${lon})
      [실시간 기상 데이터 정보] ${JSON.stringify(weatherData, null, 2)}
      [주요 날씨 코드 가이드] 
      TA: 기온(°C), REH: 습도(%), PREP_VAL: 강수량(mm)
      WM_CODE(날씨상태코드): 
      - 0: 맑음
      - 1, 2, 3: 구름 조금 또는 흐림
      - 45, 48: 안개
      - 51, 53, 55: 이슬비
      - 61, 63, 65: 비
      - 71, 73, 75: 눈
      - 80, 81, 82: 소나기
      - 95, 96, 99: 뇌우
    `;

    const weatherResult = await textModel.generateContent(weatherPrompt);
    const reply = weatherResult.response.text().trim();

    // 4단계: 수파베이스 DB에 저장
    if (supabase) {
      try {
        await supabase.from('chat_history').insert([{
          user_message: message,
          ai_response: reply,
          location: location,
          weather_raw_data: weatherData
        }]);
      } catch (e) {
        console.error('수파베이스 저장 실패:', e);
      }
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('백엔드 에러 발생:', error);
    return res.status(500).json({ error: `[서버 에러] ${error.message}` });
  }
};