import BattleDataManager from './battleDataManager.js';
import ChartManager from './chartManager.js';

class BattleUIHandler {
    constructor() {
        this.dataManager = new BattleDataManager();
        this.chartManager = new ChartManager(this.dataManager);
        
        // Змінні для найкращого і найгіршого бою
        this.worstBattleId = null;
        this.bestBattleId = null;
        
        // Змінні для пагінації
        this.itemsPerPage = 10;
        this.currentPage = 1;
        
        // Відображення колонок таблиці
        this.visibleColumns = {
            date: true,
            map: true,
            result: true,
            player: true,
            vehicle: true,
            damage: true,
            frags: true,
            points: true,
            total: true
        };
        
        this.setupEventListeners();
        this.setupTabSystem();
        this.initializeUI();

        // Підписка на події від менеджера даних
        this.dataManager.eventsHistory.on('statsUpdated', () => {
            this.updateStats();
            this.findBestAndWorstBattle();
        });
        
        this.dataManager.eventsHistory.on('filtersApplied', (filteredBattles) => {
            this.findBestAndWorstBattle(filteredBattles);
            this.updateBattleTable(filteredBattles);
        });
        
        this.dataManager.eventsHistory.on('battleDeleted', (battleId) => {
            // Перевіряємо, чи видалений бій був найгіршим або найкращим
            if (battleId === this.worstBattleId) {
                this.worstBattleId = null;
            }
            if (battleId === this.bestBattleId) {
                this.bestBattleId = null;
            }
            
            this.updateBattleTable();
            this.updateStats();
            this.setupFilters();
            this.updatePlayersTab();
            this.updateVehiclesTab();
            
            this.findBestAndWorstBattle();
        });

        this.dataManager.eventsHistory.on('dataImported', () => {
            this.updateBattleTable();
            this.updateStats();
            this.setupFilters();
            this.updatePlayersTab();
            this.updateVehiclesTab();
            
            this.findBestAndWorstBattle();
        });
    }

    async initializeUI() {
        try {
            await this.dataManager.loadFromServer();
            
            this.findBestAndWorstBattle();
            this.updateBattleTable();
            this.updateStats();
            this.setupFilters();
            this.updatePlayersTab();
            this.updateVehiclesTab();
            
            // Ініціалізуємо діаграми
            this.chartManager.initializeCharts();
        } catch (error) {
            console.error('Помилка при ініціалізації UI:', error);
            this.showNotification('Помилка при завантаженні даних', 'error');
        }
    }

