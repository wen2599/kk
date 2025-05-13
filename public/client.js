// public/client.js
const socket = io({
    reconnectionAttempts: 5,
    reconnectionDelay: 3000
});

// --- State Variables ---
let currentView = 'loading';
let myUserId = null;
let myUsername = null;
let currentRoomId = null;
let currentGameState = null;
let isReadyForGame = false;
let selectedCards = [];
let currentSortMode = 'rank';
let currentHint = null;
let currentHintCycleIndex = 0;

// --- DOM Elements ---
const loadingView = document.getElementById('loadingView');
const loginRegisterView = document.getElementById('loginRegisterView');
const lobbyView = document.getElementById('lobbyView');
const roomView = document.getElementById('roomView');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const views = { loadingView, loginRegisterView, lobbyView, roomView, gameOverOverlay };
const regPhoneInput = document.getElementById('regPhone');
const regPasswordInput = document.getElementById('regPassword');
const registerButton = document.getElementById('registerButton');
const loginPhoneInput = document.getElementById('loginPhone');
const loginPasswordInput = document.getElementById('loginPassword');
const loginButton = document.getElementById('loginButton');
const authMessage = document.getElementById('authMessage');
const logoutButton = document.getElementById('logoutButton');
const lobbyUsername = document.getElementById('lobbyUsername');
const createRoomNameInput = document.getElementById('createRoomName');
const createRoomPasswordInput = document.getElementById('createRoomPassword');
const createRoomButton = document.getElementById('createRoomButton');
const roomList = document.getElementById('roomList');
const lobbyMessage = document.getElementById('lobbyMessage');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const gameModeDisplay = document.getElementById('gameModeDisplay'); // 虽然CSS隐藏了，但DOM元素还在
const roomStatusDisplay = document.getElementById('roomStatusDisplay');
const leaveRoomButton = document.getElementById('leaveRoomButton');
const centerPileArea = document.getElementById('centerPileArea');
const lastHandTypeDisplay = document.getElementById('lastHandTypeDisplay');
const myHandArea = document.getElementById('myHand');
const myActionsArea = document.getElementById('myActions');
const playSelectedCardsButton = document.getElementById('playSelectedCardsButton');
const passTurnButton = document.getElementById('passTurnButton');
const hintButton = document.getElementById('hintButton');
const sortHandButton = document.getElementById('sortHandButton');
const playerAreas = {
    0: document.getElementById('playerAreaBottom'), // Self
    1: document.getElementById('playerAreaLeft'),
    2: document.getElementById('playerAreaTop'),
    3: document.getElementById('playerAreaRight')
};
const readyButton = document.getElementById('readyButton');
const gameMessage = document.getElementById('gameMessage');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverReason = document.getElementById('gameOverReason');
const gameOverScores = document.getElementById('gameOverScores');
const backToLobbyButton = document.getElementById('backToLobbyButton');


// --- Utility Functions ---
function showView(viewName) {
    console.log(`Switching view from ${currentView} to: ${viewName}`);
    currentView = viewName;
    for (const key in views) {
        if (views[key]) {
            views[key].classList.add('hidden-view');
            views[key].classList.remove('view-block', 'view-flex');
        }
    }
    const targetView = views[viewName];
    if (targetView) {
        targetView.classList.remove('hidden-view');
        if (viewName === 'roomView' || viewName === 'gameOverOverlay') {
            targetView.classList.add('view-flex');
        } else {
            targetView.classList.add('view-block');
        }
    } else { console.warn(`View element not found: ${viewName}`); }
    const allowScroll = (viewName === 'loginRegisterView' || viewName === 'lobbyView');
    document.documentElement.style.overflow = allowScroll ? '' : 'hidden';
    document.body.style.overflow = allowScroll ? '' : 'hidden';
    clearMessages();
    if (viewName !== 'roomView') {
        selectedCards = []; currentHint = null; currentHintCycleIndex = 0;
    }
}
function displayMessage(element, message, isError = false, isSuccess = false) {
    if (element) {
        element.textContent = message;
        element.classList.remove('error', 'success');
        if (isError) element.classList.add('error');
        else if (isSuccess) element.classList.add('success');
        else element.className = 'message';
    }
}
function clearMessages() {
    [authMessage, lobbyMessage, gameMessage].forEach(el => {
        if (el) {
            el.textContent = ''; el.classList.remove('error', 'success'); el.className = 'message';
        }
    });
}
function getSuitSymbol(suit) { switch (suit?.toUpperCase()) { case 'H': return '♥'; case 'D': return '♦'; case 'C': return '♣'; case 'S': return '♠'; default: return '?'; } }
function getSuitClass(suit) { switch (suit?.toUpperCase()) { case 'H': return 'hearts'; case 'D': return 'diamonds'; case 'C': return 'clubs'; case 'S': return 'spades'; default: return ''; } }
const RANK_ORDER_CLIENT = ["4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2", "3"];
const RANK_VALUES_CLIENT = {}; RANK_ORDER_CLIENT.forEach((r, i) => RANK_VALUES_CLIENT[r] = i);
const SUIT_ORDER_CLIENT = ["D", "C", "H", "S"];
const SUIT_VALUES_CLIENT = {}; SUIT_ORDER_CLIENT.forEach((s, i) => SUIT_VALUES_CLIENT[s] = i);
function compareSingleCardsClient(cardA, cardB) {
    const rankValueA = RANK_VALUES_CLIENT[cardA.rank]; const rankValueB = RANK_VALUES_CLIENT[cardB.rank];
    if (rankValueA !== rankValueB) return rankValueA - rankValueB;
    return SUIT_VALUES_CLIENT[cardA.suit] - SUIT_VALUES_CLIENT[cardB.suit];
}
function compareBySuitThenRank(cardA, cardB) {
    const suitValueA = SUIT_VALUES_CLIENT[cardA.suit]; const suitValueB = SUIT_VALUES_CLIENT[cardB.suit];
    if (suitValueA !== suitValueB) return suitValueA - suitValueB;
    return RANK_VALUES_CLIENT[cardA.rank] - RANK_VALUES_CLIENT[cardB.rank];
}

