# OOTD 날씨 위젯 구현 계획서

체이스, 요청하신 OOTD 날씨 위젯 추가 계획을 정리해 보았습니다. 토큰 절약을 위해 최소한의 파일인 `index.html`과 `script.js` 두 개만 수정하며, 기존 구조와 디자인을 그대로 보존합니다.

## 수정 대상 파일
1. **[index.html](file:///c:/Users/user/Desktop/날씨AI/index.html)**: `<main class="chat-wrapper">` 바로 위에 OOTD 위젯 HTML 코드를 추가합니다.
2. **[script.js](file:///c:/Users/user/Desktop/날씨AI/script.js)**: 위치 정보(Open-Meteo API)를 불러와 위젯에 OOTD와 기상 상태를 반영하는 자바스크립트 함수를 추가하고 이를 실행합니다.

---

## 1. HTML 수정 상세 (`index.html`)

`<main class="chat-wrapper">` (25번 라인)의 바로 윗부분에 위젯 코드를 삽입합니다.

```html
        <!-- OOTD 날씨 및 의상 추천 위젯 영역 -->
        <div id="ootd-widget" style="text-align: center; padding: 10px; background: #fff; border-radius: 10px; margin: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <span id="pet-avatar" style="font-size: 2rem;">⏳</span>
            <p id="ootd-text" style="margin: 5px 0; font-weight: bold; color: #333;">현재 위치 날씨를 확인 중입니다...</p>
        </div>

        <!-- 채팅창 영역 -->
        <main class="chat-wrapper">
```

---

## 2. 자바스크립트 수정 상세 (`script.js`)

파일의 가장 마지막 라인 아래에 요청하신 Open-Meteo 호출 및 조건문 로직을 주입합니다.

```javascript
// 브라우저 위치 정보 제공 동의를 얻어 Open-Meteo 날씨 데이터를 조회하고 위젯을 변경하는 함수
function updateOOTDWidget() {
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        const data = await res.json();
        
        const temp = data.current.temperature_2m;
        const weatherCode = data.current.weather_code;
        
        let petIcon = "🐶", ootdText = "";
        const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
        const snowCodes = [71, 73, 75, 77, 85, 86];

        if (rainCodes.includes(weatherCode)) { petIcon = "🐸☔"; ootdText = "비가 오고 있어요! 우산을 챙기세요."; } 
        else if (snowCodes.includes(weatherCode)) { petIcon = "⛄🧣"; ootdText = "눈이 내립니다! 미끄러지지 않게 주의하세요."; } 
        else if (temp >= 28) { petIcon = "🐶🩳"; ootdText = `현재 ${temp}도, 덥습니다! 시원한 옷차림 추천.`; } 
        else if (temp >= 20) { petIcon = "🐱👕"; ootdText = `현재 ${temp}도, 가벼운 가디건이 좋습니다.`; } 
        else if (temp >= 10) { petIcon = "🦊🧥"; ootdText = `현재 ${temp}도, 자켓을 걸치기 좋은 날씨입니다.`; } 
        else { petIcon = "🐻🧣"; ootdText = `현재 ${temp}도, 춥습니다! 패딩으로 따뜻하게 입으세요.`; }

        document.getElementById('pet-avatar').innerText = petIcon;
        document.getElementById('ootd-text').innerText = ootdText;
    }, (error) => {
        document.getElementById('ootd-text').innerText = "위치 권한을 허용해주세요.";
    });
}

// 앱 실행 시 위젯 업데이트 함수 호출
updateOOTDWidget();
```

---

## 검증 계획

1. 브라우저에서 날씨AI 페이지 새로고침 시 위치 권한 동의 팝업 확인.
2. 위치 권한 허용 시, 위젯 아이콘(⏳) 및 텍스트가 정상적으로 현재 지역의 날씨 상태 및 추천 OOTD 정보로 로드되는지 확인.
3. 위치 권한 거부 시, "위치 권한을 허용해주세요." 메시지로 부드럽게 변경되는지 확인.
