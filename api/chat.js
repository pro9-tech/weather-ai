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

const textModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { responseMimeType: 'application/json', responseSchema: weatherSchema }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 메소드만 허용됩니다.' });

  const { message, lat: clientLat, lon: clientLon } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 비어있습니다.' });

  try {
    let location = '서울 마포구';
    let lat = 37.549;
    let lon = 126.913;

    // 💡 최적화 핵심: 프론트에서 실제 GPS를 넘겨주면 제미나이 안 거치고 즉시 패스!
    if (clientLat && clientLon) {
      location = '현재 접속하신 위치';
      lat = clientLat;
      lon = clientLon;
    } else {
      // 텍스트로 검색한 경우에만 제미나이한테 위경도 추출을 시킴
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

    // 곧바로 Open-Meteo 직접 호출 (매우 빠름)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=Asia/Seoul`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherJson = await weatherResponse.json();

    const weatherData = {
      TA: weatherJson.current?.temperature_2m,
      REH: weatherJson.current?.relative_humidity_2m,
      PREP_VAL: weatherJson.current?.precipitation,
      WM_CODE: weatherJson.current?.weather_code
    };

    const weatherPrompt = `당신은 똑똑한 날씨 AI 비서입니다. 사용자를 "체이스"라고 부르세요.
질문: "${message}"
지역: ${location}
실시간 기상 데이터: ${JSON.stringify(weatherData)}
코드해석(TA:기온℃, REH:습도%, PREP:강수량mm / WM_CODE: 0맑음, 1~3흐림, 45~48안개, 51~55이슬비, 61~65비, 71~75눈)

위 데이터를 바탕으로 친절하게 날씨 상황을 설명하고 그 날씨에 꼭 맞는 옷차림(상의, 하의)을 추천하세요.`;

    const weatherResult = await textModel.generateContent(weatherPrompt);
    const parsedResult = JSON.parse(weatherResult.response.text());

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