// --- Rendering Functions ---
function renderRoomList(rooms) {
    if (!roomList) return; roomList.innerHTML = '';
    if (!rooms || rooms.length === 0) { roomList.innerHTML = '<p>当前没有房间。</p>'; return; }
    rooms.forEach(room => {
        const item = document.createElement('div'); item.classList.add('room-item');
        const nameSpan = document.createElement('span'); nameSpan.textContent = `${room.roomName} (${room.playerCount}/${room.maxPlayers})`; item.appendChild(nameSpan);
        const statusSpan = document.createElement('span'); statusSpan.textContent = `状态: ${room.status}`; statusSpan.classList.add(`status-${room.status}`); item.appendChild(statusSpan);
        if (room.hasPassword) {
            const passwordSpan = document.createElement('span'); passwordSpan.textContent = '🔒'; item.appendChild(passwordSpan);
        }
        const joinButton = document.createElement('button'); joinButton.textContent = '加入';
        joinButton.disabled = room.status !== 'waiting' || room.playerCount >= room.maxPlayers;
        joinButton.onclick = () => joinRoom(room.roomId, room.hasPassword); item.appendChild(joinButton);
        roomList.appendChild(item);
    });
 }
function renderRoomView(state) {
    if (!state || !roomView || !myUserId) {
        console.error("RenderRoomView called with invalid state or no myUserId", state, myUserId);
        if (!myUserId && currentView === 'roomView') { handleLogout(); alert("用户身份丢失，请重新登录。"); }
        return;
    }
    currentGameState = state;
    roomNameDisplay.textContent = state.roomName || '房间';
    // gameModeDisplay.textContent = state.gameMode === 'double_landlord' ? '(双地主模式)' : '(标准模式)'; // 已通过CSS隐藏
    roomStatusDisplay.textContent = `状态: ${state.status}`;
    Object.values(playerAreas).forEach(clearPlayerAreaDOM);
    const myPlayer = state.players.find(p => p.userId === myUserId);
    if (!myPlayer) { console.error("My player data not found in game state!", state.players); handleLeaveRoom(); return; }
    isReadyForGame = myPlayer.isReady;
    const mySlot = myPlayer.slot;
    state.players.forEach(player => {
        const isMe = player.userId === myUserId;
        let relativeSlot = (player.slot - mySlot + state.players.length) % state.players.length;
        const targetArea = playerAreas[relativeSlot];
        if (targetArea) renderPlayerArea(targetArea, player, isMe, state);
        else console.warn(`No target area for relative slot ${relativeSlot} (Player slot ${player.slot})`);
    });
    centerPileArea.innerHTML = '';
    if (state.centerPile && state.centerPile.length > 0) {
        state.centerPile.forEach(cardData => centerPileArea.appendChild(renderCard(cardData, false, true)));
    } else {
        const placeholder = document.createElement('span'); placeholder.textContent = '- 等待出牌 -'; placeholder.style.color = '#777';
        centerPileArea.appendChild(placeholder);
    }
    lastHandTypeDisplay.textContent = state.lastHandInfo ? `类型: ${state.lastHandInfo.type}` : '新回合';
    updateRoomControls(state);
    if (state.currentPlayerId !== myUserId || state.status !== 'playing') clearHintsAndSelection(false);
}
function clearPlayerAreaDOM(area) {
     if (!area) return;
     area.classList.remove('current-turn');
     const nameEl = area.querySelector('.playerName');
     const roleEl = area.querySelector('.playerRole');
     const infoEl = area.querySelector('.playerInfo');
     const cardsEl = area.querySelector('.playerCards');
     const handCountEl = area.querySelector('.hand-count-display');
     if (nameEl) nameEl.textContent = '空位';
     if (roleEl) roleEl.textContent = '';
     if (infoEl) infoEl.innerHTML = '';
     if (cardsEl) cardsEl.innerHTML = '';
     if (handCountEl) handCountEl.remove();
     if (area.id === 'playerAreaBottom') {
        const actions = area.querySelector('.my-actions');
        if(actions) { actions.classList.add('hidden-view'); actions.classList.remove('view-flex');}
     }
}
function renderPlayerArea(container, playerData, isMe, state) {
    const nameEl = container.querySelector('.playerName');
    const roleEl = container.querySelector('.playerRole');
    const infoEl = container.querySelector('.playerInfo');
    const cardsEl = container.querySelector('.playerCards');
    if (nameEl) nameEl.textContent = playerData.username + (isMe ? ' (你)' : '');
    if (roleEl) roleEl.textContent = playerData.role ? `[${playerData.role}]` : '[?]';
    if (infoEl) {
        let infoText = `总分: ${playerData.score || 0}`;
        if (playerData.finished) infoText += ' <span class="finished">[已完成]</span>';
        else if (!playerData.connected && state.status !== 'waiting') infoText += ' <span class="disconnected">[已断线]</span>';
        else if (state.status === 'waiting') infoText += playerData.isReady ? ' <span class="ready">[已准备]</span>' : ' <span class="not-ready">[未准备]</span>';
        infoEl.innerHTML = infoText;
    }
    if (cardsEl) renderPlayerCards(cardsEl, playerData, isMe, state.status === 'playing' && state.currentPlayerId === myUserId);
    if (state.status === 'playing' && playerData.userId === state.currentPlayerId) container.classList.add('current-turn');
    else container.classList.remove('current-turn');
}

