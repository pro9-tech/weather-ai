// api/chat.js - Gemini AI & 기상청 API & Supabase 연동 서버리스 함수
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. 환경 변수 체크 및 초기화
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KMA_API_KEY = process.env.KMA_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: { responseMimeType: 'application/json' } // JSON 응답 강제 설정 (1차 추출 시 사용)
});

// 2. KST(한국표준시) 시각 헬퍼 함수
function getKSTDate() {
  const utc = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
  const kstTime = new Date(utc + (9 * 60 * 60 * 1000));
  return kstTime;
}

// 3. 기상청 API용 발표시각(tmfc), 발효시각(tmef) 계산 함수
function getKMADateParams() {
  const now = getKSTDate();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = now.getHours();
  
  // 단기예보 발표 시각: 02, 05, 08, 11, 14, 17, 20, 23
  const forecastHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let tmfcHour = 23;
  let tmfcDate = new Date(now);
  
  // 안전하게 현재 시간보다 45분 이전 시각을 기준으로 최신 단기예보 발표 시점 판단
  const checkTime = new Date(now.getTime() - 45 * 60 * 1000);
  const checkHour = checkTime.getHours();
  
  let found = false;
  for (let i = forecastHours.length - 1; i >= 0; i--) {
    if (checkHour >= forecastHours[i]) {
      tmfcHour = forecastHours[i];
      found = true;
      break;
    }
  }
  
  if (!found) {
    // 00시 ~ 02시 이전인 경우 전날 23시 발표 자료 사용
    tmfcDate.setDate(tmfcDate.getDate() - 1);
    tmfcHour = 23;
  }
  
  const tmfcYear = tmfcDate.getFullYear();
  const tmfcMonth = String(tmfcDate.getMonth() + 1).padStart(2, '0');
  const tmfcDay = String(tmfcDate.getDate()).padStart(2, '0');
  
  const tmfc = `${tmfcYear}${tmfcMonth}${tmfcDay}${String(tmfcHour).padStart(2, '0')}`;
  const tmef = `${year}${month}${date}${String(hours).padStart(2, '0')}00`;
  
  return { tmfc, tmef };
}

