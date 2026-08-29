/* ===== App State ===== */
const state = {
    currentUser: null,
    currentChat: null,
    currentTab: 'chat',
    editingMsgId: null,
    contextMsgId: null,
    calcDisplay: '0',
    calcExpr: '',
    calcOp: null,
    calcPrev: null,
    calcReset: false,
};

/* ===== Storage Helpers ===== */
const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    },
    set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};

function getUsers() { return store.get('calc_users', {}); }
function saveUsers(u) { store.set('calc_users', u); }
function getFriends() {
    if (!state.currentUser) return [];
    return store.get('calc_friends_' + state.currentUser.id, []);
}
function saveFriends(list) {
    if (!state.currentUser) return;
    store.set('calc_friends_' + state.currentUser.id, list);
}
function getMessages(peerId) {
    if (!state.currentUser) return [];
    const key = 'calc_msgs_' + chatKey(state.currentUser.id, peerId);
    return store.get(key, []);
}
function saveMessages(peerId, msgs) {
    if (!state.currentUser) return;
    const key = 'calc_msgs_' + chatKey(state.currentUser.id, peerId);
    store.set(key, msgs);
}
function chatKey(a, b) { return [a, b].sort().join('_'); }

/* ===== Toast ===== */
let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'toastIn 0.2s';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 1800);
}

/* ===== Calculator Logic ===== */
function initCalculator() {
    const exprEl = document.getElementById('calc-expr');
    const resultEl = document.getElementById('calc-result');

    document.querySelectorAll('.calc-buttons button').forEach(btn => {
        btn.addEventListener('click', () => handleCalcButton(btn));
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('calculator-view').style.display === 'none') return;
        const key = e.key;
        if (key >= '0' && key <= '9') calcInputNumber(key);
        else if (key === '.') calcInputDecimal();
        else if (key === '+') calcInputOp('+');
        else if (key === '-') calcInputOp('-');
        else if (key === '*') calcInputOp('*');
        else if (key === '/') { e.preventDefault(); calcInputOp('/'); }
        else if (key === 'Enter' || key === '=') calcEquals();
        else if (key === 'Escape') calcClear();
        else if (key === 'Backspace') calcBackspace();
        else if (key === '%') calcPercent();
        updateCalcDisplay();
    });
}

function handleCalcButton(btn) {
    const action = btn.dataset.action;
    const value = btn.dataset.value;

    switch (action) {
        case 'number': calcInputNumber(value); break;
        case 'decimal': calcInputDecimal(); break;
        case 'operator': calcInputOp(value); break;
        case 'equals': calcEquals(); break;
        case 'clear': calcClear(); break;
        case 'toggle-sign': calcToggleSign(); break;
        case 'percent': calcPercent(); break;
    }
    updateCalcDisplay();
}

function calcInputNumber(n) {
    if (state.calcReset) {
        state.calcDisplay = n;
        state.calcReset = false;
    } else {
        state.calcDisplay = state.calcDisplay === '0' ? n : state.calcDisplay + n;
    }
}

function calcInputDecimal() {
    if (state.calcReset) {
        state.calcDisplay = '0.';
        state.calcReset = false;
    } else if (!state.calcDisplay.includes('.')) {
        state.calcDisplay += '.';
    }
}

function calcInputOp(op) {
    if (state.calcOp && !state.calcReset) {
        calcEquals(true);
    }
    state.calcPrev = parseFloat(state.calcDisplay);
    state.calcOp = op;
    state.calcExpr = state.calcDisplay + ' ' + opSymbol(op);
    state.calcReset = true;
}

function calcEquals(chaining) {
    /* === Secret Password Check === */
    if (!chaining && state.calcDisplay === '1314' && !state.calcOp) {
        enterApp();
        calcFullReset();
        return;
    }

    if (state.calcOp === null) return;
    const curr = parseFloat(state.calcDisplay);
    const prev = state.calcPrev;
    let result;

    switch (state.calcOp) {
        case '+': result = prev + curr; break;
        case '-': result = prev - curr; break;
        case '*': result = prev * curr; break;
        case '/': result = curr === 0 ? 'Error' : prev / curr; break;
    }

    if (typeof result === 'number') {
        result = Math.round(result * 1e10) / 1e10;
    }

    if (!chaining) {
        state.calcExpr = prev + ' ' + opSymbol(state.calcOp) + ' ' + curr + ' =';
    }

    state.calcDisplay = String(result);
    if (!chaining) {
        state.calcOp = null;
        state.calcPrev = null;
    }
    state.calcReset = true;
}