function fanCards(cardContainer, cardElements, areaId) {
    const numCards = cardElements.length;
    if (numCards === 0) return;

    const cardWidth = 55; // From CSS .card width

    if (areaId === 'playerAreaBottom') { // My hand - horizontal spread with overlap
        const overlap = -30; 
        const totalHandWidth = numCards * (cardWidth + overlap) - overlap;
        let startX = (cardContainer.offsetWidth - totalHandWidth) / 2;

        cardElements.forEach((card, i) => {
            card.style.left = `${startX + i * (cardWidth + overlap)}px`;
            card.style.zIndex = i;
        });
    } else { // Opponent hands - fanned rotation
        let maxAngle = 30;
        if (areaId === 'playerAreaLeft' || areaId === 'playerAreaRight') {
            maxAngle = 40; // Slightly wider fan for side players
        }
        let angleStep = numCards > 1 ? maxAngle / (numCards - 1) : 0;
        angleStep = Math.min(angleStep, areaId === 'playerAreaTop' ? 4 : 5);

        let initialRotation = -((numCards - 1) * angleStep) / 2;
        let yOffsetPerCard = 1.8; // Increased for more visible stacking

        cardElements.forEach((card, i) => {
            const rotation = initialRotation + i * angleStep;
            let tx = "0px", ty = "0px";

            if (areaId === 'playerAreaTop') {
                card.style.left = `calc(50% - ${cardWidth / 2}px)`;
                ty = `${i * yOffsetPerCard}px`;
                card.style.transform = `translateY(${ty}) rotate(${rotation}deg)`;
                card.style.zIndex = numCards - i;
            } else if (areaId === 'playerAreaLeft') {
                tx = `${i * yOffsetPerCard}px`;
                card.style.transform = `translateX(${tx}) rotate(${rotation}deg) translateY(-50%)`;
                card.style.zIndex = numCards - i;
            } else if (areaId === 'playerAreaRight') {
                tx = `${-i * yOffsetPerCard}px`;
                card.style.transform = `translateX(${tx}) rotate(${rotation}deg) translateY(-50%)`;
                card.style.zIndex = i;
            }
        });
    }
}


function renderPlayerCards(container, playerData, isMe, isMyTurnAndPlaying) {
    container.innerHTML = '';
    const cardElements = [];

    if (isMe) {
        let sortedHand = playerData.hand ? [...playerData.hand] : [];
        if (sortedHand.length === 0 && !playerData.finished) {
             container.innerHTML = '<span style="color:#555; font-style:italic;">- 无手牌 -</span>';
        } else if (playerData.finished) {
            container.innerHTML = '<span style="color:gray; font-style:italic;">已出完</span>';
        } else {
            if (currentSortMode === 'rank') sortedHand.sort(compareSingleCardsClient);
            else if (currentSortMode === 'suit') sortedHand.sort(compareBySuitThenRank);

            sortedHand.forEach(cardData => {
                const cardElement = renderCard(cardData, false);
                const isSelected = selectedCards.some(c => c.rank === cardData.rank && c.suit === cardData.suit);
                const isHinted = currentHint && currentHint.cards.some(c => c.rank === cardData.rank && c.suit === cardData.suit);
                if (isSelected) cardElement.classList.add('selected');
                if (isHinted) cardElement.classList.add('hinted');
                if (isMyTurnAndPlaying) {
                    cardElement.onclick = () => toggleCardSelection(cardData, cardElement);
                    cardElement.classList.remove('disabled');
                } else {
                    cardElement.classList.add('disabled');
                }
                container.appendChild(cardElement);
                cardElements.push(cardElement);
            });
        }
    } else {
        if (playerData.finished) {
            container.innerHTML = '<span style="color:gray; font-style:italic;">已出完</span>';
        } else if (playerData.handCount > 0) {
            for (let i = 0; i < playerData.handCount; i++) {
                const cardElement = renderCard(null, true);
                container.appendChild(cardElement);
                cardElements.push(cardElement);
            }
            let handCountEl = container.closest('.playerArea')?.querySelector('.hand-count-display');
            if (!handCountEl) {
                handCountEl = document.createElement('div');
                handCountEl.classList.add('hand-count-display');
                container.closest('.playerArea')?.appendChild(handCountEl);
            }
            handCountEl.textContent = `${playerData.handCount} 张`;

        } else {
            container.innerHTML = '<span style="color:#555; font-style:italic;">- 无手牌 -</span>';
            let handCountEl = container.closest('.playerArea')?.querySelector('.hand-count-display');
            if (handCountEl) handCountEl.remove();
        }
    }

    if (cardElements.length > 0) {
        requestAnimationFrame(() => {
             fanCards(container, cardElements, container.closest('.playerArea')?.id);
        });
    }
}

