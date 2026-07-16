# AI 버튼식 트리거 추가 구현 계획서

체이스, 날씨 맞춤형 AI 조언을 즉시 받아볼 수 있도록 '버튼식 트리거'를 화면에 추가하고, 이와 연동되는 프롬프트 자동 조립 및 전송 로직을 프론트엔드에 추가하는 계획서입니다.

## 수정 대상 파일
1. **[index.html](file:///c:/Users/user/Desktop/날씨AI/index.html)**: 다크 테마 OOTD 위젯 바로 아래에 두 개의 트리거 버튼(📅 스케줄 피드백 받기, 🎵 추천 음악 보기)을 추가합니다.
2. **[script.js](file:///c:/Users/user/Desktop/날씨AI/script.js)**:
   * 날씨 정보를 수신하면 전역 변수 `window.currentWeatherInfo`에 저장하도록 기존 `updateOOTDWidget()` 함수 내에 대입 로직을 추가합니다.
   * `triggerMusicAI()`, `triggerScheduleAI()` 함수를 추가하여 각각의 맞춤 프롬프트를 기존 채팅 폼을 통해 제출되도록 로직을 작성합니다.

---

## 1. HTML 수정 상세 (`index.html`)

다크 테마 위젯 마크업의 끝나는 태그 `</div>` 바로 아래에 버튼 그룹 컨테이너를 배치합니다.

```html
        <!-- 다크 테마 OOTD 위젯 -->
        <div id="ootd-widget" style="text-align: center; padding: 15px; background: rgba(255, 255, 255, 0.08); border-radius: 12px; margin: 15px 0; border: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; backdrop-filter: blur(10px);">
            <div id="pet-avatar" style="font-size: 2.5rem; margin-bottom: 8px;">⏳</div>
            <p id="ootd-text" style="margin: 0; font-size: 1.05rem; font-weight: 500;">현재 날씨를 분석 중입니다...</p>
        </div>

        <!-- AI 호출 버튼 2개 추가 -->
        <div id="ai-trigger-btns" style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">
            <button onclick="triggerScheduleAI()" style="padding: 10px 15px; border-radius: 8px; border: none; background: rgba(76, 175, 80, 0.8); color: white; cursor: pointer; font-weight: bold;">📅 스케줄 피드백 받기</button>
            <button onclick="triggerMusicAI()" style="padding: 10px 15px; border-radius: 8px; border: none; background: rgba(33, 150, 243, 0.8); color: white; cursor: pointer; font-weight: bold;">🎵 추천 음악 보기</button>
        </div>
```

---

## 2. 자바스크립트 수정 상세 (`script.js`)

1) 날씨 획득 부분 하단에 전역 저장 코드 추가:
```javascript
        const temp = data.current.temperature_2m;
        const weatherCode = data.current.weather_code;
        
        // 전역 변수에 날씨 정보 포맷팅하여 저장
        window.currentWeatherInfo = "기온 " + temp + "도, 날씨 코드 " + weatherCode;
```

2) 프롬프트를 기존 채팅 흐름(제출 이벤트)으로 흘려보내기 위해 다음과 같이 `userInput` 필드에 값을 주입하고 `chatForm` 제출 이벤트를 강제로 발생시킵니다.
```javascript
function triggerMusicAI() {
    if (!window.currentWeatherInfo) return alert("날씨 정보를 불러오는 중입니다.");
    
    const prompt = `현재 우리 동네 날씨는 [${window.currentWeatherInfo}]야. 이 날씨 분위기에 어울리는 음악 장르 3개와 유튜브에 검색하기 좋은 키워드 1개를 추천해 줘. 불필요한 서론 없이 결과만 아주 짧고 예쁘게 정리해서 출력해.`;
    
    // 입력창에 프롬프트를 주입하고 폼 전송을 트리거합니다.
    userInput.value = prompt;
    chatForm.dispatchEvent(new Event('submit'));
}

function triggerScheduleAI() {
    if (!window.currentWeatherInfo) return alert("날씨 정보를 불러오는 중입니다.");
    
    const userPlan = userInput ? userInput.value : "";
    
    if (!userPlan || userPlan.trim() === "") {
        alert("채팅창에 먼저 오늘 일정이나 기분을 적어주세요! (예: 오늘 한강 데이트 있어)");
        return;
    }

    const prompt = `현재 우리 동네 날씨는 [${window.currentWeatherInfo}]야. 내 계획/기분은 "${userPlan}"이야. 날씨 데이터를 기반으로 이 계획에 대한 활동 지수와 스케줄 피드백을 2~3문장으로 짧고 다정하게 조언해 줘.`;
    
    // 입력창의 내용을 프롬프트로 덮어쓰고 폼 전송을 트리거합니다.
    userInput.value = prompt;
    chatForm.dispatchEvent(new Event('submit'));
}
```

---

## 검증 계획
1. 새로고침 후 위젯 하단에 "📅 스케줄 피드백 받기", "🎵 추천 음악 보기" 버튼이 잘 나오는지 확인.
2. 입력 필드를 비운 채로 "📅 스케줄 피드백 받기" 클릭 시 입력 경고창이 뜨는지 확인.
3. 입력 필드에 계획 입력 후 버튼 클릭 시, 날씨 정보와 결합된 프롬프트가 챗봇에 잘 전송 및 응답되는지 확인.
4. "🎵 추천 음악 보기" 버튼 클릭 시, 날씨 정보와 결합된 음악 추천 프롬프트가 챗봇에 자동 전송 및 응답되는지 확인.
