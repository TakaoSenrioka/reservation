// 設定 - 本番環境では環境変数から取得
const CONFIG = {
    API_BASE_URL: 'https://degitalsignage-reservation-997233517082.asia-northeast1.run.app', // Cloud RunのURLに変更してください
    // Firebase設定は環境変数から取得するか、設定ファイルから読み込む
};

// グローバル変数
let currentUser = null;
let currentReservationId = null;
let confirmCallback = null;
let emailTemplates = {};

// DOM要素の取得
const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loggedUser = document.getElementById('logged-user');
const logoutBtn = document.getElementById('logout-btn');
const loading = document.getElementById('loading');
const notification = document.getElementById('notification');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateTodayDate();
    checkAuth();
});

// イベントリスナーの設定
function setupEventListeners() {
    // ログイン
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // 待ち人数管理
    document.getElementById('increase-btn').addEventListener('click', () => updatePopulation(1));
    document.getElementById('decrease-btn').addEventListener('click', () => updatePopulation(-1));
    
    // パスワード変更
    document.getElementById('password-change-form').addEventListener('submit', handlePasswordChange);
    
    // メール送信
    document.getElementById('email-form').addEventListener('submit', handleEmailSend);
}

// 認証状態確認
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        // トークンの有効性を確認
        validateToken(token);
    }
}

// ログイン処理
async function handleLogin(e) {
    e.preventDefault();
    
    const userId = document.getElementById('user-id').value;
    const password = document.getElementById('password').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, password }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = userId;
            localStorage.setItem('auth_token', data.token);
            loggedUser.textContent = `ログイン中: ${userId}`;
            
            showMainContainer();
            loadInitialData();
            showNotification('ログインしました', 'success');
        } else {
            showError(data.error || 'ログインに失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// ログアウト処理
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('auth_token');
    showLoginContainer();
    showNotification('ログアウトしました', 'success');
}

// トークン検証
async function validateToken(token) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/validate`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.userId;
            loggedUser.textContent = `ログイン中: ${data.userId}`;
            showMainContainer();
            loadInitialData();
        } else {
            localStorage.removeItem('auth_token');
        }
    } catch (error) {
        localStorage.removeItem('auth_token');
    }
}

// 初期データ読み込み
async function loadInitialData() {
    await Promise.all([
        loadReservations(),
        loadPopulation(),
        loadEmailTemplates()
    ]);
}

// 予約データ読み込み
async function loadReservations() {
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/reservations`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayReservations(data.reservations);
        } else {
            showError('予約データの読み込みに失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// 予約表示
function displayReservations(reservations) {
    const today = new Date().toISOString().split('T')[0];
    const todayReservations = reservations.filter(r => r.date === today && r.states === 0);
    const upcomingReservations = reservations.filter(r => r.date > today && r.states === 0);
    const historyReservations = reservations.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    displayReservationList('today-reservations', todayReservations, 'today');
    displayReservationList('upcoming-reservations', upcomingReservations, 'upcoming');
    displayReservationList('history-reservations', historyReservations, 'history');
}

// 予約リスト表示
function displayReservationList(containerId, reservations, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (reservations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #cccccc;">予約がありません</p>';
        return;
    }
    
    reservations.forEach(reservation => {
        const card = createReservationCard(reservation, type);
        container.appendChild(card);
    });
}

// 予約カード作成
function createReservationCard(reservation, type) {
    const card = document.createElement('div');
    card.className = 'reservation-card';
    card.setAttribute('data-id', reservation.id);
    
    const statusClass = getStatusClass(reservation.states);
    const statusText = getStatusText(reservation.states);
    
    card.innerHTML = `
        <div class="reservation-header">
            <div class="reservation-time">${reservation.Time}</div>
            <div class="reservation-status ${statusClass}">${statusText}</div>
        </div>
        <div class="reservation-info">
            <p><strong>氏名:</strong> ${reservation['Name-f']} ${reservation['Name-s']} (${reservation['Name-f-f']} ${reservation['Name-s-f']})</p>
            <p><strong>メニュー:</strong> ${reservation.Menu}</p>
            <p><strong>メールアドレス:</strong> ${reservation.mail}</p>
            <p><strong>日付:</strong> ${reservation.date}</p>
            <p><strong>所要時間:</strong> ${reservation.WorkTime}分</p>
        </div>
        <div class="reservation-actions">
            ${getActionButtons(reservation, type)}
        </div>
    `;
    
    return card;
}

// ステータスクラス取得
function getStatusClass(states) {
    switch (states) {
        case 0: return 'status-pending';
        case 1: return 'status-completed';
        case 2: return 'status-cancelled';
        default: return 'status-pending';
    }
}

// ステータステキスト取得
function getStatusText(states) {
    switch (states) {
        case 0: return '来店前';
        case 1: return '来店済み';
        case 2: return 'キャンセル済み';
        default: return '来店前';
    }
}

// アクションボタン取得
function getActionButtons(reservation, type) {
    let buttons = '';
    
    if (type === 'today') {
        buttons += `
            <button class="btn btn-primary" onclick="handleVisit('${reservation.id}')">来店</button>
            <button class="btn btn-danger" onclick="handleCancel('${reservation.id}')">キャンセル</button>
        `;
    } else if (type === 'upcoming') {
        buttons += `
            <button class="btn btn-danger" onclick="handleCancel('${reservation.id}')">キャンセル</button>
        `;
    }
    
    // 全てのタイプでメール送信ボタンを表示
    buttons += `<button class="btn btn-secondary" onclick="openEmailModal('${reservation.id}', '${reservation.mail}')">メール送信</button>`;
    
    return buttons;
}

// 来店処理
async function handleVisit(reservationId) {
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/reservations/${reservationId}/visit`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showNotification('来店処理を完了しました', 'success');
            loadReservations();
        } else {
            showError('来店処理に失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// キャンセル処理
function handleCancel(reservationId) {
    showConfirmModal('本当にキャンセルしますか？', () => {
        cancelReservation(reservationId);
    });
}

// 予約キャンセル実行
async function cancelReservation(reservationId) {
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/reservations/${reservationId}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (response.ok) {
            showNotification('予約をキャンセルしました', 'success');
            loadReservations();
        } else {
            showError('キャンセル処理に失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// 待ち人数読み込み
async function loadPopulation() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/population`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('current-population').textContent = data.now;
        }
    } catch (error) {
        console.error('待ち人数の読み込みに失敗しました');
    }
}