function renderCard(cardData, isHidden, isCenterPileCard = false) {
    const cardDiv = document.createElement('div'); cardDiv.classList.add('card');
    if (isCenterPileCard) {
        cardDiv.style.position = 'relative';
        cardDiv.style.margin = '3px';
    }

    if (isHidden || !cardData) {
        cardDiv.classList.add('hidden');
    } else {
        cardDiv.classList.add('visible'); cardDiv.classList.add(getSuitClass(cardData.suit));
        const rankSpan = document.createElement('span'); rankSpan.classList.add('rank'); rankSpan.textContent = cardData.rank === 'T' ? '10' : cardData.rank; cardDiv.appendChild(rankSpan);
        const suitSpan = document.createElement('span'); suitSpan.classList.add('suit'); suitSpan.textContent = getSuitSymbol(cardData.suit); cardDiv.appendChild(suitSpan);
        cardDiv.dataset.suit = cardData.suit; cardDiv.dataset.rank = cardData.rank;
    }
    return cardDiv;
 }
function updateRoomControls(state) {
    if (!state || !myUserId) return;
    const myPlayerInState = state.players.find(p => p.userId === myUserId);
    if (!myPlayerInState) return;

    if (state.status === 'waiting') {
        readyButton.classList.remove('hidden-view'); readyButton.classList.add('view-inline-block');
        readyButton.textContent = myPlayerInState.isReady ? '取消准备' : '准备';
        readyButton.classList.toggle('ready', myPlayerInState.isReady);
        readyButton.disabled = false;
        const numPlayers = state.players.length;
        const maxPlayers = 4; // Assuming maxPlayers is always 4 for this game
        displayMessage(gameMessage, `等待 ${numPlayers}/${maxPlayers} 位玩家准备...`, false);

        if(myActionsArea) { myActionsArea.classList.add('hidden-view'); myActionsArea.classList.remove('view-flex'); }
    } else if (state.status === 'playing') {
        readyButton.classList.add('hidden-view'); readyButton.classList.remove('view-inline-block');
        const currentPlayer = state.players.find(p => p.userId === state.currentPlayerId);
        const turnMessage = currentPlayer ? (currentPlayer.userId === myUserId ? '轮到你出牌！' : `等待 ${currentPlayer.username} 出牌...`) : '游戏进行中...';
        if (gameMessage.textContent !== turnMessage && !gameMessage.classList.contains('error') && !gameMessage.classList.contains('success')) {
            displayMessage(gameMessage, turnMessage, false);
        }


        if (myActionsArea) {
            if (state.currentPlayerId === myUserId && !myPlayerInState.finished) {
                myActionsArea.classList.remove('hidden-view'); myActionsArea.classList.add('view-flex');
                if(playSelectedCardsButton) playSelectedCardsButton.disabled = selectedCards.length === 0;
                if(passTurnButton) { // Logic for disabling pass button
                    let disablePass = (!state.lastHandInfo && !state.isFirstTurn); // Cannot pass if leading new round (not first turn)
                    if (state.isFirstTurn && !state.lastHandInfo) { // If it's the first turn of the game and pile is empty
                         const iAmD4Holder = myPlayerInState.hand && myPlayerInState.hand.some(c => c.rank === '4' && c.suit === 'D');
                         if (iAmD4Holder) disablePass = true; // D4 holder must play D4
                    }
                    passTurnButton.disabled = disablePass;
                }
                if(hintButton) hintButton.disabled = false;
                if(sortHandButton) sortHandButton.disabled = false;
            } else {
                myActionsArea.classList.add('hidden-view'); myActionsArea.classList.remove('view-flex');
            }
        }
    } else if (state.status === 'finished') {
        readyButton.classList.add('hidden-view'); readyButton.classList.remove('view-inline-block');
        if(myActionsArea) { myActionsArea.classList.add('hidden-view'); myActionsArea.classList.remove('view-flex'); }
    }
}

