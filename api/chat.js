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

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=Asia/Seoul`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherJson = await weatherResponse.json();

    const weatherData = {
      TA: weatherJson.current?.temperature_2m,
      REH: weatherJson.current?.relative_humidity_2m,
      PREP_VAL: weatherJson.current?.precipitation,
      WM_CODE: weatherJson.current?.weather_code
    };

    // 💡 변경된 핵심 프롬프트: 사용자 요청(음악, 스케줄 등)에 동적으로 대응하고 이모지 깨짐 방지
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