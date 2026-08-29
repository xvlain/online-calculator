/**
 * Main App Module
 * Handles navigation, chat, friends, account, and theme.
 */
(function () {
    let currentUser = null;
    let activeChatWith = null;  // userId of current chat partner
    let contextMsgId = null;    // message id for context menu
    let pollTimer = null;

    // ===== DOM refs =====
    const $ = id => document.getElementById(id);
    const calcView = $('calc-view');
    const appView = $('app-view');
    const loginOverlay = $('login-overlay');
    const headerTitle = $('headerTitle');

    // ===== Init =====
    function init() {
        // Apply saved theme
        applyTheme(Store.getTheme());

        // Init calculator with secret trigger
        Calculator.init(onSecretTrigger);

        // Tab bar
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Login
        $('loginBtn').addEventListener('click', handleLogin);
        $('loginPwd').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

        // Chat send
        $('chatSendBtn').addEventListener('click', sendMessage);
        $('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

        // Chat back
        $('chatBackBtn').addEventListener('click', closeChatRoom);

        // Friend search
        $('friendSearchBtn').addEventListener('click', searchFriend);
        $('friendSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchFriend(); });

        // Account settings
        $('settingPwd').addEventListener('click', () => openModal('pwdModal'));
        $('settingLogout').addEventListener('click', handleLogout);
        $('themeToggle').addEventListener('change', handleThemeChange);

        // Password modal
        $('pwdCancel').addEventListener('click', () => closeModal('pwdModal'));
        $('pwdConfirm').addEventListener('click', handleChangePassword);

        // Context menu actions
        $('menuEdit').addEventListener('click', () => handleEditMessage());
        $('menuRecall').addEventListener('click', () => handleRecallMessage());
        $('menuCopy').addEventListener('click', () => handleCopyMessage());

        // Close context menu on outside click
        document.addEventListener('click', (e) => {
            const menu = $('msgMenu');
            if (menu.classList.contains('active') && !menu.contains(e.target)) {
                menu.classList.remove('active');
            }
        });

        // Check existing session
        const existing = Store.getCurrentUser();
        if (existing) {
            currentUser = existing;
            // Don't auto-enter app, stay on calculator
        }
    }

    // ===== Secret Trigger =====
    function onSecretTrigger() {
        if (!currentUser) {
            // Show login
            setTimeout(() => {
                loginOverlay.classList.add('active');
                $('loginId').focus();
            }, 600);
        } else {
            enterApp();
        }
    }

    // ===== Login =====
    function handleLogin() {
        const id = $('loginId').value.trim();
        const pwd = $('loginPwd').value;
        const errEl = $('loginError');

        if (!id || !pwd) {
            errEl.textContent = '请输入账号和密码';
            return;
        }

        const user = Store.login(id, pwd);
        if (!user) {
            errEl.textContent = '账号或密码错误';
            return;
        }

        currentUser = user;
        errEl.textContent = '';
        $('loginId').value = '';
        $('loginPwd').value = '';
        loginOverlay.classList.remove('active');
        enterApp();
    }

    // ===== Enter / Exit App =====
    function enterApp() {
        calcView.classList.remove('active');
        appView.classList.add('active');
        appView.classList.add('fade-in');
        switchTab('chat');
        renderAccountTab();
        startPolling();
    }

    function exitApp() {
        appView.classList.remove('active');
        calcView.classList.add('active');
        closeChatRoom();
        Calculator.reset();
        stopPolling();
    }

    // ===== Tab Switching =====
    function switchTab(tab) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        $(('tab-' + tab)).classList.add('active');

        const titles = { chat: '主客厅', friends: '昏光庭院', account: '我的' };
        headerTitle.textContent = titles[tab] || '';

        if (tab === 'chat') renderChatList();
        if (tab === 'friends') renderFriendsTab();
        if (tab === 'account') renderAccountTab();
    }

    // ===== Chat List =====
    function renderChatList() {
        const list = $('chatList');
        const friends = Store.getFriends(currentUser.id);

        if (!friends.length) {
            list.innerHTML = '<div class="empty-tip">还没有好友，去昏光庭院加几个吧</div>';
            return;
        }

        let html = '';
        friends.forEach(fid => {
            const msgs = Store.getMessages(currentUser.id, fid);
            const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
            const isOnline = Store.isOnline(fid);

            let lastText = '暂无消息';
            let lastTime = '';
            if (lastMsg) {
                lastText = lastMsg.recalled ? '消息已撤回' : lastMsg.content;
                lastTime = formatTime(lastMsg.createdAt);
            }

            html += `<div class="chat-item" data-uid="${fid}">
                <div class="avatar">${fid.charAt(0).toUpperCase()}
                    <span class="${isOnline ? 'online-dot' : 'offline-dot'}"></span>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-name">${esc(fid)}</div>
                    <div class="chat-item-last">${esc(lastText)}</div>
                </div>
                <div class="chat-item-time">${lastTime}</div>
            </div>`;
        });

        list.innerHTML = html;

        // Click to open chat
        list.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => openChatRoom(item.dataset.uid));
        });
    }

    // ===== Chat Room =====
    function openChatRoom(friendId) {
        activeChatWith = friendId;
        $('chatRoomName').textContent = friendId;
        $('chatRoom').classList.add('active');
        headerTitle.style.display = 'none';
        renderMessages();
        $('chatInput').focus();
    }

    function closeChatRoom() {
        activeChatWith = null;
        $('chatRoom').classList.remove('active');
        headerTitle.style.display = '';
    }

    function renderMessages() {
        if (!activeChatWith) return;
        const container = $('chatMessages');
        const msgs = Store.getMessages(currentUser.id, activeChatWith);

        let html = '';
        let lastDate = '';

        msgs.forEach(msg => {
            const date = new Date(msg.createdAt).toLocaleDateString('zh-CN');
            if (date !== lastDate) {
                html += `<div class="msg-time">${date} ${formatTimeFull(msg.createdAt)}</div>`;
                lastDate = date;
            }

            const isSelf = msg.from === currentUser.id;
            const sender = isSelf ? currentUser.id : activeChatWith;

            if (msg.recalled) {
                html += `<div class="msg-row ${isSelf ? 'self' : 'other'}">
                    <div class="msg-avatar">${sender.charAt(0).toUpperCase()}</div>
                    <div class="msg-bubble recalled">消息已撤回</div>
                </div>`;
            } else {
                html += `<div class="msg-row ${isSelf ? 'self' : 'other'}" data-msgid="${msg.id}">
                    <div class="msg-avatar">${sender.charAt(0).toUpperCase()}</div>
                    <div class="msg-bubble${msg.edited ? ' edited' : ''}">${esc(msg.content)}</div>
                </div>`;
            }
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;

        // Long press / right click for context menu
        container.querySelectorAll('.msg-row.self .msg-bubble:not(.recalled)').forEach(bubble => {
            const row = bubble.closest('.msg-row');
            const msgId = row.dataset.msgid;

            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, msgId);
            });

            let pressTimer;
            bubble.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    const touch = e.touches[0];
                    showContextMenu(touch.clientX, touch.clientY, msgId);
                }, 500);
            });
            bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
            bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });
    }

    function sendMessage() {
        const input = $('chatInput');
        const text = input.value.trim();
        if (!text || !activeChatWith) return;

        Store.sendMessage(currentUser.id, activeChatWith, text);
        input.value = '';
        renderMessages();
    }

    // ===== Context Menu =====
    function showContextMenu(x, y, msgId) {
        contextMsgId = msgId;
        const menu = $('msgMenu');
        menu.style.left = Math.min(x, window.innerWidth - 120) + 'px';
        menu.style.top = Math.min(y, window.innerHeight - 140) + 'px';
        menu.classList.add('active');
    }

    function handleEditMessage() {
        $('msgMenu').classList.remove('active');
        if (!contextMsgId) return;
        const msgs = Store.getMessages(currentUser.id, activeChatWith);
        const msg = msgs.find(m => m.id === contextMsgId);
        if (!msg || msg.from !== currentUser.id || msg.recalled) return;

        const newContent = prompt('编辑消息', msg.content);
        if (newContent !== null && newContent.trim()) {
            Store.editMessage(contextMsgId, currentUser.id, newContent.trim());
            renderMessages();
        }
    }

    function handleRecallMessage() {
        $('msgMenu').classList.remove('active');
        if (!contextMsgId) return;
        Store.recallMessage(contextMsgId, currentUser.id);
        renderMessages();
    }

    function handleCopyMessage() {
        $('msgMenu').classList.remove('active');
        if (!contextMsgId) return;
        const msgs = Store.getMessages(currentUser.id, activeChatWith);
        const msg = msgs.find(m => m.id === contextMsgId);
        if (msg && !msg.recalled) {
            navigator.clipboard.writeText(msg.content).catch(() => {});
        }
    }

    // ===== Friends Tab =====
    function renderFriendsTab() {
        renderFriendsList();
        renderFriendRequests();
        $('friendSearchResult').innerHTML = '';
        $('friendSearchInput').value = '';
    }

    function searchFriend() {
        const id = $('friendSearchInput').value.trim();
        const resultDiv = $('friendSearchResult');
        if (!id) { resultDiv.innerHTML = ''; return; }

        const user = Store.getUser(id);
        if (!user) {
            resultDiv.innerHTML = '<div class="empty-tip" style="padding:20px">未找到该用户</div>';
            return;
        }
        if (user.id === currentUser.id) {
            resultDiv.innerHTML = '<div class="empty-tip" style="padding:20px">不能加自己为好友</div>';
            return;
        }

        const friends = Store.getFriends(currentUser.id);
        const isFriend = friends.includes(user.id);
        const pending = Store.getPendingRequests(currentUser.id);
        const sentRequests = (JSON.parse(localStorage.getItem('oc_friends') || '[]'))
            .filter(f => f.from === currentUser.id && f.to === user.id && f.status === 'pending');
        const alreadySent = sentRequests.length > 0;

        let btnHtml;
        if (isFriend) {
            btnHtml = '<button class="add-friend-btn" disabled>已添加</button>';
        } else if (alreadySent) {
            btnHtml = '<button class="add-friend-btn" disabled>已发送</button>';
        } else {
            btnHtml = `<button class="add-friend-btn" onclick="window._sendFriendReq('${esc(user.id)}')">添加</button>`;
        }

        const isOnline = Store.isOnline(user.id);
        resultDiv.innerHTML = `<div class="search-result-item slide-up">
            <div class="avatar">${user.id.charAt(0).toUpperCase()}
                <span class="${isOnline ? 'online-dot' : 'offline-dot'}"></span>
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${esc(user.id)}</div>
                <div class="search-result-id">ID: ${esc(user.id)}</div>
            </div>
            ${btnHtml}
        </div>`;
    }

    // Expose to global for onclick
    window._sendFriendReq = function (toId) {
        const result = Store.sendFriendRequest(currentUser.id, toId);
        if (result.ok) {
            searchFriend(); // Refresh search result
        } else {
            alert(result.msg);
        }
    };

    function renderFriendsList() {
        const container = $('friendsList');
        const friends = Store.getFriends(currentUser.id);

        if (!friends.length) {
            container.innerHTML = '<div class="empty-tip" style="padding:20px">暂无好友</div>';
            return;
        }

        let html = '';
        friends.forEach(fid => {
            const isOnline = Store.isOnline(fid);
            html += `<div class="friend-item" data-uid="${esc(fid)}">
                <div class="avatar">${fid.charAt(0).toUpperCase()}
                    <span class="${isOnline ? 'online-dot' : 'offline-dot'}"></span>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${esc(fid)}</div>
                    <div class="friend-status">${isOnline ? '在线' : '离线'}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;

        // Click to chat
        container.querySelectorAll('.friend-item').forEach(item => {
            item.addEventListener('click', () => {
                switchTab('chat');
                setTimeout(() => openChatRoom(item.dataset.uid), 100);
            });
        });
    }

    function renderFriendRequests() {
        const container = $('friendRequests');
        const requests = Store.getPendingRequests(currentUser.id);

        if (!requests.length) {
            container.innerHTML = '<div class="empty-tip" style="padding:20px">暂无新申请</div>';
            return;
        }

        let html = '';
        requests.forEach(req => {
            html += `<div class="request-item slide-up">
                <div class="avatar">${req.from.charAt(0).toUpperCase()}</div>
                <div class="request-info">
                    <div class="request-name">${esc(req.from)}</div>
                    <div class="request-id">请求加你为好友</div>
                </div>
                <div class="request-actions">
                    <button class="accept-btn" onclick="window._acceptFriend('${esc(req.from)}')">接受</button>
                    <button class="reject-btn" onclick="window._rejectFriend('${esc(req.from)}')">拒绝</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }

    window._acceptFriend = function (fromId) {
        Store.acceptFriend(currentUser.id, fromId);
        renderFriendsTab();
    };

    window._rejectFriend = function (fromId) {
        Store.rejectFriend(currentUser.id, fromId);
        renderFriendsTab();
    };

    // ===== Account Tab =====
    function renderAccountTab() {
        if (!currentUser) return;
        $('myAvatar').textContent = currentUser.id.charAt(0).toUpperCase();
        $('myName').textContent = currentUser.id;
        $('myId').textContent = 'ID: ' + currentUser.id;
        $('themeToggle').checked = Store.getTheme() === 'dark';
    }

    function handleChangePassword() {
        const oldPwd = $('oldPwd').value;
        const newPwd = $('newPwd').value;
        const confirmPwd = $('confirmPwd').value;
        const errEl = $('pwdError');

        if (!oldPwd || !newPwd || !confirmPwd) {
            errEl.textContent = '请填写所有字段';
            return;
        }
        if (newPwd !== confirmPwd) {
            errEl.textContent = '两次输入的新密码不一致';
            return;
        }
        if (newPwd.length < 4) {
            errEl.textContent = '密码至少4位';
            return;
        }

        const result = Store.changePassword(currentUser.id, oldPwd, newPwd);
        if (result.ok) {
            errEl.textContent = '';
            $('oldPwd').value = '';
            $('newPwd').value = '';
            $('confirmPwd').value = '';
            closeModal('pwdModal');
            alert('密码修改成功');
        } else {
            errEl.textContent = result.msg;
        }
    }

    function handleLogout() {
        if (!confirm('确定退出登录？')) return;
        Store.logout(currentUser.id);
        currentUser = null;
        exitApp();
    }

    // ===== Theme =====
    function handleThemeChange() {
        const theme = $('themeToggle').checked ? 'dark' : 'light';
        Store.setTheme(theme);
        applyTheme(theme);
    }

    function applyTheme(theme) {
        document.body.classList.toggle('dark', theme === 'dark');
    }

    // ===== Polling (simulate real-time) =====
    function startPolling() {
        stopPolling();
        pollTimer = setInterval(() => {
            const activeTab = document.querySelector('.tab-item.active');
            if (!activeTab) return;
            const tab = activeTab.dataset.tab;
            if (tab === 'chat' && !activeChatWith) renderChatList();
            if (tab === 'chat' && activeChatWith) renderMessages();
            if (tab === 'friends') { renderFriendsList(); renderFriendRequests(); }
        }, 2000);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    // ===== Modal helpers =====
    function openModal(id) { $(id).classList.add('active'); }
    function closeModal(id) { $(id).classList.remove('active'); }

    // ===== Utility =====
    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        }
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function formatTimeFull(ts) {
        const d = new Date(ts);
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    // ===== Start =====
    init();
})();