    setupTabSystem() {
        // Система вкладок головного інтерфейсу
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Приховуємо всі вкладки і знімаємо активний стан з кнопок
                tabContents.forEach(content => content.classList.remove('active'));
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Активуємо відповідну вкладку і кнопку
                document.getElementById(`${tabName}-tab`).classList.add('active');
                button.classList.add('active');
                
                // Оновлюємо дані на вкладці при переході
                if (tabName === 'summary') {
                    this.chartManager.updatePerformanceCharts();
                } else if (tabName === 'players') {
                    this.updatePlayersTab();
                } else if (tabName === 'vehicles') {
                    this.updateVehiclesTab();
                }
            });
        });
        
        // Система вкладок в модальному вікні
        const modalTabButtons = document.querySelectorAll('.modal-tab-btn');
        const modalTabContents = document.querySelectorAll('.modal-tab-content');
        
        modalTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-modal-tab');
                
                modalTabContents.forEach(content => content.classList.remove('active'));
                modalTabButtons.forEach(btn => btn.classList.remove('active'));
                
                document.getElementById(`modal-${tabName}-tab`).classList.add('active');
                button.classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // Фільтри
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters')?.addEventListener('click', () => this.clearFilters());

        // Імпорт/Експорт
        document.getElementById('export-data')?.addEventListener('click', () => this.exportData());
        document.getElementById('import-data')?.addEventListener('click', () => this.importData());

        // Модальне вікно
        document.getElementById('close-modal')?.addEventListener('click', () => this.closeModal());
        
        // Закриття модального вікна при кліку поза ним
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('battle-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Закриття модального вікна по клавіші Escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
        
        // Налаштування колонок таблиці
        const toggleColumnsBtn = document.getElementById('toggle-columns');
        const columnDropdown = document.getElementById('column-dropdown');
        
        if (toggleColumnsBtn && columnDropdown) {
            toggleColumnsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                columnDropdown.classList.toggle('show');
            });
            
            // Клік поза випадаючим списком закриває його
            document.addEventListener('click', (e) => {
                if (!columnDropdown.contains(e.target) && e.target !== toggleColumnsBtn) {
                    columnDropdown.classList.remove('show');
                }
            });
            
            // Зміна видимості колонок
            const columnCheckboxes = columnDropdown.querySelectorAll('input[type="checkbox"]');
            columnCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const columnName = checkbox.id.replace('col-', '');
                    this.visibleColumns[columnName] = checkbox.checked;
                    this.updateColumnVisibility();
                });
            });
        }
    }

    updateColumnVisibility() {
        // Оновлюємо видимість колонок в таблиці
        Object.entries(this.visibleColumns).forEach(([column, isVisible]) => {
            const columnElements = document.querySelectorAll(`.col-${column}`);
            columnElements.forEach(el => {
                el.style.display = isVisible ? '' : 'none';
            });
        });
    }

    // Метод для пошуку найкращого і найгіршого бою
    findBestAndWorstBattle(battles = null) {
        const allBattles = battles || this.dataManager.getBattlesArray();
        
        if (!allBattles || allBattles.length === 0) {
            this.worstBattleId = null;
            this.bestBattleId = null;
            return;
        }

        // Фільтруємо тільки завершені бої (не "в бою")
        const completedBattles = allBattles.filter(battle => battle.win !== -1);
        
        if (completedBattles.length === 0) {
            this.worstBattleId = null;
            this.bestBattleId = null;
            return;
        }

        try {
            // Знаходимо найгірший бій (з найменшою кількістю загальних очок)
            let worstBattle = completedBattles[0];
            let bestBattle = completedBattles[0];
            let worstBattlePoints = this.dataManager.calculateBattleData(worstBattle).battlePoints;
            let bestBattlePoints = worstBattlePoints;

            completedBattles.forEach(battle => {
                try {
                    const battleData = this.dataManager.calculateBattleData(battle);
                    const battlePoints = battleData.battlePoints;
                    
                    // Перевіряємо, чи очки менші за поточного найгіршого бою
                    if (battlePoints < worstBattlePoints) {
                        worstBattle = battle;
                        worstBattlePoints = battlePoints;
                    }
                    
                    // Перевіряємо, чи очки більші за поточного найкращого бою
                    if (battlePoints > bestBattlePoints) {
                        bestBattle = battle;
                        bestBattlePoints = battlePoints;
                    }
                } catch (error) {
                    console.error('Помилка при обчисленні даних бою:', error, battle);
                }
            });

            // Зберігаємо ID найгіршого та найкращого бою
            this.worstBattleId = worstBattle.id;
            this.bestBattleId = bestBattle.id;
            
            console.log('Знайдено найгірший бій:', this.worstBattleId, 'з очками:', worstBattlePoints);
            console.log('Знайдено найкращий бій:', this.bestBattleId, 'з очками:', bestBattlePoints);
        } catch (error) {
            console.error('Помилка при пошуку найгіршого/найкращого бою:', error);
            this.worstBattleId = null;
            this.bestBattleId = null;
        }
    }

    setupFilters() {
        const battles = this.dataManager.getBattlesArray();

        const maps = new Set();
        const vehicles = new Set();
        const players = new Set();

        battles.forEach(battle => {
            if (battle.mapName) maps.add(battle.mapName);

            if (battle.players) {
                Object.values(battle.players).forEach(player => {
                    if (player.vehicle) vehicles.add(player.vehicle);
                    if (player.name) players.add(player.name);
                });
            }
        });

        this.populateFilter('map-filter', maps);
        this.populateFilter('vehicle-filter', vehicles);
        this.populateFilter('player-filter', players);
    }

    populateFilter(filterId, values) {
        const filter = document.getElementById(filterId);
        if (!filter) return;

        const currentValue = filter.value;

        while (filter.options.length > 1) {
            filter.remove(1);
        }

        Array.from(values).sort().forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            filter.appendChild(option);
        });

        if (currentValue) filter.value = currentValue;
    }

    async applyFilters() {
        const filters = {
            map: document.getElementById('map-filter')?.value || '',
            vehicle: document.getElementById('vehicle-filter')?.value || '',
            result: document.getElementById('result-filter')?.value || '',
            date: document.getElementById('date-filter')?.value || '',
            player: document.getElementById('player-filter')?.value || ''
        };

        console.log('Застосовані фільтри:', filters);
        
        const filteredBattles = await this.dataManager.applyFilters(filters);
        console.log('Відфільтровані бої:', filteredBattles);
        
        // Скидаємо пагінацію на першу сторінку
        this.currentPage = 1;
        
        // Оновлюємо найкращий і найгірший бій для відфільтрованих результатів
        this.findBestAndWorstBattle(filteredBattles);
    }

    clearFilters() {
        const filterIds = ['map-filter', 'vehicle-filter', 'result-filter', 'date-filter', 'player-filter'];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        this.applyFilters();
    }

    updateBattleTable(filteredBattles = null) {
        const tableBody = document.getElementById('battle-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        
        // Використовуємо відфільтровані бої, якщо вони передані, інакше показуємо всі бої
        const allBattles = filteredBattles || this.dataManager.getBattlesArray();
        
        if (!allBattles || allBattles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" class="no-data">Немає даних для відображення</td></tr>';
            this.updatePagination(0);
            return;
        }

        // Сортуємо бої за датою (від найновіших до найстаріших)
        const sortedBattles = [...allBattles].sort((a, b) => 
            new Date(b.startTime || 0) - new Date(a.startTime || 0)
        );
        
        // Реалізуємо пагінацію
        const totalPages = Math.ceil(sortedBattles.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        
        const battlesToShow = sortedBattles.slice(startIndex, endIndex);
        
        battlesToShow.forEach(battle => {
            try {
                const row = this.createBattleRow(battle);
                if (row) {
                    tableBody.appendChild(row);
                }
            } catch (error) {
                console.error('Помилка при створенні рядка бою:', error, battle);
            }
        });
        
        this.updatePagination(totalPages);
        this.updateColumnVisibility();
    }

    updatePagination(totalPages) {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // Кнопка "Попередня сторінка"
        if (this.currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.innerHTML = '&laquo;';
            prevButton.addEventListener('click', () => {
                this.currentPage--;
                this.updateBattleTable();
            });
            paginationContainer.appendChild(prevButton);
        }
        
        // Кнопки сторінок
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === this.currentPage) {
                pageButton.classList.add('active');
            }
            
            pageButton.addEventListener('click', () => {
                this.currentPage = i;
                this.updateBattleTable();
            });
            
            paginationContainer.appendChild(pageButton);
        }
        
        // Кнопка "Наступна сторінка"
        if (this.currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.innerHTML = '&raquo;';
            nextButton.addEventListener('click', () => {
                this.currentPage++;
                this.updateBattleTable();
            });
            paginationContainer.appendChild(nextButton);
        }
    }

    createBattleRow(battle) {
        if (!battle || !battle.id) return null;
        
        const row = document.createElement('tr');
        
        // Перевіряємо, чи це найгірший або найкращий бій
        if (this.worstBattleId && battle.id === this.worstBattleId) {
            row.classList.add('worst-battle');
        } else if (this.bestBattleId && battle.id === this.bestBattleId) {
            row.classList.add('best-battle');
        }

        const date = battle.startTime ? new Date(battle.startTime) : new Date();

        let resultText = 'В бою';
        let resultClass = 'inBattle';
        
        const battleResult = Number(battle.win);

        if (battleResult === -1) {
            resultClass = 'inBattle';
            resultText = 'В бою';
        } else if (battleResult === 0) {
            resultClass = 'defeat';
            resultText = 'Поразка';
        } else if (battleResult === 1) {
            resultClass = 'victory';
            resultText = 'Перемога';
        } else if (battleResult === 2) {
            resultClass = 'draw';
            resultText = 'Нічия';
        }
        
        try {
            // Розрахунок загальних очок за бій
            const battleData = this.dataManager.calculateBattleData(battle);
            const totalBattlePoints = battleData.battlePoints;

            row.innerHTML = `
                <td class="col-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
                <td class="col-map">${battle.mapName || 'Невідома мапа'}</td>
                <td class="col-result ${resultClass}">${resultText}</td>
                <td class="col-player">${this.getPlayerNames(battle)}</td>
                <td class="col-vehicle">${this.getVehicles(battle)}</td>
                <td class="col-damage damage">${this.getDamage(battle)}</td>
                <td class="col-frags frags">${this.getKills(battle)}</td>
                <td class="col-points points">${this.getPoints(battle)}</td>
                <td class="col-total total-points">${totalBattlePoints.toLocaleString()}</td>
                <td>
                    <button class="view-battle" data-battle-id="${battle.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="delete-battle" data-battle-id="${battle.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            // Додаємо обробники подій
            row.querySelector('.view-battle')?.addEventListener('click', () => this.showBattleDetails(battle));
            row.querySelector('.delete-battle')?.addEventListener('click', () => this.deleteBattle(battle.id));

            return row;
        } catch (error) {
            console.error('Помилка при обчисленні даних для рядка:', error, battle);
            return null;
        }
    }

    showBattleDetails(battle) {
        if (!battle) return;
        
        const modal = document.getElementById('battle-modal');
        if (!modal) return;
        
        // Деталі бою - заголовок
        const detailMap = document.getElementById('detail-map');
        const detailTime = document.getElementById('detail-time');
        const resultElement = document.getElementById('detail-result');
        const detailDuration = document.getElementById('detail-duration');

        if (detailMap) detailMap.textContent = battle.mapName || 'Невідома мапа';
        if (detailTime) detailTime.textContent = battle.startTime ? 
            new Date(battle.startTime).toLocaleString() : '-';

        if (resultElement) {
            let resultText = '';
            let resultClass = '';
            
            if (battle.win === 1) {
                resultText = 'Перемога';
                resultClass = 'victory';
            } else if (battle.win === 0) {
                resultText = 'Поразка';
                resultClass = 'defeat';
            } else if (battle.win === 2) {
                resultText = 'Нічия';
                resultClass = 'draw';
            } else {
                resultText = 'В бою';
                resultClass = 'inBattle';
            }
            
            resultElement.textContent = resultText;
            resultElement.className = resultClass;
        }

        if (detailDuration) {
            detailDuration.textContent = `Тривалість: ${this.formatDuration(battle.duration)}`;
        }

        // Оновлення блоку зі статистикою
        this.updateBattleStatistics(battle);
        
        // Оновлення таблиці гравців у вкладці "Гравці"
        this.updateModalPlayersTable(battle);
        
        // Оновлення аналізу бою у вкладці "Аналіз"
        this.updateBattleAnalysis(battle);
        
        // Показуємо спеціальну мітку для найгіршого бою
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            // Видаляємо попередні бейджі, якщо вони є
            const oldBadges = modal.querySelectorAll('.battle-badge');
            oldBadges.forEach(badge => badge.remove());
            
            modalContent.classList.remove('worst-battle-modal', 'best-battle-modal');
            
            // Перевіряємо, чи це найгірший бій
            if (this.worstBattleId && battle.id === this.worstBattleId) {
                modalContent.classList.add('worst-battle-modal');
                
                // Додаємо мітку "Найгірший бій"
                const badge = document.createElement('div');
                badge.className = 'worst-battle-badge battle-badge';
                badge.textContent = 'Найгірший бій';
                modalContent.querySelector('.modal-header').appendChild(badge);
            }
            
            // Перевіряємо, чи це найкращий бій
            if (this.bestBattleId && battle.id === this.bestBattleId) {
                modalContent.classList.add('best-battle-modal');
                
                // Додаємо мітку "Найкращий бій"
                const badge = document.createElement('div');
                badge.className = 'best-battle-badge battle-badge';
                badge.textContent = 'Найкращий бій';
                modalContent.querySelector('.modal-header').appendChild(badge);
            }
        }
        
        // Відображення модального вікна
        modal.style.display = 'block';
        
        // Додаємо клас для анімації появи
        setTimeout(() => {
            modal.querySelector('.modal-content')?.classList.add('show');
        }, 10);
        
        // Скидаємо активну вкладку на першу (Загальне)
        document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector('.modal-tab-btn[data-modal-tab="summary"]').classList.add('active');
        document.getElementById('modal-summary-tab').classList.add('active');
    }

    updateBattleStatistics(battle) {
        if (!battle) return;
        
        try {
            const battleData = this.dataManager.calculateBattleData(battle);
            
            // Оновлюємо показники в модальному вікні
            document.getElementById('modal-damage').textContent = battleData.battleDamage.toLocaleString();
            document.getElementById('modal-frags').textContent = battleData.battleKills.toLocaleString();
            document.getElementById('modal-points').textContent = battleData.battlePoints.toLocaleString();
        } catch (error) {
            console.error('Помилка при оновленні статистики бою:', error, battle);
        }
    }

    updateModalPlayersTable(battle) {
        const tableBody = document.getElementById('modal-players-table-body');
        if (!tableBody || !battle || !battle.players) return;
        
        tableBody.innerHTML = '';
        
        Object.entries(battle.players).forEach(([playerId, playerData]) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${playerData.name || 'Невідомий гравець'}</td>
                <td>${playerData.vehicle || 'Невідомий танк'}</td>
                <td class="damage">${playerData.damage?.toLocaleString() || 0}</td>
                <td class="frags">${playerData.kills || 0}</td>
                <td class="total-points">${playerData.points?.toLocaleString() || 0}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    updateBattleAnalysis(battle) {
        if (!battle) return;
        
        const keyMetricsList = document.getElementById('battle-key-metrics');
        if (!keyMetricsList) return;
        
        keyMetricsList.innerHTML = '';
        
        try {
            const battleData = this.dataManager.calculateBattleData(battle);
            
            // Додаємо ключові метрики
            const metrics = [
                { name: 'Загальна шкода', value: battleData.battleDamage.toLocaleString(), class: 'damage' },
                { name: 'Загальні фраги', value: battleData.battleKills.toLocaleString(), class: 'frags' },
                { name: 'Загальні очки', value: battleData.battlePoints.toLocaleString(), class: 'total-points' },
                { name: 'Середня шкода на гравця', value: Math.round(battleData.battleDamage / Object.keys(battle.players).length).toLocaleString(), class: 'damage' },
                { name: 'Середні фраги на гравця', value: (battleData.battleKills / Object.keys(battle.players).length).toFixed(1), class: 'frags' }
            ];
            
            metrics.forEach(metric => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${metric.name}</span>
                    <span class="${metric.class}">${metric.value}</span>
                `;
                keyMetricsList.appendChild(li);
            });
            
            // Створюємо або оновлюємо діаграму внеску гравців
            this.chartManager.updateBattleContributionChart(battle);
        } catch (error) {
            console.error('Помилка при оновленні аналізу бою:', error, battle);
        }
    }

    closeModal() {
        const modal = document.getElementById('battle-modal');
        if (modal) {
            // Додаємо анімацію закриття
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.classList.remove('show');
            }
            
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    async deleteBattle(battleId) {
        if (confirm('Ви впевнені, що хочете видалити цей бій?')) {
            try {
                await this.dataManager.deleteBattle(battleId);
                this.showNotification('Бій успішно видалено', 'success');
            } catch (error) {
                console.error('Помилка при видаленні бою:', error);
                this.showNotification('Помилка при видаленні бою', 'error');
            }
        }
    }

    updateStats() {
        try {
            const stats = this.dataManager.calculateTeamData();

            const elements = {
                'total-battles': stats.battles,
                'total-victories': stats.wins,
                'win-rate': `${((stats.wins / stats.battles) * 100 || 0).toFixed(1)}%`,
                'total-damage': stats.teamDamage.toLocaleString(),
                'avg-damage': Math.round(stats.teamDamage / stats.battles || 0).toLocaleString(),
                'total-frags': stats.teamKills,
                'avg-frags': (stats.teamKills / stats.battles || 0).toFixed(1),
                'total-points': stats.teamPoints.toLocaleString()
            };

            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });
            
            // Оновлюємо діаграми статистики
            this.chartManager.updatePerformanceCharts();
        } catch (error) {
            console.error('Помилка при оновленні статистики:', error);
        }
    }

    updatePlayersTab() {
        try {
            // Заповнюємо таблицю статистики гравців
            this.updatePlayersTable();
            
            // Оновлюємо діаграми для гравців
            this.chartManager.updatePlayerCharts();
        } catch (error) {
            console.error('Помилка при оновленні вкладки гравців:', error);
        }
    }

    updatePlayersTable() {
        const tableBody = document.getElementById('players-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const battles = this.dataManager.getBattlesArray();
        const playerStats = new Map();
        
        // Збираємо статистику по гравцях
        battles.forEach(battle => {
            if (!battle.players) return;
            
            Object.values(battle.players).forEach(player => {
                if (!player.name) return;
                
                if (!playerStats.has(player.name)) {
                    playerStats.set(player.name, {
                        battles: 0,
                        wins: 0,
                        damage: 0,
                        kills: 0,
                        points: 0
                    });
                }
                
                const stats = playerStats.get(player.name);
                stats.battles++;
                if (battle.win === 1) stats.wins++;
                stats.damage += player.damage || 0;
                stats.kills += player.kills || 0;
                stats.points += player.points || 0;
            });
        });
        
        // Сортуємо гравців за середньою шкодою (від більшого до меншого)
        const sortedPlayers = Array.from(playerStats.entries())
            .map(([playerName, stats]) => ({
                name: playerName,
                ...stats,
                avgDamage: stats.damage / stats.battles || 0
            }))
            .sort((a, b) => b.avgDamage - a.avgDamage);
        
        sortedPlayers.forEach((player, index) => {
            try {
                const row = document.createElement('tr');
                const winRate = ((player.wins / player.battles) * 100 || 0).toFixed(1);
                const avgDamage = Math.round(player.damage / player.battles || 0);
                const avgKills = (player.kills / player.battles || 0).toFixed(1);
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${player.name}</td>
                    <td>${player.battles}</td>
                    <td class="wins">${player.wins}</td>
                    <td>${winRate}%</td>
                    <td class="damage">${player.damage.toLocaleString()}</td>
                    <td class="damage">${avgDamage.toLocaleString()}</td>
                    <td class="frags">${player.kills}</td>
                    <td class="frags">${avgKills}</td>
                `;
                
                tableBody.appendChild(row);
            } catch (error) {
                console.error('Помилка при створенні рядка статистики гравця:', error, player.name);
            }
        });
    }

    updateVehiclesTab() {
        try {
            // Заповнюємо таблицю статистики техніки
            this.updateVehiclesTable();
            
            // Оновлюємо діаграми для техніки
            this.chartManager.updateVehicleCharts();
        } catch (error) {
            console.error('Помилка при оновленні вкладки техніки:', error);
        }
    }

    updateVehiclesTable() {
        const tableBody = document.getElementById('vehicles-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Збираємо статистику по всіх танках
        const vehicleStats = {};
        
        const battles = this.dataManager.getBattlesArray();
        
        battles.forEach(battle => {
            if (!battle.players) return;
            
            Object.values(battle.players).forEach(player => {
                const vehicle = player.vehicle;
                if (!vehicle) return;
                
                if (!vehicleStats[vehicle]) {
                    vehicleStats[vehicle] = {
                        battles: 0,
                        wins: 0,
                        damage: 0,
                        kills: 0
                    };
                }
                
                vehicleStats[vehicle].battles++;
                
                if (battle.win === 1) {
                    vehicleStats[vehicle].wins++;
                }
                
                vehicleStats[vehicle].damage += player.damage || 0;
                vehicleStats[vehicle].kills += player.kills || 0;
            });
        });
        
        // Сортуємо танки за середньою шкодою
        const sortedVehicles = Object.entries(vehicleStats)
            .map(([vehicleName, stats]) => ({
                vehicle: vehicleName,
                ...stats,
                avgDamage: stats.damage / stats.battles || 0
            }))
            .sort((a, b) => b.avgDamage - a.avgDamage);
        
        sortedVehicles.forEach((vehicle, index) => {
            try {
                const winRate = ((vehicle.wins / vehicle.battles) * 100 || 0).toFixed(1);
                const avgDamage = Math.round(vehicle.damage / vehicle.battles || 0);
                const avgKills = (vehicle.kills / vehicle.battles || 0).toFixed(1);
                
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${vehicle.vehicle}</td>
                    <td>${vehicle.battles}</td>
                    <td class="wins">${vehicle.wins}</td>
                    <td>${winRate}%</td>
                    <td class="damage">${vehicle.damage.toLocaleString()}</td>
                    <td class="damage">${avgDamage.toLocaleString()}</td>
                    <td class="frags">${vehicle.kills}</td>
                    <td class="frags">${avgKills}</td>
                `;
                
                tableBody.appendChild(row);
            } catch (error) {
                console.error('Помилка при створенні рядка статистики техніки:', error, vehicle);
            }
        });
    }

    async exportData() {
        try {
            const data = await this.dataManager.exportData();
            if (!data) {
                this.showNotification('Помилка при експорті даних', 'error');
                return;
            }

            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'battle_history.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Дані успішно експортовано', 'success');
        } catch (error) {
            console.error('Помилка при експорті даних:', error);
            this.showNotification('Помилка при експорті даних', 'error');
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target?.result);
                    const success = await this.dataManager.importData(data);
                    
                    if (success) {
                        this.showNotification('Дані успішно імпортовано', 'success');
                    } else {
                        this.showNotification('Помилка при імпорті даних', 'error');
                    }
                } catch (error) {
                    console.error('Error importing data:', error);
                    this.showNotification('Помилка при читанні файлу', 'error');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    getPlayerNames(battle) {
        if (!battle.players) return 'Невідомий гравець';
        return Object.values(battle.players)
            .map(p => p.name || 'Невідомий гравець')
            .join('<br>');
    }

    getDamage(battle) {
        if (!battle.players) return '0';
        return Object.values(battle.players)
            .map(p => (p.damage || 0).toLocaleString())
            .join('<br>');
    }

    getKills(battle) {
        if (!battle.players) return '0';
        return Object.values(battle.players)
            .map(p => p.kills || 0)
            .join('<br>');
    }

    getPoints(battle) {
        if (!battle.players) return '0';
        return Object.values(battle.players)
            .map(p => (p.points || 0).toLocaleString())
            .join('<br>');
    }

    getVehicles(battle) {
        if (!battle.players) return 'Невідомий танк';
        return Object.values(battle.players)
            .map(p => p.vehicle || 'Невідомий танк')
            .join('<br>');
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Стилі для сповіщення
        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'fadeIn 0.3s, fadeOut 0.3s 2.7s',
            backgroundColor: type === 'success' ? '#4CAF50' : '#f44336'
        });

        // Додаємо стилі анімацій
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(20px); }
            }
        `;
        document.head.appendChild(styleSheet);

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
            styleSheet.remove();
        }, 3000);
    }
}

export default BattleUIHandler;