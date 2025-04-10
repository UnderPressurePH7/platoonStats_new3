class UIService {
  constructor(coreService) {
    this.core = coreService;

    this.core.eventsCore.on('statsUpdated', () => {
      this.updatePlayersUI();
    });

    this.setupEventListeners();
  }

  updatePlayersUI() {
    const container = document.getElementById('player-container');
    container.innerHTML = '';

    const uniquePlayerIds = this.core.getPlayersIds();

    if (uniquePlayerIds.length === 0) {
      this.showEmptyMessage(container);
      return;
    }

    this.renderPlayerRows(container, uniquePlayerIds);
    this.updateTeamStatsUI();
  }

  showEmptyMessage(container) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'Гравців не знайдено';
    container.appendChild(emptyMessage);
  }

  renderPlayerRows(container, playerIds) {
    const playerRowStyle = playerIds.length > 2 ? 'font-size: 12px;' : '';

    playerIds.forEach(playerId => {
      const playerName = this.core.PlayersInfo[playerId];
      if (!playerName) return;

      const playerRow = this.createPlayerRow(playerId, playerRowStyle);
      container.appendChild(playerRow);
    });
  }

  createPlayerRow(playerId, style) {
  const playerRow = document.createElement('div');
  playerRow.className = 'player-row';
  if (style) playerRow.style = style;

  const playerName = this.core.PlayersInfo[playerId];
  const arenaId = this.core.curentArenaId;
  const cleanName = this.formatPlayerName(playerName);
  const displayName = this.truncateName(cleanName);

  let battleDamage = 0;
  let battleKills = 0;

  if (arenaId && this.core.BattleStats[arenaId] &&
    this.core.BattleStats[arenaId].players &&
    this.core.BattleStats[arenaId].players[playerId]) {
    battleDamage = this.core.BattleStats[arenaId].players[playerId].damage || 0;
    battleKills = this.core.BattleStats[arenaId].players[playerId].kills || 0;
  }

  const totalPlayerData = this.core.calculatePlayerData(playerId);
  const displayDamage = totalPlayerData.playerDamage;
  const displayKills = totalPlayerData.playerKills;
  const playerPoints = totalPlayerData.playerPoints;

  playerRow.innerHTML = `
    <div class="player-name" title="${cleanName}">${displayName}</div>
    <div class="stat-column">
      <div class="damage">+${battleDamage.toLocaleString()}</div>
      <div class="damage-in-battle" style="font-size: 9px; color: #ff6a00;">${displayDamage.toLocaleString()}</div>
    </div>
    <div class="stat-column">
      <div class="frags">+${battleKills}</div>
      <div class="frags-in-battle" style="font-size: 9px; color: #00a8ff;">${displayKills}</div>
    </div>
    <!-- Прихований стовпчик з очками -->
    <div class="stat-column" style="display:none">
      <div class="points">${playerPoints.toLocaleString()}</div>
    </div>
  `;

  return playerRow;
}

  updateTeamStatsUI() {
    const teamStats = this.core.calculateTeamData();
    const totalBattlePoints = this.core.calculateBattleData();
    // document.getElementById('team-damage').textContent = teamStats.teamDamage.toLocaleString();
    //document.getElementById('team-frags').textContent = teamStats.teamKills.toLocaleString();
    
    // Оновлення загальних фрагів на сторінці
    // const totalFragsElement = document.getElementById('total-frags');
    // if (totalFragsElement) {
    //   totalFragsElement.textContent = teamStats.teamKills.toLocaleString();
    // }
    
    // Оновлюємо найкращий і найгірший бій
    const battleStats = this.core.findBestAndWorstBattle();
    const bestBattleElement = document.getElementById('best-battle');
    const worstBattleElement = document.getElementById('worst-battle');
    
    if (bestBattleElement && battleStats.bestBattle) {
      bestBattleElement.textContent = battleStats.bestBattle.points.toLocaleString();
    } else if (bestBattleElement) {
      bestBattleElement.textContent = '0';
    }
    
    if (worstBattleElement && battleStats.worstBattle) {
      worstBattleElement.textContent = battleStats.worstBattle.points.toLocaleString();
    } else if (worstBattleElement) {
      worstBattleElement.textContent = '0';
    }
    
    document.getElementById('battles-count').textContent =
      `${teamStats.wins}/${teamStats.battles}`;

      document.getElementById('team-now-points').textContent = totalBattlePoints. battlePoints.toLocaleString();
    document.getElementById('team-points').textContent = teamStats.teamPoints.toLocaleString();
  }

  showSaveNotification() {
    const notification = document.createElement('div');
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(46, 204, 113, 0.9)',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '4px',
      fontWeight: '500',
      zIndex: '9999',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
    });

    notification.textContent = 'Бій збережено в історію';
    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }

  setupEventListeners() {

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      let isLoading = false;
      
      refreshBtn.addEventListener('click', async () => {
        try {
          if (isLoading) {
            alert('Оновлення вже виконується, зачекайте будь ласка.');
            return;
          }

          isLoading = true;
          refreshBtn.disabled = true;
          refreshBtn.textContent = 'Оновлення...';

          await this.core.loadFromServer();
          this.updatePlayersUI();
          this.core.saveState();

        } catch (error) {
          console.error('Помилка при оновленні даних:', error);
          
          if (error.message === 'Empty history') {
            alert('Історія боїв порожня.');
          } else if (error.message === 'Network error') {
            alert('Помилка з`єднання з сервером. Перевірте підключення до інтернету.');
          } else {
            alert(`Помилка при оновленні даних: ${error.message}`);
          }

        } finally {
          isLoading = false;
          refreshBtn.disabled = false;
          refreshBtn.textContent = 'Оновити дані';
        }
      });
    }

    const restoreBtn = document.getElementById('remove-history-btn');
    if (restoreBtn) {
      let isDeleting = false;
    
      restoreBtn.addEventListener('click', async () => {
        try {
          if (isDeleting) {
            alert('Процес видалення вже виконується, зачекайте будь ласка.');
            return;
          }
    
          if (!confirm('Видалити поточну статистику історії боїв?')) {
            return;
          }
          if (!confirm('Ви впевнені? Це незворотна дія!')) {
            return;
          }
    
          isDeleting = true;
          restoreBtn.disabled = true;
          restoreBtn.textContent = 'Видалення...';
    
          try {
            await this.core.loadFromServer();
          } catch (loadError) {
            console.warn('Попередження при завантаженні даних:', loadError);
          }
    
          await this.core.clearServerData();
          
          this.core.clearState()
          this.updatePlayersUI();
    
          alert('Статистику успішно видалено!');
    
        } catch (error) {
          console.error('Помилка при видаленні статистики:', error);
          
          if (error.message === 'Network error') {
            alert('Помилка з`єднання з сервером. Перевірте підключення до інтернету.');
          } else if (error.message === 'Permission denied') {
            alert('Немає прав для видалення даних.');
          } else if (error.message === 'Empty history') {
            alert('Історія боїв вже порожня.');
          } else {
            alert(`Помилка при видаленні статистики: ${error.message}`);
          }
    
        } finally {
          isDeleting = false;
          restoreBtn.disabled = false;
          restoreBtn.textContent = 'Видалити історію';
        }
      });
    }

    const viewHistoryBtn = document.getElementById('view-history-btn');
    if (viewHistoryBtn) {
      const accessKey = this.core.getAccessKey();
      viewHistoryBtn.addEventListener('click', () => {
        window.open('./battle-history/?' + accessKey, '_blank');
      });
    }
  }

  formatPlayerName(name) {
    if (!name) return 'Невідомий гравець';
    return String(name).replace(/\s*\[.*?\]/, '');
  }

  truncateName(name) {
    if (!name) return 'Невідомий';
    return name.length > 16 ? name.substring(0, 16) + '...' : name;
  }
}

export default UIService;
