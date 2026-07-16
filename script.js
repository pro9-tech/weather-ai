// script.js - 프론트엔드 API 호출 및 UI 제어 스크립트

let recentLocations = ['서울 마포구', '부산 해운대', '제주 제주시'];

function renderLocationButtons() {
    const container = document.getElementById('location-chips');
    if(!container) return;
    container.innerHTML = recentLocations.map(loc => 
        `<button type="button" onclick="document.querySelector('input[type=text]').value='${loc} 날씨 알려줘'; document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));" style="padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 0.85rem;">📍 ${loc}</button>`
    ).join('');
}

// 초기 버튼 렌더링
window.addEventListener('DOMContentLoaded', renderLocationButtons);

// 최근 검색어 업데이트 로직
function updateRecentLocations(userInputText) {
    const words = userInputText.trim().split(' ');
    // 대략적인 지역명 형태(시, 구, 동)를 감지하여 추출
    if (words.length >= 2 && (words[0].endsWith('시') || words[0].endsWith('도') || words[0].endsWith('서울') || words[0].endsWith('부산'))) {
        const newLoc = `${words[0]} ${words[1]}`.replace('날씨','').replace('어때','').trim();
        if (newLoc.length > 2 && !recentLocations.includes(newLoc)) {
            recentLocations.unshift(newLoc); // 맨 앞에 추가
            if (recentLocations.length > 4) recentLocations.pop(); // 4개 초과 시 마지막 제거
            renderLocationButtons();
        }
    }
}

const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatContainer = document.getElementById('chatContainer');
const sendBtn = document.getElementById('sendBtn');

// 화면 하단으로 자동 스크롤
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 프리셋 추천 칩 클릭 시 즉시 질문 전송
function sendPreset(text) {
    userInput.value = text;
    // 폼 제출 트리거
    chatForm.dispatchEvent(new Event('submit'));
}

// 말풍선 추가 함수 (type: 'user' 또는 'ai')
function appendMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${type}-message`);

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.innerText = type === 'user' ? '👤' : '🤖';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble');
    // 개행문자를 <br>로 변경하여 줄바꿈 표시 지원
    bubbleDiv.innerHTML = text.replace(/\n/g, '<br>');

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
    
    scrollToBottom();
    return messageDiv;
}

// 로딩 중 표시 추가 및 제거
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'ai-message', 'loading-msg');

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.innerText = '🤖';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble');
    bubbleDiv.innerHTML = `
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    loadingDiv.appendChild(avatarDiv);
    loadingDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(loadingDiv);
    scrollToBottom();
    return loadingDiv;
}

// 폼 제출 이벤트 핸들러
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // 최근 검색어 업데이트 로직 수행
    updateRecentLocations(message);

    // 입력창 비우기 및 UI에 사용자 메시지 추가
    userInput.value = '';
    appendMessage(message, 'user');

    // 로딩 말풍선 표시
    const loadingBubble = showLoading();
    userInput.disabled = true;
    sendBtn.disabled = true;

    try {
        // 백엔드 Vercel Serverless Function 호출
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        // 로딩 말풍선 제거
        loadingBubble.remove();

        if (response.ok) {
            const data = await response.json();
            appendMessage(data.reply, 'ai');
        } else {
            const errData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
            appendMessage(`⚠️ 오류가 발생했습니다: ${errData.error || '서버 응답 실패'}`, 'ai');
        }
    } catch (error) {
        if (loadingBubble) loadingBubble.remove();
        console.error('Fetch error:', error);
        appendMessage('⚠️ 네트워크 연결에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'ai');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
});

