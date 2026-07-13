// script.js - 프론트엔드 API 호출 및 UI 제어 스크립트

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