function calcClear() {
    calcFullReset();
    updateCalcDisplay();
}

function calcFullReset() {
    state.calcDisplay = '0';
    state.calcExpr = '';
    state.calcOp = null;
    state.calcPrev = null;
    state.calcReset = false;
}

function calcToggleSign() {
    if (state.calcDisplay !== '0') {
        state.calcDisplay = state.calcDisplay.startsWith('-')
            ? state.calcDisplay.slice(1)
            : '-' + state.calcDisplay;
    }
}

function calcPercent() {
    state.calcDisplay = String(parseFloat(state.calcDisplay) / 100);
}

function calcBackspace() {
    if (state.calcReset) return;
    state.calcDisplay = state.calcDisplay.length > 1
        ? state.calcDisplay.slice(0, -1)
        : '0';
}

function opSymbol(op) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op;
}

function updateCalcDisplay() {
    document.getElementById('calc-expr').textContent = state.calcExpr;
    const display = state.calcDisplay;
    const resultEl = document.getElementById('calc-result');
    resultEl.textContent = display;
    resultEl.style.fontSize = display.length > 10 ? '32px' : display.length > 7 ? '40px' : '48px';
}

/* ===== App Entry ===== */
function enterApp() {
    const session = store.get('calc_session', null);
    if (session) {
        const users = getUsers();
        if (users[session.id]) {
            state.currentUser = users[session.id];
            showAppView();
            return;
        }
    }
    document.getElementById('modal-login').style.display = 'flex';
    showAppView();
}

function showAppView() {
    document.getElementById('calculator-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';
    switchTab('chat');
    renderProfile();
}

/* ===== Tab Navigation ===== */
function initTabs() {
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            const name = tab.dataset.tab;
            switchTab(name);
        });
    });
}

function switchTab(name) {
    state.currentTab = name;
    document.querySelectorAll('.tab-item').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
    });

    const views = { chat: 'view-chat-list', friends: 'view-add-friend', profile: 'view-profile' };
    Object.values(views).forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(views[name]).style.display = 'block';

    document.getElementById('view-chat-window').style.display = 'none';
    state.currentChat = null;
    state.editingMsgId = null;
    document.getElementById('btn-edit-msg').style.display = 'none';
    document.getElementById('message-input').placeholder = '输入消息...';

    const titles = { chat: '主客厅', friends: '昏光庭院', profile: '我的' };
    document.getElementById('header-title').textContent = titles[name];
    document.getElementById('header-back').style.display = 'none';
    document.getElementById('tab-bar').style.display = 'flex';

    if (name === 'chat') renderChatList();
    if (name === 'friends') renderFriendList();
    if (name === 'profile') renderProfile();
}

/* ===== Auth ===== */
function initAuth() {
    document.getElementById('btn-do-login').addEventListener('click', doLogin);
    document.getElementById('login-pwd').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doLogin();
    });

    document.getElementById('btn-do-change-pwd').addEventListener('click', doChangePwd);
    document.getElementById('pwd-cancel').addEventListener('click', () => {
        document.getElementById('modal-change-pwd').style.display = 'none';
    });
    document.getElementById('btn-change-pwd').addEventListener('click', () => {
        document.getElementById('modal-change-pwd').style.display = 'flex';
        document.getElementById('old-pwd').value = '';
        document.getElementById('new-pwd').value = '';
        document.getElementById('confirm-pwd').value = '';
        document.getElementById('pwd-error').style.display = 'none';
    });
    document.getElementById('btn-logout').addEventListener('click', doLogout);
}

function doLogin() {
    const id = document.getElementById('login-id').value.trim();
    const pwd = document.getElementById('login-pwd').value;
    const errEl = document.getElementById('login-error');

    if (!id || !pwd) {
        errEl.textContent = '请输入账号和密码';
        errEl.style.display = 'block';
        return;
    }

    const users = getUsers();
    if (!users[id]) {
        errEl.textContent = '账号不存在';
        errEl.style.display = 'block';
        return;
    }
    if (users[id].password !== pwd) {
        errEl.textContent = '密码错误';
        errEl.style.display = 'block';
        return;
    }

    state.currentUser = users[id];
    store.set('calc_session', { id: id });
    document.getElementById('modal-login').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-id').value = '';
    document.getElementById('login-pwd').value = '';
    renderProfile();
    renderChatList();
    showToast('登录成功');
}

