/**
 * Data Store Layer
 * Currently uses localStorage. Will be replaced with Supabase SDK later.
 * All public methods return plain objects/arrays (no class instances).
 */
const Store = (function () {
    const KEYS = {
        users: 'oc_users',
        sessions: 'oc_sessions',
        friends: 'oc_friends',
        messages: 'oc_messages',
        theme: 'oc_theme',
        mute: 'oc_mute'
    };

    // ---- helpers ----
    function _get(key) {
        try { return JSON.parse(localStorage.getItem(key)) || null; }
        catch { return null; }
    }
    function _set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }
    function _uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function _now() {
        return Date.now();
    }

    // ---- init default accounts ----
    function _init() {
        if (!_get(KEYS.users)) {
            const defaults = [
                { id: 'user001', password: '123456', createdAt: _now() },
                { id: 'user002', password: '123456', createdAt: _now() },
                { id: 'user003', password: '123456', createdAt: _now() }
            ];
            _set(KEYS.users, defaults);
        }
        if (!_get(KEYS.sessions)) _set(KEYS.sessions, []);
        if (!_get(KEYS.friends)) _set(KEYS.friends, []);
        if (!_get(KEYS.messages)) _set(KEYS.messages, []);
    }
    _init();

    // ---- session helpers ----
    function _getSessions() { return _get(KEYS.sessions) || []; }
    function _setSessions(arr) { _set(KEYS.sessions, arr); }

    // ---- public API ----
    return {
        // Auth
        login(id, password) {
            const users = _get(KEYS.users) || [];
            const user = users.find(u => u.id === id && u.password === password);
            if (!user) return null;
            // Remove old session for this id
            let sessions = _getSessions();
            sessions = sessions.filter(s => s.userId !== id);
            sessions.push({ userId: id, loginAt: _now() });
            _setSessions(sessions);
            return { id: user.id };
        },

        logout(userId) {
            let sessions = _getSessions();
            sessions = sessions.filter(s => s.userId !== userId);
            _setSessions(sessions);
        },

        getCurrentUser() {
            const sessions = _getSessions();
            if (!sessions.length) return null;
            const s = sessions[sessions.length - 1];
            const users = _get(KEYS.users) || [];
            const user = users.find(u => u.id === s.userId);
            return user ? { id: user.id } : null;
        },

        changePassword(userId, oldPwd, newPwd) {
            const users = _get(KEYS.users) || [];
            const user = users.find(u => u.id === userId);
            if (!user) return { ok: false, msg: '用户不存在' };
            if (user.password !== oldPwd) return { ok: false, msg: '当前密码错误' };
            user.password = newPwd;
            _set(KEYS.users, users);
            return { ok: true };
        },

        // Users
        getUser(id) {
            const users = _get(KEYS.users) || [];
            const u = users.find(u => u.id === id);
            return u ? { id: u.id } : null;
        },

        getAllUsers() {
            return (_get(KEYS.users) || []).map(u => ({ id: u.id }));
        },

        // Online status
        isOnline(userId) {
            const sessions = _getSessions();
            return sessions.some(s => s.userId === userId);
        },

        // Friends
        getFriends(userId) {
            const friends = _get(KEYS.friends) || [];
            const ids = [];
            friends.forEach(f => {
                if (f.status !== 'accepted') return;
                if (f.from === userId) ids.push(f.to);
                else if (f.to === userId) ids.push(f.from);
            });
            return ids;
        },

        sendFriendRequest(fromId, toId) {
            if (fromId === toId) return { ok: false, msg: '不能加自己为好友' };
            const users = _get(KEYS.users) || [];
            if (!users.find(u => u.id === toId)) return { ok: false, msg: '用户不存在' };
            const friends = _get(KEYS.friends) || [];
            const existing = friends.find(f =>
                (f.from === fromId && f.to === toId) || (f.from === toId && f.to === fromId)
            );
            if (existing) {
                if (existing.status === 'accepted') return { ok: false, msg: '已经是好友了' };
                if (existing.status === 'pending') return { ok: false, msg: '已有待处理的申请' };
            }
            friends.push({ from: fromId, to: toId, status: 'pending', createdAt: _now() });
            _set(KEYS.friends, friends);
            return { ok: true };
        },

        getPendingRequests(userId) {
            const friends = _get(KEYS.friends) || [];
            return friends.filter(f => f.to === userId && f.status === 'pending');
        },

        acceptFriend(userId, fromId) {
            const friends = _get(KEYS.friends) || [];
            const req = friends.find(f => f.from === fromId && f.to === userId && f.status === 'pending');
            if (!req) return { ok: false, msg: '申请不存在' };
            req.status = 'accepted';
            _set(KEYS.friends, friends);
            return { ok: true };
        },

        rejectFriend(userId, fromId) {
            let friends = _get(KEYS.friends) || [];
            friends = friends.filter(f => !(f.from === fromId && f.to === userId && f.status === 'pending'));
            _set(KEYS.friends, friends);
            return { ok: true };
        },

        // Messages
        getMessages(userId1, userId2) {
            const messages = _get(KEYS.messages) || [];
            return messages.filter(m =>
                (m.from === userId1 && m.to === userId2) ||
                (m.from === userId2 && m.to === userId1)
            ).sort((a, b) => a.createdAt - b.createdAt);
        },

        sendMessage(from, to, content) {
            const messages = _get(KEYS.messages) || [];
            const msg = {
                id: _uid(),
                from, to, content,
                createdAt: _now(),
                edited: false,
                recalled: false
            };
            messages.push(msg);
            _set(KEYS.messages, messages);
            return msg;
        },

        editMessage(msgId, userId, newContent) {
            const messages = _get(KEYS.messages) || [];
            const msg = messages.find(m => m.id === msgId);
            if (!msg) return { ok: false, msg: '消息不存在' };
            if (msg.from !== userId) return { ok: false, msg: '只能编辑自己的消息' };
            if (msg.recalled) return { ok: false, msg: '消息已撤回' };
            msg.content = newContent;
            msg.edited = true;
            _set(KEYS.messages, messages);
            return { ok: true, msg };
        },

        recallMessage(msgId, userId) {
            const messages = _get(KEYS.messages) || [];
            const msg = messages.find(m => m.id === msgId);
            if (!msg) return { ok: false, msg: '消息不存在' };
            if (msg.from !== userId) return { ok: false, msg: '只能撤回自己的消息' };
            msg.recalled = true;
            _set(KEYS.messages, messages);
            return { ok: true };
        },

        // Theme
        getTheme() { return _get(KEYS.theme) || 'light'; },
        setTheme(t) { _set(KEYS.theme, t); },

        // Mute
        getMute() { return _get(KEYS.mute) !== false; }, // default true (muted)
        setMute(v) { _set(KEYS.mute, v); }
    };
})();
