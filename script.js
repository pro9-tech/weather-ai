document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatHistory = document.getElementById('chat-history');
    const chipGroup = document.getElementById('chip-group');

    const weatherSummary = document.getElementById('weather-summary');
    const weatherIcon = document.getElementById('weather-icon');
    const topIcon = document.getElementById('top-icon');
    const bottomIcon = document.getElementById('bottom-icon');

    function addLocationChip(locationName) {
        if (!locationName || !chipGroup) return;
        const existingChips = Array.from(chipGroup.querySelectorAll('.chip'));
        existingChips.forEach(chip => {
            const text = chip.textContent.replace('📍', '').trim();
            if (text === locationName.trim()) chip.remove();
        });
        const newChip = document.createElement('button');
        newChip.type = 'button';
        newChip.className = 'chip location-chip';
        newChip.innerHTML = `📍 ${locationName}`;
        newChip.addEventListener('click', () => {
            userInput.value = `${locationName} 날씨 알려줘`;
            sendMessage(`${locationName} 날씨 알려줘`);
        });
        chipGroup.appendChild(newChip);
        const updatedChips = chipGroup.querySelectorAll('.chip');
        if (updatedChips.length > 4) updatedChips[0].remove();
    }

    if (chipGroup) {
        const initialChips = chipGroup.querySelectorAll('.chip');
        initialChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.textContent.replace('📍', '').trim();
                userInput.value = `${text} 날씨 알려줘`;
                sendMessage(`${text} 날씨 알려줘`);
            });
        });
    }

    function appendMessage(text, sender) {
        const rowDiv = document.createElement('div');
        rowDiv.className = `message-row ${sender}`;
        if (sender === 'ai') {
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar';
            avatarDiv.innerText = '🤖';
            rowDiv.appendChild(avatarDiv);
        }
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-bubble';
        msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        rowDiv.appendChild(msgDiv);
        chatHistory.appendChild(rowDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return rowDiv;
    }

    async function sendMessage(messageText, isSilent = false, lat = null, lon = null) {
        if (!messageText.trim()) return;
        if (!isSilent) appendMessage(messageText, 'user');
        userInput.value = '';

        const loadingBubble = isSilent ? null : appendMessage('요청을 처리 중입니다...', 'ai');

        try {
            const bodyData = { message: messageText };
            if (lat && lon) {
                bodyData.lat = lat;
                bodyData.lon = lon;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();
            if (loadingBubble) loadingBubble.remove();

            if (data.reply) {
                if (!isSilent) appendMessage(data.reply, 'ai');
                if (weatherSummary && data.summary) weatherSummary.innerHTML = data.summary;
                if (weatherIcon && data.weatherIcon) weatherIcon.innerHTML = data.weatherIcon;
                if (topIcon && data.topIcon) { topIcon.innerHTML = data.topIcon; topIcon.style.display = 'block'; }
                if (bottomIcon && data.bottomIcon) { bottomIcon.innerHTML = data.bottomIcon; bottomIcon.style.display = 'block'; }
                if (data.location && !isSilent) addLocationChip(data.location);
            } else {
                if (!isSilent) appendMessage(data.error || '답변을 불러오지 못했습니다.', 'ai');
            }
        } catch (err) {
            if (loadingBubble) loadingBubble.remove();
            if (!isSilent) appendMessage('서버와 통신하는 중 에러가 발생했습니다.', 'ai');
        }
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(userInput.value);
        });
    }

    // 💡 버튼 2개 클릭 이벤트 추가 완료
    const btnSchedule = document.querySelector('.btn-schedule');
    const btnMusic = document.querySelector('.btn-music');

    if (btnSchedule) {
        btnSchedule.addEventListener('click', () => {
            // 입력창에 적어둔 글이 있으면 그걸 포함해서 보내고, 없으면 기본 양식을 채워줌
            const currentVal = userInput.value.trim();
            if (currentVal) {
                sendMessage(`${currentVal} - 이 스케줄에 대한 날씨 피드백 부탁해`);
            } else {
                userInput.value = "오늘 오후 3시 외부 미팅 있어. 날씨 대비 스케줄 팁 알려줘.";
                userInput.focus();
            }
        });
    }

    if (btnMusic) {
        btnMusic.addEventListener('click', () => {
            sendMessage("현재 날씨에 딱 어울리는 음악 3곡 추천해 줘. (장르, 곡명, 유튜브 주소 포함)");
        });
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                sendMessage('현재 내 위치 날씨 알려줘', true, lat, lon);
            },
            (error) => {
                console.warn('위치 권한 거부됨:', error.message);
                alert("브라우저 위치 권한이 차단되어 있습니다. 주소창 좌측의 자물쇠/주의 아이콘을 눌러 위치 권한을 '허용'해주세요.\n(기본 위치인 서울로 시작합니다.)");
                sendMessage('서울 마포구 현재 날씨 알려줘', true);
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        );
    } else {
        sendMessage('서울 마포구 현재 날씨 알려줘', true);
    }
});