function doChangePwd() {
    const oldPwd = document.getElementById('old-pwd').value;
    const newPwd = document.getElementById('new-pwd').value;
    const confirmPwd = document.getElementById('confirm-pwd').value;
    const errEl = document.getElementById('pwd-error');

    if (!oldPwd || !newPwd || !confirmPwd) {
        errEl.textContent = '请填写所有字段';
        errEl.style.display = 'block';
        return;
    }
    if (oldPwd !== state.currentUser.password) {
        errEl.textContent = '当前密码错误';
        errEl.style.display = 'block';
        return;
    }
    if (newPwd !== confirmPwd) {
        errEl.textContent = '两次输入的新密码不一致';
        errEl.style.display = 'block';
        return;
    }
    if (newPwd.length < 4) {
        errEl.textContent = '新密码至少4位';
        errEl.style.display = 'block';
        return;
    }

    const users = getUsers();
    users[state.currentUser.id].password = newPwd;
    saveUsers(users);
    state.currentUser.password = newPwd;

    document.getElementById('modal-change-pwd').style.display = 'none';
    showToast('密码修改成功');
}

function doLogout() {
    state.currentUser = null;
    state.currentChat = null;
    store.remove('calc_session');
    document.getElementById('app-view').style.display = 'none';
    document.getElementById('calculator-view').style.display = 'flex';
    calcFullReset();
    updateCalcDisplay();
    showToast('已退出登录');
}

