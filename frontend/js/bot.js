// Mental Health Chat Bot UI & API Integration

const BOT_API_URL = '/api/bot/chat';

function createBotChatUI() {
    const container = document.createElement('div');
    container.id = 'bot-chat-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.width = '350px';
    container.style.maxHeight = '500px';
    container.style.background = '#fff';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';

    const header = document.createElement('div');
    header.textContent = 'Mental Health Chat Bot';
    header.style.background = '#4e54c8';
    header.style.color = '#fff';
    header.style.padding = '12px';
    header.style.fontWeight = 'bold';
    header.style.textAlign = 'center';
    container.appendChild(header);

    const chatArea = document.createElement('div');
    chatArea.id = 'bot-chat-area';
    chatArea.style.flex = '1';
    chatArea.style.padding = '12px';
    chatArea.style.overflowY = 'auto';
    container.appendChild(chatArea);

    const inputArea = document.createElement('div');
    inputArea.style.display = 'flex';
    inputArea.style.padding = '10px';
    inputArea.style.borderTop = '1px solid #eee';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type your problem...';
    input.style.flex = '1';
    input.style.padding = '8px';
    input.style.borderRadius = '5px';
    input.style.border = '1px solid #ccc';
    inputArea.appendChild(input);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.marginLeft = '8px';
    sendBtn.style.padding = '8px 16px';
    sendBtn.style.background = '#4e54c8';
    sendBtn.style.color = '#fff';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '5px';
    sendBtn.style.cursor = 'pointer';
    inputArea.appendChild(sendBtn);

    container.appendChild(inputArea);
    document.body.appendChild(container);

    sendBtn.onclick = async () => {
        const message = input.value.trim();
        if (!message) return;
        appendMessage('You', message);
        input.value = '';
        // Send to backend
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(BOT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.success) {
                appendMessage(data.bot, data.response, true);
            } else {
                appendMessage('Bot', 'Sorry, I could not respond right now.', true);
            }
        } catch {
            appendMessage('Bot', 'Network error. Please try again.', true);
        }
    };

    function appendMessage(sender, text, isBot = false) {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '10px';
        msgDiv.style.textAlign = isBot ? 'left' : 'right';
        msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        chatArea.appendChild(msgDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Auto-initialize on dashboard page
if (window.location.pathname === '/dashboard') {
    document.addEventListener('DOMContentLoaded', createBotChatUI);
}