// 待ち人数更新
async function updatePopulation(change) {
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/population`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ change }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('current-population').textContent = data.now;
            showNotification('待ち人数を更新しました', 'success');
        } else {
            showError('待ち人数の更新に失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// メールテンプレート読み込み
async function loadEmailTemplates() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/email-templates`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        const data = await response.json();
        
        if (response.ok) {
            emailTemplates = data.templates;
        }
    } catch (error) {
        console.error('メールテンプレートの読み込みに失敗しました');
    }
}

// メールモーダル開く
function openEmailModal(reservationId, email) {
    currentReservationId = reservationId;
    document.getElementById('email-recipient-address').textContent = email;
    
    // テンプレート表示
    const templatesContainer = document.getElementById('email-templates');
    templatesContainer.innerHTML = '';
    
    Object.entries(emailTemplates).forEach(([name, template]) => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.onclick = () => useTemplate(template);
        
        const preview = template.title.length > 50 ? template.title.substring(0, 50) + '...' : template.title;
        
        templateItem.innerHTML = `
            <div class="template-name">${name}</div>
            <div class="template-preview">${preview}</div>
        `;
        
        templatesContainer.appendChild(templateItem);
    });
    
    document.getElementById('email-modal').classList.add('active');
}

// テンプレート使用
function useTemplate(template) {
    document.getElementById('email-subject').value = template.main;
    document.getElementById('email-body').value = template.title;
}

// メール送信処理
async function handleEmailSend(e) {
    e.preventDefault();
    
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').value;
    const recipient = document.getElementById('email-recipient-address').textContent;
    
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reservationId: currentReservationId,
                to: recipient,
                subject,
                body,
            }),
        });
        
        if (response.ok) {
            showNotification('メールを送信しました', 'success');
            closeEmailModal();
        } else {
            showError('メール送信に失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// パスワード変更処理
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showError('新しいパスワードが一致しません');
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/change-password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                oldPassword,
                newPassword,
            }),
        });
        
        if (response.ok) {
            showNotification('パスワードを変更しました', 'success');
            document.getElementById('password-change-form').reset();
        } else {
            const data = await response.json();
            showError(data.error || 'パスワード変更に失敗しました');
        }
    } catch (error) {
        showError('サーバーとの通信に失敗しました');
    } finally {
        hideLoading();
    }
}

// タブ切り替え
function switchTab(tabName) {
    // タブボタンのアクティブ状態更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // タブコンテンツの表示切り替え
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // 必要に応じてデータ再読み込み
    if (tabName === 'today' || tabName === 'upcoming' || tabName === 'history') {
        loadReservations();
    } else if (tabName === 'population') {
        loadPopulation();
    }
}

// 今日の日付更新
function updateTodayDate() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('today-date').textContent = `(${dateStr})`;
}

// UI表示制御
function showLoginContainer() {
    loginContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    loginForm.reset();
    loginError.textContent = '';
}

function showMainContainer() {
    loginContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
}

function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(message) {
    loginError.textContent = message;
    setTimeout(() => {
        loginError.textContent = '';
    }, 5000);
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    
    messageElement.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function closeNotification() {
    document.getElementById('notification').classList.add('hidden');
}

// モーダル制御
function closeEmailModal() {
    document.getElementById('email-modal').classList.remove('active');
    document.getElementById('email-form').reset();
    currentReservationId = null;
}

function showConfirmModal(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('active');
    confirmCallback = callback;
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    confirmCallback = null;
}

function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// エラーハンドリング
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    showNotification('エラーが発生しました', 'error');
});

// 未処理のPromise拒否をキャッチ
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled Promise Rejection:', e.reason);
    showNotification('通信エラーが発生しました', 'error');
});