/* ===== Chat List ===== */
function renderChatList() {
    const container = document.getElementById('chat-list');
    const friends = getFriends();

    if (friends.length === 0) {
        container.innerHTML = `<div class="empty-hint">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>暂无聊天</p>
            <p class="empty-sub">去「昏光庭院」添加好友开始聊天吧</p>
        </div>`;
        return;
    }

    const users = getUsers();
    let html = '';

    friends.forEach(fid => {
        const friend = users[fid];
        if (!friend) return;
        const msgs = getMessages(fid);
        const lastMsg = msgs.filter(m => !m.revoked).slice(-1)[0];
        const lastText = lastMsg ? (lastMsg.revoked ? '消息已撤回' : lastMsg.text) : '暂无消息';
        const lastTime = lastMsg ? formatTime(lastMsg.time) : '';
        const initial = friend.id.charAt(0).toUpperCase();
        const online = isOnline(fid) ? '<div class="online-dot"></div>' : '<div class="offline-dot"></div>';

        html += `<div class="chat-item" data-friend="${fid}">
            <div class="chat-avatar">${initial}${online}</div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(friend.id)}</div>
                <div class="chat-last-msg">${escapeHtml(lastText)}</div>
            </div>
            <div class="chat-time">${lastTime}</div>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => openChat(item.dataset.friend));
    });
}

/* ===== Chat Window ===== */
function openChat(friendId) {
    state.currentChat = friendId;
    const users = getUsers();
    const friend = users[friendId];
    if (!friend) return;

    document.getElementById('view-chat-list').style.display = 'none';
    document.getElementById('view-chat-window').style.display = 'flex';
    document.getElementById('tab-bar').style.display = 'none';
    document.getElementById('header-back').style.display = 'flex';
    document.getElementById('header-title').textContent = friend.id;

    renderMessages();

    const input = document.getElementById('message-input');
    input.value = '';
    input.focus();
}

function renderMessages() {
    if (!state.currentChat) return;
    const container = document.getElementById('messages-container');
    const msgs = getMessages(state.currentChat);
    const users = getUsers();

    if (msgs.length === 0) {
        container.innerHTML = '<div class="msg-time-hint">开始聊天吧</div>';
        return;
    }

    let html = '';
    let lastDate = '';

    msgs.forEach(msg => {
        const msgDate = new Date(msg.time).toLocaleDateString('zh-CN');
        if (msgDate !== lastDate) {
            html += `<div class="msg-time-hint">${msgDate}</div>`;
            lastDate = msgDate;
        }

        const isMine = msg.from === state.currentUser.id;
        const sender = users[msg.from];
        const initial = (sender ? msg.from : '?').charAt(0).toUpperCase();
        const editedClass = msg.edited ? ' edited' : '';
        const revokedClass = msg.revoked ? ' revoked' : '';
        const displayText = msg.revoked ? '消息已撤回' : escapeHtml(msg.text);

        html += `<div class="msg-row ${isMine ? 'mine' : 'other'}">
            <div class="msg-avatar">${initial}</div>
            <div class="msg-bubble${editedClass}${revokedClass}" data-msgid="${msg.id}">${displayText}</div>
        </div>`;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;

    container.querySelectorAll('.msg-bubble:not(.revoked)').forEach(bubble => {
        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, bubble.dataset.msgid);
        });
        bubble.addEventListener('click', (e) => {
            if (e.detail === 2) {
                showContextMenu(e, bubble.dataset.msgid);
            }
        });

        let pressTimer;
        bubble.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                showContextMenu(e.touches[0], bubble.dataset.msgid);
            }, 500);
        });
        bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
        bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
    });
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !state.currentChat) return;

    const msgs = getMessages(state.currentChat);

    if (state.editingMsgId) {
        const idx = msgs.findIndex(m => m.id === state.editingMsgId);
        if (idx !== -1) {
            msgs[idx].text = text;
            msgs[idx].edited = true;
        }
        state.editingMsgId = null;
        document.getElementById('btn-edit-msg').style.display = 'none';
        document.getElementById('message-input').placeholder = '输入消息...';
    } else {
        msgs.push({
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            from: state.currentUser.id,
            text: text,
            time: Date.now(),
            edited: false,
            revoked: false
        });
    }

    saveMessages(state.currentChat, msgs);
    input.value = '';
    renderMessages();
}

function showContextMenu(e, msgId) {
    const msgs = getMessages(state.currentChat);
    const msg = msgs.find(m => m.id === msgId);
    if (!msg || msg.revoked) return;

    state.contextMsgId = msgId;
    const menu = document.getElementById('msg-context-menu');
    const isMine = msg.from === state.currentUser.id;

    menu.querySelector('[data-ctx="edit"]').style.display = isMine ? 'flex' : 'none';
    menu.querySelector('[data-ctx="revoke"]').style.display = isMine ? 'flex' : 'none';

    const x = Math.min(e.clientX || e.pageX, window.innerWidth - 140);
    const y = Math.min(e.clientY || e.pageY, window.innerHeight - 150);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

function initContextMenu() {
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('msg-context-menu');
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    document.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.ctx;
            const msgId = state.contextMsgId;
            document.getElementById('msg-context-menu').style.display = 'none';

            if (!msgId || !state.currentChat) return;
            const msgs = getMessages(state.currentChat);
            const msg = msgs.find(m => m.id === msgId);
            if (!msg) return;

            switch (action) {
                case 'copy':
                    copyText(msg.text);
                    showToast('已复制');
                    break;
                case 'edit':
                    if (msg.from === state.currentUser.id) {
                        state.editingMsgId = msgId;
                        const input = document.getElementById('message-input');
                        input.value = msg.text;
                        input.focus();
                        document.getElementById('btn-edit-msg').style.display = 'flex';
                        document.getElementById('message-input').placeholder = '编辑消息...';
                    }
                    break;
                case 'revoke':
                    if (msg.from === state.currentUser.id) {
                        msg.revoked = true;
                        saveMessages(state.currentChat, msgs);
                        renderMessages();
                        showToast('已撤回');
                    }
                    break;
            }
        });
    });

    document.getElementById('btn-edit-msg').addEventListener('click', () => {
        state.editingMsgId = null;
        document.getElementById('message-input').value = '';
        document.getElementById('btn-edit-msg').style.display = 'none';
        document.getElementById('message-input').placeholder = '输入消息...';
    });
}

function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
}

/* ===== Friends ===== */
function initFriends() {
    document.getElementById('btn-add-friend').addEventListener('click', doAddFriend);
    document.getElementById('friend-id-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doAddFriend();
    });
}

function doAddFriend() {
    const input = document.getElementById('friend-id-input');
    const fid = input.value.trim();
    const resultEl = document.getElementById('add-friend-result');

    if (!fid) {
        showToast('请输入账号ID');
        return;
    }
    if (fid === state.currentUser.id) {
        showToast('不能添加自己');
        return;
    }

    const users = getUsers();
    if (!users[fid]) {
        resultEl.innerHTML = `<div class="friend-result-card">
            <div class="friend-avatar">?</div>
            <div class="result-info">
                <div class="result-name">${escapeHtml(fid)}</div>
                <div class="result-id">该用户不存在</div>
            </div>
        </div>`;
        return;
    }

    const friends = getFriends();
    if (friends.includes(fid)) {
        resultEl.innerHTML = `<div class="friend-result-card">
            <div class="friend-avatar">${fid.charAt(0).toUpperCase()}</div>
            <div class="result-info">
                <div class="result-name">${escapeHtml(fid)}</div>
                <div class="result-id">已是好友</div>
            </div>
        </div>`;
        return;
    }

    friends.push(fid);
    saveFriends(friends);

    const peerFriends = store.get('calc_friends_' + fid, []);
    if (!peerFriends.includes(state.currentUser.id)) {
        peerFriends.push(state.currentUser.id);
        store.set('calc_friends_' + fid, peerFriends);
    }

    resultEl.innerHTML = `<div class="friend-result-card">
        <div class="friend-avatar">${fid.charAt(0).toUpperCase()}</div>
        <div class="result-info">
            <div class="result-name">${escapeHtml(fid)}</div>
            <div class="result-id" style="color:var(--primary)">已添加为好友</div>
        </div>
    </div>`;

    input.value = '';
    renderFriendList();
    showToast('添加成功');
}

function renderFriendList() {
    const container = document.getElementById('friend-list');
    const friends = getFriends();
    const users = getUsers();

    if (friends.length === 0) {
        container.innerHTML = `<div class="empty-hint">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>还没有好友</p>
            <p class="empty-sub">输入对方ID添加好友</p>
        </div>`;
        return;
    }

    let html = '';
    friends.forEach(fid => {
        const user = users[fid];
        if (!user) return;
        const initial = fid.charAt(0).toUpperCase();
        const online = isOnline(fid);
        const statusDot = online
            ? '<div class="online-dot" style="position:absolute;bottom:1px;right:1px;width:8px;height:8px;border-radius:50%;background:#4CD964;border:2px solid var(--surface);"></div>'
            : '<div class="offline-dot" style="position:absolute;bottom:1px;right:1px;width:8px;height:8px;border-radius:50%;background:#C7C7CC;border:2px solid var(--surface);"></div>';

        html += `<div class="friend-item" data-friend="${fid}">
            <div class="friend-avatar">${initial}${statusDot}</div>
            <div class="friend-name">${escapeHtml(fid)}</div>
            <div class="friend-status">${online ? '在线' : '离线'}</div>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.friend-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab('chat');
            setTimeout(() => openChat(item.dataset.friend), 50);
        });
    });
}