function handleRegister() {
    const phone = regPhoneInput.value.trim(); const password = regPasswordInput.value;
    if (!phone || !password) { displayMessage(authMessage, '请输入手机号和密码。', true); return; }
    if (password.length < 4) { displayMessage(authMessage, '密码至少需要4位。', true); return; }
    registerButton.disabled = true;
    socket.emit('register', { phoneNumber: phone, password }, (response) => {
        registerButton.disabled = false;
        displayMessage(authMessage, response.message, !response.success, response.success);
        if (response.success) { regPhoneInput.value = ''; regPasswordInput.value = ''; }
    });
 }
function handleLogin() {
     const phone = loginPhoneInput.value.trim(); const password = loginPasswordInput.value;
     if (!phone || !password) { displayMessage(authMessage, '请输入手机号和密码。', true); return; }
     loginButton.disabled = true;
     socket.emit('login', { phoneNumber: phone, password }, (response) => {
         loginButton.disabled = false;
         displayMessage(authMessage, response.message, !response.success, response.success);
         if (response.success) {
             myUserId = response.userId; myUsername = response.username;
             try { localStorage.setItem('kkUserId', myUserId); localStorage.setItem('kkUsername', myUsername); }
             catch (e) { console.warn('LocalStorage error while saving user session:', e); }
             if(lobbyUsername) lobbyUsername.textContent = myUsername;
             showView('lobbyView');
         }
     });
 }
function handleLogout() {
      console.log('Logging out...');
      try { localStorage.removeItem('kkUserId'); localStorage.removeItem('kkUsername'); }
      catch (e) { console.warn('LocalStorage error while removing user session:', e); }
      myUserId = null; myUsername = null; currentRoomId = null; currentGameState = null; isReadyForGame = false; selectedCards = []; currentHint = null; currentHintCycleIndex = 0;

      if (socket.connected) socket.disconnect();
      socket.connect();

      showView('loginRegisterView');
 }
function handleCreateRoom() {
     const roomName = createRoomNameInput.value.trim(); const password = createRoomPasswordInput.value;
     if (!roomName) { displayMessage(lobbyMessage, '请输入房间名称。', true); return; }
     createRoomButton.disabled = true;
     socket.emit('createRoom', { roomName, password: password || null }, (response) => {
         createRoomButton.disabled = false;
         displayMessage(lobbyMessage, response.message, !response.success, response.success);
         if (response.success) {
             currentRoomId = response.roomId;
             showView('roomView');
             renderRoomView(response.roomState);
             createRoomNameInput.value = ''; createRoomPasswordInput.value = '';
         }
     });
 }
function joinRoom(roomId, needsPassword) {
      let passwordToTry = null;
      if (needsPassword) {
          passwordToTry = prompt(`房间 "${roomId}" 受密码保护，请输入密码:`, '');
          if (passwordToTry === null) return;
      }
      displayMessage(lobbyMessage, `正在加入房间 ${roomId}...`, false);
      socket.emit('joinRoom', { roomId, password: passwordToTry }, (response) => {
          displayMessage(lobbyMessage, response.message, !response.success, response.success);
          if (response.success) {
              currentRoomId = response.roomId;
              showView('roomView');
              renderRoomView(response.roomState);
          }
      });
 }
function handleReadyClick() {
      if (!currentRoomId || !currentGameState) return;
      const desiredReadyState = !isReadyForGame;
      readyButton.disabled = true;
      socket.emit('playerReady', desiredReadyState, (response) => {
           readyButton.disabled = false;
           if (!response.success) {
               displayMessage(gameMessage, response.message || "无法改变准备状态。", true);
           }
      });
 }

function handleLeaveRoom() {
    if (!currentRoomId && currentView === 'roomView') {
        console.warn("In room view but no currentRoomId, forcing back to lobby.");
        currentRoomId = null; currentGameState = null; selectedCards = []; currentHint = null; currentHintCycleIndex = 0;
        showView('lobbyView');
        socket.emit('listRooms', (rooms) => renderRoomList(rooms));
        return;
    }
    if (!currentRoomId) {
        console.log("Not in a room to leave.");
        return;
    }

    console.log(`Attempting to leave room: ${currentRoomId}`);
    if (leaveRoomButton) leaveRoomButton.disabled = true;

    socket.emit('leaveRoom', (response) => {
        if (leaveRoomButton) leaveRoomButton.disabled = false;
        if (response.success) {
            displayMessage(lobbyMessage, response.message || '已离开房间。', false, true);
            currentRoomId = null; currentGameState = null; selectedCards = []; currentHint = null; currentHintCycleIndex = 0; isReadyForGame = false;
            showView('lobbyView');
            socket.emit('listRooms', (rooms) => renderRoomList(rooms));
        } else {
            displayMessage(gameMessage, response.message || '离开房间失败。', true);
        }
    });
}

