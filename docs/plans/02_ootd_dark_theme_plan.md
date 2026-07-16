# 다크 테마 OOTD 위젯 및 로직 세분화 구현 계획서

체이스, OOTD 위젯을 어두운 배경 디자인(다크 테마)에 어울리도록 수정하고 날씨/기온에 따른 의상 추천 로직을 더 세밀하게 정교화하는 계획서입니다.

## 수정 대상 파일
1. **[index.html](file:///c:/Users/user/Desktop/날씨AI/index.html)**: 기존 OOTD 위젯을 다크 테마 스타일을 반영한 코드로 교체합니다.
2. **[script.js](file:///c:/Users/user/Desktop/날씨AI/script.js)**: 기존 `updateOOTDWidget()` 함수를 지우고, 세분화된 조건문(23도 이상, 17도 이상 조건 추가 등)이 적용된 새 함수로 대체합니다.

---

## 1. HTML 수정 상세 (`index.html`)

기존에 추가되었던 위젯 영역을 다음 다크 테마용 위젯 영역으로 대체합니다.

```html
        <!-- 다크 테마 OOTD 위젯 -->
        <div id="ootd-widget" style="text-align: center; padding: 15px; background: rgba(255, 255, 255, 0.08); border-radius: 12px; margin: 15px 0; border: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; backdrop-filter: blur(10px);">
            <div id="pet-avatar" style="font-size: 2.5rem; margin-bottom: 8px;">⏳</div>
            <p id="ootd-text" style="margin: 0; font-size: 1.05rem; font-weight: 500;">현재 날씨를 분석 중입니다...</p>
        </div>
```

---

## 2. 자바스크립트 수정 상세 (`script.js`)

기존 `updateOOTDWidget()` 선언 및 호출 코드를 삭제하고 아래의 코드를 주입합니다.

```javascript
// 브라우저의 위치 정보를 기반으로 Open-Meteo 날씨 API를 호출하고 다크 테마 OOTD 위젯을 업데이트하는 함수
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

        // 강수 및 세밀한 기온 조건문
        if (rainCodes.includes(weatherCode)) {
            petIcon = "🐸☔"; ootdText = `현재 ${temp}도, 비가 와요! 우산과 레인부츠 챙기세요.`;
        } else if (snowCodes.includes(weatherCode)) {
            petIcon = "⛄🧣"; ootdText = `현재 ${temp}도, 눈이 와요! 미끄러지지 않게 주의하세요.`;
        } else if (temp >= 28) {
            petIcon = "🌞🩳"; ootdText = `현재 ${temp}도, 너무 더워요! 시원한 반팔과 반바지 추천.`;
        } else if (temp >= 23) {
            petIcon = "😎👕"; ootdText = `현재 ${temp}도, 꽤 덥습니다! 얇은 반팔이나 셔츠가 딱 좋아요.`;
        } else if (temp >= 17) {
            petIcon = "🐱🧥"; ootdText = `현재 ${temp}도, 선선해요. 가벼운 가디건이나 맨투맨을 입으세요.`;
        } else if (temp >= 10) {
            petIcon = "🦊🧥"; ootdText = `현재 ${temp}도, 쌀쌀해요. 자켓이나 트렌치코트를 걸치세요.`;
        } else {
            petIcon = "🐻🧣"; ootdText = `현재 ${temp}도, 춥습니다! 패딩과 목도리로 꽁꽁 싸매세요.`;
        }

        document.getElementById('pet-avatar').innerText = petIcon;
        document.getElementById('ootd-text').innerText = ootdText;
    }, (error) => {
        document.getElementById('ootd-text').innerText = "위치 권한을 허용해 주셔야 날씨 확인이 가능합니다.";
    });
}

// 앱 실행 시 위젯 업데이트 호출
updateOOTDWidget();
```

---

## 검증 계획
1. 새로고침 후 다크 테마 스타일(반투명 블러 및 둥근 테두리)이 적용된 로딩 상태 확인.
2. 위치 동의 후 세분화된 조건(예: 17~23도 사이 구간 등)의 텍스트가 정상 노출되는지 확인.
3. 권한 차단 시 다크 테마 박스 내에 오류 텍스트 노출 확인.