function isOnline(userId) {
    const key = 'calc_online_' + userId;
    const lastSeen = store.get(key, 0);
    return (Date.now() - lastSeen) < 30000;
}

function heartbeat() {
    if (state.currentUser) {
        store.set('calc_online_' + state.currentUser.id, Date.now());
    }
}

/* ===== Profile ===== */
function renderProfile() {
    if (!state.currentUser) {
        document.getElementById('profile-name').textContent = '未登录';
        document.getElementById('profile-id').textContent = 'ID: --';
        document.getElementById('profile-avatar').textContent = 'U';
        return;
    }

    const initial = state.currentUser.id.charAt(0).toUpperCase();
    document.getElementById('profile-avatar').textContent = initial;
    document.getElementById('profile-name').textContent = state.currentUser.id;
    document.getElementById('profile-id').textContent = 'ID: ' + state.currentUser.id;
}

/* ===== Theme ===== */
function initTheme() {
    const saved = store.get('calc_theme', 'light');
    applyTheme(saved);

    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const current = store.get('calc_theme', 'light');
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);
        store.set('calc_theme', next);
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sw = document.getElementById('theme-switch');
    if (theme === 'dark') {
        sw.classList.add('active');
    } else {
        sw.classList.remove('active');
    }
}

/* ===== Header Back ===== */
function initHeaderBack() {
    document.getElementById('header-back').addEventListener('click', () => {
        if (state.currentChat) {
            document.getElementById('view-chat-window').style.display = 'none';
            document.getElementById('view-chat-list').style.display = 'block';
            document.getElementById('header-back').style.display = 'none';
            document.getElementById('header-title').textContent = '主客厅';
            document.getElementById('tab-bar').style.display = 'flex';
            state.currentChat = null;
            state.editingMsgId = null;
            document.getElementById('btn-edit-msg').style.display = 'none';
            renderChatList();
        }
    });
}

/* ===== Search ===== */
function initSearch() {
    document.getElementById('search-chat').addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            const name = item.querySelector('.chat-name').textContent.toLowerCase();
            const msg = item.querySelector('.chat-last-msg').textContent.toLowerCase();
            item.style.display = (name.includes(query) || msg.includes(query)) ? 'flex' : 'none';
        });
    });
}

/* ===== Utilities ===== */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';

    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨天';

    return (d.getMonth() + 1) + '/' + d.getDate();
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
    initCalculator();
    initTabs();
    initAuth();
    initFriends();
    initContextMenu();
    initTheme();
    initHeaderBack();
    initSearch();

    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    setInterval(heartbeat, 10000);
    heartbeat();
});