function handleSortHand() {
    if (currentSortMode === 'rank') currentSortMode = 'suit';
    else currentSortMode = 'rank';
    console.log("Sorting mode changed to:", currentSortMode);
    if (currentGameState && currentView === 'roomView') {
        renderRoomView(currentGameState);
    }
    clearHintsAndSelection(true);
}
function toggleCardSelection(cardData, cardElement) {
    if (!cardElement || cardElement.classList.contains('disabled')) return;
    clearHintsAndSelection(false);

    const index = selectedCards.findIndex(c => c.rank === cardData.rank && c.suit === cardData.suit);
    if (index > -1) {
        selectedCards.splice(index, 1);
        cardElement.classList.remove('selected');
    } else {
        selectedCards.push(cardData);
        cardElement.classList.add('selected');
    }
    if (playSelectedCardsButton && currentGameState && currentGameState.currentPlayerId === myUserId) { // Check if it's my turn
         playSelectedCardsButton.disabled = selectedCards.length === 0;
    }
}
function handlePlaySelectedCards() {
    if (selectedCards.length === 0) { displayMessage(gameMessage, '请先选择要出的牌。', true); return; }
    if (!currentRoomId || !currentGameState || currentGameState.status !== 'playing' || currentGameState.currentPlayerId !== myUserId) {
        displayMessage(gameMessage, '现在不是你的回合或状态无效。', true); return;
    }
    // displayMessage(gameMessage, '正在出牌...', false); // Let server response handle messages primarily
    setGameActionButtonsDisabled(true);

    socket.emit('playCard', selectedCards, (response) => {
        if (currentGameState && currentGameState.currentPlayerId === myUserId) {
            setGameActionButtonsDisabled(false);
        }
        if (!response.success) {
            displayMessage(gameMessage, response.message || '出牌失败。', true);
        } else {
            // displayMessage(gameMessage, '');
            selectedCards = [];
            clearHintsAndSelection(true);
        }
    });
}
function handlePassTurn() {
    if (!currentRoomId || !currentGameState || currentGameState.status !== 'playing' || currentGameState.currentPlayerId !== myUserId) {
        displayMessage(gameMessage, '现在不是你的回合或状态无效。', true); return;
    }
    // Client-side check if pass is allowed (from updateRoomControls logic)
    if (passTurnButton.disabled) { // If button is already disabled by our logic, don't proceed
        displayMessage(gameMessage, '你必须出牌。', true);
        return;
    }

    // displayMessage(gameMessage, '正在 Pass...', false);
    setGameActionButtonsDisabled(true);
    selectedCards = [];

    socket.emit('passTurn', (response) => {
        if (currentGameState && currentGameState.currentPlayerId === myUserId) {
             setGameActionButtonsDisabled(false);
        }
        if (!response.success) {
            displayMessage(gameMessage, response.message || 'Pass 失败。', true);
        } else {
            // displayMessage(gameMessage, '');
            clearHintsAndSelection(true);
        }
    });
}
function handleHint() {
    if (!currentRoomId || !currentGameState || currentGameState.status !== 'playing' || currentGameState.currentPlayerId !== myUserId) {
        displayMessage(gameMessage, '现在不是你的回合或状态无效。', true); return;
    }
    clearHintsAndSelection(false);
    setGameActionButtonsDisabled(true);
    // displayMessage(gameMessage, '正在获取提示...', false);

    socket.emit('requestHint', currentHintCycleIndex, (response) => {
        if (currentGameState && currentGameState.currentPlayerId === myUserId) {
            setGameActionButtonsDisabled(false);
        }
        if (response.success && response.hint && response.hint.cards) {
            displayMessage(gameMessage, '找到提示！(点击提示可尝试下一个)', false, true);
            currentHint = response.hint;
            currentHintCycleIndex = response.nextHintIndex;
            highlightHintedCards(currentHint.cards);
        } else {
            displayMessage(gameMessage, response.message || '没有可出的牌或无更多提示。', true);
            currentHint = null;
            currentHintCycleIndex = 0;
        }
    });
}
function setGameActionButtonsDisabled(disabled) {
    // This function will be called by updateRoomControls primarily
    // It's kept here in case of direct calls, but updateRoomControls is the main source of truth
    if(playSelectedCardsButton) playSelectedCardsButton.disabled = disabled || selectedCards.length === 0;
    if(passTurnButton) {
        let canPass = currentGameState && (!!currentGameState.lastHandInfo || currentGameState.isFirstTurn);
        if (currentGameState && currentGameState.isFirstTurn && !currentGameState.lastHandInfo) {
            const myPlayer = currentGameState.players.find(p => p.userId === myUserId);
            if (myPlayer && myPlayer.hand && myPlayer.hand.some(c => c.rank === '4' && c.suit === 'D')) {
                canPass = false;
            }
        }
        passTurnButton.disabled = disabled || !canPass;
    }
    if(hintButton) hintButton.disabled = disabled;
}

