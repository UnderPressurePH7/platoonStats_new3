import EventEmitter from './eventEmitter.js';
import { GAME_POINTS, STATS } from './constants.js';

class BattleDataManager {
  constructor() {


    const savedState = localStorage.getItem('gameState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.BattleStats = state.BattleStats || {};
      this.PlayersInfo = state.PlayersInfo || {};
    }

    this.filteredBattles = [];
    this.eventsHistory = new EventEmitter();
  }

  saveState() {
    const state = {
      BattleStats: this.BattleStats
    };

    localStorage.setItem('gameState', JSON.stringify(state));
  }

  clearState() {
    localStorage.removeItem('gameState');

    this.BattleStats = {};
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAccessKey() {
    return localStorage.getItem('accessKey');
  }

  getBattlesArray() {
    return Object.entries(this.BattleStats).map(([arenaId, battle]) => ({
      id: arenaId,
      ...battle
    }));
  }

  calculateBattleData(battle) {
    let battlePoints = 0;
    let battleDamage = 0;
    let battleKills = 0;
    
    if (battle.win === 1) {
      battlePoints += GAME_POINTS.POINTS_PER_TEAM_WIN;
    }

    if (battle && battle.players) {
      Object.values(battle.players).forEach(player => {
        battlePoints += player.points || 0;
        battleDamage += player.damage || 0;
        battleKills += player.kills || 0;
      });
    }

    return { battlePoints, battleDamage, battleKills };
  }

  calculatePlayerData(playerId) {
    let playerPoints = 0;
    let playerDamage = 0;
    let playerKills = 0;

    for (const arenaId in this.BattleStats) {
      const player = this.BattleStats[arenaId].players[playerId];
      playerPoints += player.points;
      playerDamage += player.damage;
      playerKills += player.kills;
    }
    return { playerPoints, playerDamage, playerKills };
  }

  calculateTeamData() {
    let teamPoints = 0;
    let teamDamage = 0;
    let teamKills = 0;
    let wins = 0;
    let battles = 0;


    for (const arenaId in this.BattleStats) {
      battles++;
      if (this.BattleStats[arenaId].win === 1) { 
        teamPoints += GAME_POINTS.POINTS_PER_TEAM_WIN; wins++; 
      }
      for (const playerId in this.BattleStats[arenaId].players) {
        const player = this.BattleStats[arenaId].players[playerId];
        teamPoints += player.points;
        teamDamage += player.damage;
        teamKills += player.kills;
      }
    }
    return { teamPoints, teamDamage, teamKills, wins, battles };
  }

  async saveToServer() {

    try {
      const accessKey = this.getAccessKey();
      const response = await fetch(`${atob(STATS.BATTLE)}import/${accessKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BattleStats: this.BattleStats
        }),
      });

      if (!response.ok) {
        throw new Error(`Помилка при збереженні даних: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Помилка при збереженні даних');
      }
      return true;
    } catch (error) {
      console.error('Помилка при збереженні даних на сервер:', error);
      throw error;
    }
  }

  async loadFromServer() {
    try {
      const accessKey = this.getAccessKey();
      if (!accessKey) {
        throw new Error('Access key not found');
      }
      const response = await fetch(`${atob(STATS.BATTLE)}${accessKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Помилка при завантаженні даних: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        if (data.BattleStats) {
          this.BattleStats = data.BattleStats;
        }
        if (data.PlayerInfo) {
          this.PlayersInfo = data.PlayerInfo;
        }
      }
      return true;
    } catch (error) {
      console.error('Помилка при завантаженні даних із сервера:', error);
      throw error;
    }
  }


  async deleteBattle(battleId) {

    try {
      const accessKey = this.getAccessKey();
      const response = await fetch(`${atob(STATS.BATTLE)}${accessKey}\\${battleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Помилка при очищенні даних: ${response.statusText}`);
      }
      // Видаляємо бій з локальних даних
      if (this.BattleStats[battleId]) {
        delete this.BattleStats[battleId];
        this.saveState(); // Зберігаємо зміни в локальному сховищі
      }
      const data = await response.json();
      this.eventsHistory.emit('battleDeleted', battleId);
      return true;
    } catch (error) {
      console.error('Помилка при очищенні даних на сервері:', error);
    }
    return false;
  }

  async applyFilters(filters) {
    // Отримуємо всі бої
    let filteredBattles = this.getBattlesArray();

    // Фільтруємо за мапою
    if (filters.map) {
      filteredBattles = filteredBattles.filter(battle =>
        battle.mapName === filters.map
      );
    }

    // Фільтруємо за танком
    if (filters.vehicle) {
      filteredBattles = filteredBattles.filter(battle => {
        if (!battle.players) return false;
        return Object.values(battle.players).some(player =>
          player.vehicle === filters.vehicle
        );
      });
    }

    // Фільтруємо за результатом
    if (filters.result) {
      filteredBattles = filteredBattles.filter(battle => {
        if (filters.result === 'victory') {
          return battle.win === 1;
        } else if (filters.result === 'defeat') {
          return battle.win === 0;
        } else if (filters.result === 'draw') {
          return battle.win === 2;
        } else if (filters.result === 'inBattle') {
          return battle.win === -1;
        }
        return true;
      });
    }

    // Фільтруємо за датою
    if (filters.date) {
      const filterDate = new Date(filters.date);
      filterDate.setHours(0, 0, 0, 0);

      filteredBattles = filteredBattles.filter(battle => {
        if (!battle.startTime) return false;

        const battleDate = new Date(battle.startTime);
        battleDate.setHours(0, 0, 0, 0);

        return battleDate.getTime() === filterDate.getTime();
      });
    }

    // Фільтруємо за гравцем
    if (filters.player) {
      filteredBattles = filteredBattles.filter(battle => {
        if (!battle.players) return false;

        return Object.values(battle.players).some(player =>
          player.name === filters.player
        );
      });
    }

    // Зберігаємо відфільтровані бої
    this.filteredBattles = filteredBattles;

    // Сповіщаємо про застосування фільтрів
    this.eventsHistory.emit('filtersApplied', this.filteredBattles);

    return this.filteredBattles;
  }

  async exportData() {
    try {
      return JSON.stringify(this.BattleStats, null, 2);
    } catch (e) {
      console.error("Помилка при експортуванні даних:", e);
      return null;
    }
  }


  async importData(importedData) {
    try {
      if (!importedData || typeof importedData !== 'object') {
        console.error("Неправильний формат даних для імпорту");
        return false;
      }

      await this.loadFromServer();

      for (const [arenaId, battleData] of Object.entries(importedData)) {
        if (!battleData || typeof battleData !== 'object') continue;

        if (!this.validateBattleData(battleData)) continue;

        if (this.BattleStats[arenaId]) {
          this.BattleStats[arenaId] = {
            ...this.BattleStats[arenaId],
            ...battleData,
            players: {
              ...this.BattleStats[arenaId].players,
              ...battleData.players
            }
          };
        } else {
          this.BattleStats[arenaId] = battleData;
        }
      }

      const saveSuccess = await this.saveToServer();
      if (!saveSuccess) {
        throw new Error('Failed to save data to server');
      }

      this.clearState();
      this.sleep(10);
      await this.loadFromServer();
      this.sleep(10);
      this.saveState();

      this.eventsHistory.emit('dataImported', importedData);
      return true;

    } catch (e) {
      console.error("Помилка при імпорті даних:", e);
      return false;
    }
  }

  validateBattleData(battleData) {
    const requiredFields = ['startTime', 'duration', 'win', 'mapName', 'players'];

    for (const field of requiredFields) {
      if (!(field in battleData)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    if (typeof battleData.players !== 'object') {
      console.error('Invalid players data structure');
      return false;
    }

    for (const [playerId, playerData] of Object.entries(battleData.players)) {
      if (!this.validatePlayerData(playerData)) {
        console.error(`Invalid player data for ID: ${playerId}`);
        return false;
      }
    }

    return true;
  }

  validatePlayerData(playerData) {
    const requiredPlayerFields = ['name', 'damage', 'kills', 'points', 'vehicle'];

    for (const field of requiredPlayerFields) {
      if (!(field in playerData)) {
        console.error(`Missing required player field: ${field}`);
        return false;
      }
    }

    if (typeof playerData.name !== 'string' ||
      typeof playerData.damage !== 'number' ||
      typeof playerData.kills !== 'number' ||
      typeof playerData.points !== 'number' ||
      typeof playerData.vehicle !== 'string') {
      console.error('Invalid player data types');
      return false;
    }

    return true;
  }
}

export default BattleDataManager;