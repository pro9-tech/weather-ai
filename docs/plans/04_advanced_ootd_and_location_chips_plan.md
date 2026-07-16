# OOTD 이모티콘 분리, 음악 추천 포맷 고정 및 동적 위치 칩 구현 계획서

체이스, 날씨 이모티콘 분리, 음악 추천의 유튜브 링크 양식 고정, 그리고 사용자가 최근 검색한 위치 기반으로 동적으로 칩 버튼이 업데이트되도록 하는 기획 및 구현 계획서입니다.

## 수정 대상 파일
1. **[index.html](file:///c:/Users/user/Desktop/날씨AI/index.html)**: 
   * 하드코딩 되어있던 빠른 질문용 추천 칩 3개를 제거하고 동적으로 버튼이 렌더링될 `<div id="location-chips">` 빈 컨테이너를 배치합니다.
2. **[script.js](file:///c:/Users/user/Desktop/날씨AI/script.js)**:
   * **OOTD 이모티콘 3단 분리**: `updateOOTDWidget()` 내 조건문 조건과 이모티콘 표기법(`${weatherEmoji} ${topEmoji} ${bottomEmoji}`)을 업데이트합니다.
   * **유튜브 포맷팅**: `triggerMusicAI()` 함수 내부의 지시 프롬프트 포맷을 고정합니다.
   * **동적 위치 칩**: 최근 위치 관리 배열(`recentLocations`), 동적 렌더링 함수(`renderLocationButtons`), 검색어 필터링 및 갱신 함수(`updateRecentLocations`)를 작성하고 폼 제출 이벤트와 로딩 플로우에 연동합니다.

---

## 1. HTML 수정 상세 (`index.html`)

하드코딩된 프리셋 추천 칩들을 모두 제거하고 빈 컨테이너를 배치합니다.

```html
            <!-- 빠른 질문용 추천 칩 (동적 위치 칩으로 변경) -->
            <div id="location-chips" style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;"></div>
```

---

## 2. 자바스크립트 수정 상세 (`script.js`)

1) 최상단에 최근 검색 위치 관리 배열과 초기화 함수 추가:
```javascript
let recentLocations = ['서울 마포구', '부산 해운대', '제주 제주시'];

function renderLocationButtons() {
    const container = document.getElementById('location-chips');
    if(!container) return;
    container.innerHTML = recentLocations.map(loc => 
        `<button type="button" onclick="document.querySelector('input[type=text]').value='${loc} 날씨 알려줘'; document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));" style="padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 0.85rem;">📍 ${loc}</button>`
    ).join('');
}

// 초기 버튼 렌더링 등록
window.addEventListener('DOMContentLoaded', renderLocationButtons);

// 최근 검색 위치 업데이트 함수
function updateRecentLocations(userInputText) {
    const words = userInputText.trim().split(' ');
    if (words.length >= 2 && (words[0].endsWith('시') || words[0].endsWith('도') || words[0].endsWith('서울') || words[0].endsWith('부산'))) {
        const newLoc = `${words[0]} ${words[1]}`.replace('날씨','').replace('어때','').trim();
        if (newLoc.length > 2 && !recentLocations.includes(newLoc)) {
            recentLocations.unshift(newLoc);
            if (recentLocations.length > 4) recentLocations.pop();
            renderLocationButtons();
        }
    }
}
```

2) `updateOOTDWidget()` 조건문 부분을 이모티콘 3단 분리 로직으로 수정.
3) `triggerMusicAI()` 내부 프롬프트 문자열 수정.
4) 폼 제출 이벤트 핸들러(`chatForm.addEventListener('submit')`) 시작 시점에 `updateRecentLocations(message);`를 추가하여 검색 이력을 반영합니다.

---

## 검증 계획
1. 새로고침 시 초기 3개 지역(서울 마포구, 부산 해운대, 제주 제주시)이 동적 칩으로 생성되는지 확인.
2. 음악 추천 버튼 클릭 시 AI가 정확한 유튜브 주소 포맷(results?search_query=...)으로 3곡을 답변하는지 확인.
3. 입력창에 "대구 수성구 날씨 알려줘" 입력 및 제출 시, 칩 목록 맨 처음에 "대구 수성구"가 실시간 추가되고 클릭 시 다시 제출되는지 확인.