function highlightHintedCards(hintedCardsArray) {
    if (!hintedCardsArray || hintedCardsArray.length === 0) return;
    if (!myHandArea) return;
    const cardElements = myHandArea.querySelectorAll('.card.visible:not(.hidden)');
    hintedCardsArray.forEach(hintCard => {
        for(const elem of cardElements) {
            if(elem.dataset.rank === hintCard.rank && elem.dataset.suit === hintCard.suit) {
                elem.classList.add('hinted');
                break;
            }
        }
    });
}
function clearHintsAndSelection(resetHintCycle = true) {
    if (resetHintCycle) {
        currentHint = null;
        currentHintCycleIndex = 0;
    }
    if (myHandArea) {
        const hintedElements = myHandArea.querySelectorAll('.card.hinted');
        hintedElements.forEach(el => el.classList.remove('hinted'));
    }
}
function showGameOver(scoreResultData) {
    if (!scoreResultData) {
        console.warn("showGameOver called with no data.");
        gameOverTitle.textContent = "游戏结束!";
        gameOverReason.textContent = "无法获取详细结果。";
        gameOverScores.innerHTML = '';
    } else {
        gameOverTitle.textContent = scoreResultData.result || "游戏结束!";
        gameOverReason.textContent = scoreResultData.reason || "";
        gameOverScores.innerHTML = '';

        const playersToDisplay = scoreResultData.finalScores || currentGameState?.players || [];

        playersToDisplay.forEach(playerData => {
            const p = document.createElement('p');
            let scoreText = `${playerData.name} (${playerData.role || '?'})`;
            if (scoreResultData.scoreChanges && scoreResultData.scoreChanges[playerData.id] !== undefined) {
                const change = scoreResultData.scoreChanges[playerData.id];
                const changeDisplay = change > 0 ? `+${change}` : (change < 0 ? `${change}` : '0');
                const changeClass = change > 0 ? 'score-plus' : (change < 0 ? 'score-minus' : 'score-zero');
                scoreText += ` : <span class="${changeClass}">${changeDisplay}</span>`;
            }
            scoreText += ` (总分: ${playerData.score})`;
            p.innerHTML = scoreText;
            gameOverScores.appendChild(p);
        });
    }
    showView('gameOverOverlay');
}

// --- Socket Event Listeners ---
socket.on('connect', () => {
    console.log('Connected to server! Socket ID:', socket.id);
    initClientSession();
});
socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (currentView !== 'loginRegisterView') {
        showView('loadingView');
        displayMessage(loadingView.querySelector('p'), `与服务器断开连接: ${reason}. 请刷新页面或等待重连...`, true);
    }
    currentRoomId = null; currentGameState = null; isReadyForGame = false;
});
socket.on('roomListUpdate', (rooms) => {
    console.log('Received room list update:', rooms);
    if (currentView === 'lobbyView') renderRoomList(rooms);
});
socket.on('playerReadyUpdate', ({ userId, isReady }) => {
    if (currentGameState && currentView === 'roomView') {
        const player = currentGameState.players.find(p => p.userId === userId);
        if (player) player.isReady = isReady;
        if (userId === myUserId) isReadyForGame = isReady;
        renderRoomView(currentGameState);
    }
});
socket.on('playerJoined', (newPlayerInfo) => {
    if (currentGameState && currentView === 'roomView') {
        console.log('Player joined:', newPlayerInfo.username);
        const existingPlayer = currentGameState.players.find(p => p.userId === newPlayerInfo.userId);
        if (existingPlayer) {
            Object.assign(existingPlayer, newPlayerInfo, {connected: true});
        } else {
            currentGameState.players.push({ ...newPlayerInfo, score:0, hand:undefined, handCount:0, role:null, finished:false, connected:true });
        }
        currentGameState.players.sort((a,b) => a.slot - b.slot);
        renderRoomView(currentGameState);
        displayMessage(gameMessage, `${newPlayerInfo.username} 加入了房间。`, false, true);
    }
});
socket.on('playerLeft', ({ userId, username, reason }) => {
    if (currentGameState && currentView === 'roomView') {
        console.log('Player left:', username, reason);
        const player = currentGameState.players.find(p => p.userId === userId);
        if (player) {
            player.connected = false;
            player.isReady = false;
        }
        renderRoomView(currentGameState);
        displayMessage(gameMessage, `${username} ${reason === 'disconnected' ? '断线了' : '离开了房间'}。`, true);
    }
});
socket.on('playerReconnected', (reconnectedPlayerInfo) => {
     if (currentGameState && currentView === 'roomView') {
        console.log('Player reconnected:', reconnectedPlayerInfo.username);
        const player = currentGameState.players.find(p => p.userId === reconnectedPlayerInfo.userId);
        if (player) {
            Object.assign(player, reconnectedPlayerInfo, {connected: true});
        } else {
            currentGameState.players.push({ ...reconnectedPlayerInfo, score:0, hand:undefined, handCount:0, role:null, finished:false, connected:true });
            currentGameState.players.sort((a,b) => a.slot - b.slot);
        }
        renderRoomView(currentGameState);
        displayMessage(gameMessage, `${reconnectedPlayerInfo.username} 重新连接。`, false, true);
    }
});
socket.on('gameStarted', (initialGameState) => {
    if (currentView === 'roomView' && currentRoomId === initialGameState.roomId) {
        console.log('Game started!', initialGameState);
        displayMessage(gameMessage, '游戏开始！祝你好运！', false, true);
        selectedCards = []; clearHintsAndSelection(true);
        renderRoomView(initialGameState);
    }
});
socket.on('gameStateUpdate', (newState) => {
    if (currentView === 'roomView' && currentRoomId === newState.roomId) {
        console.log('GameStateUpdate received. Current Player:', newState.currentPlayerId, 'My ID:', myUserId, 'My turn?', newState.currentPlayerId === myUserId);
        if (currentGameState && (currentGameState.currentPlayerId === myUserId && newState.currentPlayerId !== myUserId) ||
            (currentGameState.status !== newState.status) ) {
            selectedCards = [];
            clearHintsAndSelection(true);
        }
        renderRoomView(newState);
    } else if (currentRoomId && currentRoomId !== newState.roomId) {
        console.warn("Received gameStateUpdate for a different room. Ignoring.");
    }
});
socket.on('invalidPlay', ({ message }) => {
    displayMessage(gameMessage, `操作无效: ${message}`, true);
    if (currentGameState && currentGameState.currentPlayerId === myUserId) {
        setGameActionButtonsDisabled(false); // Re-enable buttons on invalid play
    }
});
socket.on('gameOver', (results) => {
    if (currentGameState && currentView === 'roomView' && currentRoomId === currentGameState.roomId) {
        console.log('Game Over event received:', results);
        currentGameState.status = 'finished';
        showGameOver(results);
    }
});
socket.on('gameStartFailed', ({ message }) => {
    if (currentView === 'roomView') {
        displayMessage(gameMessage, `游戏开始失败: ${message}`, true);
        if (currentGameState) {
            currentGameState.players.forEach(p => p.isReady = false);
            isReadyForGame = false;
            renderRoomView(currentGameState);
        }
    }
});
socket.on('allPlayersResetReady', () => {
    if (currentGameState && currentView === 'roomView' && currentGameState.status === 'waiting') {
        currentGameState.players.forEach(p => p.isReady = false);
        isReadyForGame = false;
        renderRoomView(currentGameState);
        displayMessage(gameMessage, '部分玩家状态变更，请重新准备。', true);
    }
});