// 브라우저 위치 기반으로 Open-Meteo를 호출하여 날씨와 기온에 맞게 위젯을 업데이트하는 함수
function updateOOTDWidget() {
    navigator.geolocation.getCurrentPosition(async (position) => {
        // 위도와 경도 정보 획득
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Open-Meteo 날씨 API 호출
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        const data = await res.json();
        
        const temp = data.current.temperature_2m;
        const weatherCode = data.current.weather_code;

        // 전역 변수에 현재 날씨 정보를 포맷팅하여 저장합니다.
        window.currentWeatherInfo = "기온 " + temp + "도, 날씨 코드 " + weatherCode;
        
        let weatherEmoji = "☁️", topEmoji = "👕", bottomEmoji = "👖", ootdText = "";
        const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
        const snowCodes = [71, 73, 75, 77, 85, 86];

        // 날씨 이모티콘
        if (rainCodes.includes(weatherCode)) weatherEmoji = "🌧️";
        else if (snowCodes.includes(weatherCode)) weatherEmoji = "❄️";
        else if (weatherCode === 0) weatherEmoji = "☀️";
        else weatherEmoji = "☁️";

        // 옷차림 이모티콘 및 텍스트
        if (temp >= 28) { topEmoji = "👕"; bottomEmoji = "🩳"; ootdText = `현재 ${temp}도, 너무 더워요! 반팔과 반바지 추천.`; }
        else if (temp >= 20) { topEmoji = "👕"; bottomEmoji = "👖"; ootdText = `현재 ${temp}도, 선선해요. 얇은 긴팔이나 반팔이 좋아요.`; }
        else if (temp >= 15) { topEmoji = "🧶"; bottomEmoji = "👖"; ootdText = `현재 ${temp}도, 쌀쌀해요. 스웨터나 맨투맨을 추천해요.`; }
        else if (temp >= 5) { topEmoji = "🧥"; bottomEmoji = "👖"; ootdText = `현재 ${temp}도, 춥습니다. 가디건이나 자켓을 걸치세요.`; }
        else { topEmoji = "🧥"; bottomEmoji = "👖"; ootdText = `현재 ${temp}도, 춥습니다! 두꺼운 코트나 패딩을 입으세요.`; }

        // 화면 위젯 업데이트
        document.getElementById('pet-avatar').innerText = `${weatherEmoji} ${topEmoji} ${bottomEmoji}`;
        document.getElementById('ootd-text').innerText = ootdText;
    }, (error) => {
        // 에러 발생 시(위치 권한 거부 등) 예외 문구 출력
        document.getElementById('ootd-text').innerText = "위치 권한을 허용해 주셔야 날씨 확인이 가능합니다.";
    });
}

// 페이지 로드 시 실행되도록 연동
updateOOTDWidget();

// 음악 추천 AI 버튼 트리거 함수
function triggerMusicAI() {
    if (!window.currentWeatherInfo) return alert("날씨 정보를 불러오는 중입니다.");
    
    // AI 토큰 절약을 위한 뼈대 프롬프트 조립 및 형식 제한
    const prompt = `현재 우리 동네 날씨는 [${window.currentWeatherInfo}]야. 이 날씨에 어울리는 음악 3곡을 추천해 줘. 반드시 아래 형식에 맞춰서 작성해. 부가 설명은 절대 쓰지 마.
형식: [장르] 아티스트명 - 곡명 (https://www.youtube.com/results?search_query=아티스트명+곡명)`;
    
    // 입력창에 프롬프트를 주입하고 기존 전송(submit) 로직을 강제로 실행합니다.
    userInput.value = prompt;
    chatForm.dispatchEvent(new Event('submit'));
}

// 일정 피드백 AI 버튼 트리거 함수
function triggerScheduleAI() {
    if (!window.currentWeatherInfo) return alert("날씨 정보를 불러오는 중입니다.");
    
    // 사용자가 입력창에 적은 계획 가져오기
    const userPlan = userInput ? userInput.value : "";
    
    if (!userPlan || userPlan.trim() === "") {
        alert("채팅창에 먼저 오늘 일정이나 기분을 적어주세요! (예: 오늘 한강 데이트 있어)");
        return;
    }

    // AI 토큰 절약을 위한 뼈대 프롬프트 조립
    const prompt = `현재 우리 동네 날씨는 [${window.currentWeatherInfo}]야. 내 계획/기분은 "${userPlan}"이야. 날씨 데이터를 기반으로 이 계획에 대한 활동 지수와 스케줄 피드백을 2~3문장으로 짧고 다정하게 조언해 줘.`;
    
    // 입력창의 내용을 프롬프트로 덮어쓰고 폼 전송을 트리거합니다.
    userInput.value = prompt;
    chatForm.dispatchEvent(new Event('submit'));
}