// 4. 메인 Vercel 서버리스 핸들러 함수
module.exports = async (req, res) => {
  // CORS 및 POST 메소드 검증
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 메소드만 허용됩니다.' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: '메시지가 비어있습니다.' });
  }

  try {
    // 1단계: 사용자 질문에서 위치명과 대표 위경도 추출 (Gemini API 1차 호출)
    const geocodePrompt = `
      사용자의 질문: "${message}"
      위 질문에서 찾고자 하는 한국의 동네 이름(지역명)과 그 지역의 대략적인 위도(lat)와 경도(lon)를 분석하여 JSON 형식으로만 응답해줘.
      반드시 아래 JSON 포맷을 유지해야 하며, 다른 텍스트 설명은 절대로 추가하지 마.
      만약 질문에서 특정 지역을 유추할 수 없다면 기본값으로 "서울특별시"와 서울 시청의 위경도(lat: 37.566, lon: 126.978)를 반환해.

      [반환할 JSON 포맷 예시]
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
      locationInfo = JSON.parse(geocodeText.trim());
    } catch (e) {
      console.error('위경도 JSON 파싱 실패, 기본값 사용:', e, geocodeText);
    }

    const { location, lat, lon } = locationInfo;

    // 2단계: 기상청 위경도-격자 변환 API 호출
    const geoUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-dfs_xy_lonlat?lon=${lon}&lat=${lat}&help=0&authKey=${KMA_API_KEY}`;
    const geoResponse = await fetch(geoUrl);
    const geoText = await geoResponse.text();
    
    let gridX = 60;
    let gridY = 127;

    // 기상청 API의 에러 혹은 텍스트 응답 분석
    if (geoText.includes('result') && geoText.includes('status')) {
      // API 오류 발생 시 기본 격자(서울) 사용
      console.warn('기상청 좌표 변환 API 오류:', geoText);
    } else {
      // 텍스트 라인 파싱 (공백 구분)
      const geoLines = geoText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (geoLines.length > 0) {
        const parts = geoLines[0].split(/\s+/);
        if (parts.length >= 4) {
          // 출력 순서: lon lat x y
          gridX = parseInt(parts[2], 10) || 60;
          gridY = parseInt(parts[3], 10) || 127;
        }
      }
    }

    // 3단계: 기상청 단기예보 격자 데이터 조회 API 호출
    const { tmfc, tmef } = getKMADateParams();
    const weatherUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-dfs_shrt_grd?x=${gridX}&y=${gridY}&tmfc=${tmfc}&tmef=${tmef}&authKey=${KMA_API_KEY}`;
    
    const weatherResponse = await fetch(weatherUrl);
    const weatherText = await weatherResponse.text();
    
    let weatherData = { raw: weatherText };

    if (!weatherText.includes('result') || !weatherText.includes('401')) {
      // 텍스트 라인 파싱 (공백 구분으로 Key-Value 생성)
      const weatherLines = weatherText.split('\n').map(l => l.trim()).filter(l => l);
      let headers = [];
      let foundRow = null;

      for (const line of weatherLines) {
        if (line.startsWith('#')) {
          const cleanLine = line.replace('#', '').trim();
          if (cleanLine.includes('TA') || cleanLine.includes('SKY') || cleanLine.includes('TM_FC')) {
            headers = cleanLine.split(/\s+/);
          }
        } else if (headers.length > 0) {
          const values = line.split(/\s+/);
          if (values.length >= headers.length) {
            const row = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx];
            });
            foundRow = row;
            break; // 첫 번째 일치하는 예보 줄 사용
          }
        }
      }
      if (foundRow) {
        weatherData = foundRow;
      }
    }

    // 4단계: 실시간 날씨 데이터 기반 맞춤형 답변 생성 (Gemini API 2차 호출)
    // 2차 호출은 텍스트 응답이므로 JSON 제한을 해제한 기본 모델 객체 사용
    const textModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const weatherPrompt = `
      당신은 실시간 날씨 정보를 안내해 주는 친근하고 똑똑한 AI 비서입니다.
      사용자를 부를 때는 반드시 존칭을 사용하여 **"체이스"**라고 불러주세요. (예: "체이스, 오늘 합정동 날씨는...")
      
      기상청 API로부터 실시간 조회된 아래 기상 정보를 참고하여 사용자의 원래 질문에 자연스럽고 자세하게 답변해 주세요.

      [사용자 질문]
      "${message}"

      [조회된 지역명]
      ${location} (격자 좌표: X=${gridX}, Y=${gridY})

      [실시간 기상 데이터 정보]
      ${JSON.stringify(weatherData, null, 2)}

      [주요 날씨 약어 가이드]
      - TA: 기온 (섭씨 온도 ℃)
      - SKY: 하늘상태코드 (DB01/1: 맑음, DB02/2: 구름조금, DB03/3: 구름많음, DB04/4: 흐림)
      - PREP: 강수형태코드 (0: 없음, 1: 비, 2: 비/눈, 3: 눈, 4: 소나기)
      - WS 또는 S1/S2: 풍속 (m/s)
      - REH: 습도 (%)

      [답변 작성 시 주의사항]
      - 기상청 데이터에 기온(TA)이나 상태코드가 유효하다면 구체적인 온도 수치를 언급해 주세요.
      - 만약 기상청 API 오류 등으로 데이터가 비어있거나 정상적이지 않다면, 현재 날씨 확인이 다소 어렵다고 친절히 양해를 구하고 대략적인 시즌성 날씨 가이드를 제공해 주세요.
      - 날씨에 어울리는 추천 의상(외투 지참 여부 등)이나 외출 팁을 1~2줄 추가해 주세요.
      - 친근하고 정중하며 유용한 톤앤매너를 유지해 주세요.
    `;

    const weatherResult = await textModel.generateContent(weatherPrompt);
    const reply = weatherResult.response.text().trim();

    // 5단계: Supabase 데이터베이스에 대화 내역 저장 (비동기 수행)
    if (supabase) {
      try {
        await supabase
          .from('chat_history')
          .insert([
            {
              user_message: message,
              ai_response: reply,
              location: location,
              weather_raw_data: weatherData
            }
          ]);
      } catch (dbError) {
        console.error('Supabase DB 저장 실패 (서비스 작동에는 지장 없음):', dbError);
      }
    }

    // 최종 응답 반환
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('백엔드 에러 발생:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다: ' + error.message });
  }
};