// --- Initial Setup ---
function initClientSession() {
    let storedUserId = null;
    try {
        storedUserId = localStorage.getItem('kkUserId');
    } catch (e) {
        console.warn('Error accessing localStorage for user ID:', e);
        showView('loginRegisterView');
        return;
    }

    if (storedUserId) {
        console.log(`Found stored user ID: ${storedUserId}. Attempting reauthentication...`);
        showView('loadingView'); displayMessage(loadingView.querySelector('p'), "正在重新连接...", false);
        socket.emit('reauthenticate', storedUserId, (response) => {
            if (response.success) {
                myUserId = response.userId;
                myUsername = response.username;
                if (lobbyUsername) lobbyUsername.textContent = myUsername;

                if (response.roomState) {
                    currentRoomId = response.roomState.roomId;
                    showView('roomView');
                    renderRoomView(response.roomState);
                } else {
                    showView('lobbyView');
                }
                displayMessage(authMessage, response.message, !response.success, response.success);
            } else {
                try { localStorage.removeItem('kkUserId'); localStorage.removeItem('kkUsername'); } catch (e) {}
                displayMessage(authMessage, response.message, true);
                showView('loginRegisterView');
            }
        });
    } else {
         console.log('No stored user ID found.');
         showView('loginRegisterView');
    }
}

function setupEventListeners() {
    if(registerButton) registerButton.addEventListener('click', handleRegister);
    if(loginButton) loginButton.addEventListener('click', handleLogin);
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);
    if(createRoomButton) createRoomButton.addEventListener('click', handleCreateRoom);
    if(readyButton) readyButton.addEventListener('click', handleReadyClick);
    if(leaveRoomButton) leaveRoomButton.addEventListener('click', handleLeaveRoom);
    if(sortHandButton) sortHandButton.addEventListener('click', handleSortHand);
    if(playSelectedCardsButton) playSelectedCardsButton.addEventListener('click', handlePlaySelectedCards);
    if(passTurnButton) passTurnButton.addEventListener('click', handlePassTurn);
    if(hintButton) hintButton.addEventListener('click', handleHint);
    if(backToLobbyButton) backToLobbyButton.addEventListener('click', () => {
        currentRoomId = null; currentGameState = null; isReadyForGame = false;
        selectedCards = []; currentHint = null; currentHintCycleIndex = 0;
        showView('lobbyView');
        socket.emit('listRooms', (rooms) => renderRoomList(rooms));
    });

    regPasswordInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleRegister(); });
    loginPasswordInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    createRoomPasswordInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleCreateRoom(); });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Setting up client...");
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';
    setupEventListeners();

    if (socket.connected) {
         initClientSession();
    } else {
        showView('loadingView');
        displayMessage(loadingView.querySelector('p'), "正在连接服务器...", false);
    }
    console.log('Client setup complete.');
});
