require('dotenv').config();
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const geoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    location: { type: SchemaType.STRING },
    lat: { type: SchemaType.NUMBER },
    lon: { type: SchemaType.NUMBER }
  },
  required: ["location", "lat", "lon"]
};

// 💡 요청하신 gemini-3.5-flash 로 고정 완료
const geoModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { responseMimeType: 'application/json', responseSchema: geoSchema }
});

const weatherSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING, description: "상단 카드 요약 문구" },
    reply: { type: SchemaType.STRING, description: "상세한 AI 답변" },
    weatherIcon: { type: SchemaType.STRING, description: "날씨 이모지" },
    topIcon: { type: SchemaType.STRING, description: "상의 이모지" },
    bottomIcon: { type: SchemaType.STRING, description: "하의 이모지" }
  },
  required: ["summary", "reply", "weatherIcon", "topIcon", "bottomIcon"]
};

// 💡 요청하신 gemini-3.5-flash 로 고정 완료
const textModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { responseMimeType: 'application/json', responseSchema: weatherSchema }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 메소드만 허용됩니다.' });

  // 💡 프론트엔드에서 넘어오는 isSilent 값 수신
  const { message, lat: clientLat, lon: clientLon, isSilent } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 비어있습니다.' });

  try {
    let location = '서울 마포구';
    let lat = 37.549;
    let lon = 126.913;

    if (clientLat && clientLon) {
      location = '현재 접속하신 위치';
      lat = clientLat;
      lon = clientLon;
    } else {
      try {
        const geocodePrompt = `"${message}" 이 문장에서 한국 지역명, 위도, 경도만 추출해.`;
        const geocodeResult = await geoModel.generateContent(geocodePrompt);
        const locationInfo = JSON.parse(geocodeResult.response.text());
        if (locationInfo.location) location = locationInfo.location;
        if (locationInfo.lat) lat = locationInfo.lat;
        if (locationInfo.lon) lon = locationInfo.lon;
      } catch (e) {
        console.warn("위경도 추출 실패");
      }
    }

    // Open-Meteo 기상청 호출 (무료, 한도 제한 없음)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=Asia/Seoul`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherJson = await weatherResponse.json();

    const temp = weatherJson.current?.temperature_2m ?? 20;
    const humidity = weatherJson.current?.relative_humidity_2m ?? 50;
    const prep = weatherJson.current?.precipitation ?? 0;
    const weatherCode = weatherJson.current?.weather_code ?? 0;

    // =========================================================================
    // 💡 [핵심 추가] isSilent = true (페이지 접속 시 자동 로딩) 처리
    // Gemini API 및 Supabase DB 저장을 전혀 하지 않고, 자체 계산으로 0.1초만에 응답!
    // =========================================================================
    if (isSilent) {
      // 1. 날씨 이모지 및 요약
      let weatherIcon = '☀️';
      let weatherState = '맑음';
      if (weatherCode >= 1 && weatherCode <= 3) { weatherIcon = '⛅'; weatherState = '구름 조금'; }
      if (weatherCode >= 45 && weatherCode <= 48) { weatherIcon = '🌫️'; weatherState = '안개'; }
      if (weatherCode >= 51 && weatherCode <= 65) { weatherIcon = '🌧️'; weatherState = '비'; }
      if (weatherCode >= 71) { weatherIcon = '❄️'; weatherState = '눈'; }

      // 2. 온도별 옷차림 이모지 (윈도우 깨짐 방지 안전 이모지)
      let topIcon = '👕';
      let bottomIcon = '👖';

      if (temp >= 28) {
        topIcon = '🎽'; // 민소매/반팔
        bottomIcon = '👖';
      } else if (temp >= 20) {
        topIcon = '👕'; // 반팔/칠부
        bottomIcon = '👖';
      } else if (temp >= 12) {
        topIcon = '👔'; // 셔츠/맨투맨
        bottomIcon = '👖';
      } else {
        topIcon = '🧥'; // 외투/코트
        bottomIcon = '👖';
      }

      const summaryText = `체이스님, ${location}은 현재 ${temp}°C로 ${weatherState} 상태예요!`;

      // Gemini 호출 없이 즉시 반환 (API 한도 0 소모!)
      return res.status(200).json({
        reply: null,
        location: location,
        summary: summaryText,
        weatherIcon: weatherIcon,
        topIcon: topIcon,
        bottomIcon: bottomIcon
      });
    }

    // =========================================================================
    // 💡 사용자가 직접 질문하거나 버튼을 누른 경우 (Gemini API 정상 호출)
    // =========================================================================
    const weatherData = {
      TA: temp,
      REH: humidity,
      PREP_VAL: prep,
      WM_CODE: weatherCode
    };

    const weatherPrompt = `당신은 똑똑한 날씨 AI 비서입니다. 사용자를 "체이스"라고 부르세요.
사용자 요청: "${message}"
지역: ${location}
실시간 기상 데이터: ${JSON.stringify(weatherData)}

지시사항:
1. 사용자의 "요청"에 맞게 reply를 작성하세요.
   - 날씨/옷차림 질문이면 날씨 설명과 옷 추천을 하세요.
   - 스케줄 관련 질문이면 날씨에 대비한 스케줄 조언을 하세요.
   - 음악 추천을 원하면 현재 날씨에 어울리는 음악 3곡을 장르, 곡명, 유튜브 검색 주소(https://www.youtube.com/results?search_query=가수+제목)를 포함하여 리스트로 추천하세요.
2. summary, weatherIcon, topIcon, bottomIcon은 항상 현재 날씨에 맞게 채워주세요.
3. [중요] bottomIcon(하의 이모지)는 윈도우에서 깨짐 현상을 방지하기 위해 반드시 👖(청바지), 👗(원피스/치마) 같은 보편적이고 오래된 이모지만 사용하세요. (🩳 반바지 이모지는 절대 사용 금지)`;

    const weatherResult = await textModel.generateContent(weatherPrompt);
    const parsedResult = JSON.parse(weatherResult.response.text());

    // DB 기록 (직접 대화할 때만 저장)
    if (supabase) {
      try {
        await supabase.from('chat_history').insert([{
          user_message: message,
          ai_response: parsedResult.reply,
          location: location,
          weather_raw_data: weatherData
        }]);
      } catch (e) {
        console.error('수파베이스 저장 실패:', e);
      }
    }

    return res.status(200).json({
      reply: parsedResult.reply,
      location: location,
      summary: parsedResult.summary,
      weatherIcon: parsedResult.weatherIcon,
      topIcon: parsedResult.topIcon,
      bottomIcon: parsedResult.bottomIcon
    });

  } catch (error) {
    console.error('백엔드 에러:', error);
    return res.status(500).json({ error: `[서버 에러] ${error.message}` });
  }
};