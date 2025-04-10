class BackgroundWorker {
  constructor(config) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment');
    }

    if (!config.method) {
      throw new Error('Method is required');
    }
    if (!config.delay || config.delay < 0) {
      throw new Error('Invalid delay value');
    }

    this.config = {
      delay: config.delay,
      method: config.method,
      methodArgs: config.methodArgs || [],
      onError: config.onError || (() => {}),
      onSuccess: config.onSuccess || (() => {}),
      onStop: config.onStop || (() => {})
    };

    this.isRunning = false;
    this.executionCount = 0;
    this.lastExecutionTime = null;
    this.lastError = null;

    this.initWorker();
  }

  initWorker() {
    try {
      const workerCode = `
        let isRunning = false;
        let executionCount = 0;

        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        async function startLoop(delay) {
          while (isRunning) {
            try {
              executionCount++;
              
              self.postMessage({ 
                type: 'execute',
                executionCount 
              });
              
              await sleep(delay);
            } catch (error) {
              self.postMessage({ 
                type: 'error',
                error: error.message
              });
            }
          }
        }

        self.onmessage = async (event) => {
          try {
            const { type, delay } = event.data;
            
            switch (type) {
              case 'start':
                isRunning = true;
                executionCount = 0;
                await startLoop(delay);
                break;
              
              case 'stop':
                isRunning = false;
                self.postMessage({ type: 'stopped' });
                break;
                
              case 'getStats':
                self.postMessage({
                  type: 'stats',
                  executionCount
                });
                break;
            }
          } catch (error) {
            self.postMessage({ 
              type: 'error',
              error: error.message
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      
      this.worker.onmessage = async (event) => {
        const { type, executionCount, error } = event.data;
        
        switch (type) {
          case 'execute':
            this.executionCount = executionCount;
            this.lastExecutionTime = new Date();
            try {
              await this.executeMethod();
              this.config.onSuccess();
            } catch (error) {
              this.handleError(new Error(error.message || 'Method execution failed'));
            }
            break;
            
          case 'stopped':
            this.isRunning = false;
            this.config.onStop();
            break;
            
          case 'error':
            this.handleError(new Error(error || 'Worker error'));
            break;
            
          case 'stats':
            return event.data;
        }
      };

      this.worker.onerror = (error) => {
        this.handleError(new Error(error.message || 'Worker error'));
        this.stop();
      };

    } catch (error) {
      throw new Error(`Failed to initialize worker: ${error.message}`);
    }
  }

  async executeMethod() {
    try {
      await this.config.method.apply(null, this.config.methodArgs);
    } catch (error) {
      throw error;
    }
  }

  handleError(error) {
    this.lastError = error;
    console.error('Worker error:', error.message);
    this.config.onError(error);
  }

  start() {
    if (this.isRunning) {
      console.warn('Worker is already running');
      return false;
    }
    
    try {
      this.isRunning = true;
      this.lastError = null;
      this.worker.postMessage({ 
        type: 'start', 
        delay: this.config.delay 
      });
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  stop() {
    if (!this.isRunning) {
      console.warn('Worker is not running');
      return false;
    }
    
    try {
      this.isRunning = false;
      this.worker.postMessage({ type: 'stop' });
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  restart() {
    this.stop();
    setTimeout(() => this.start(), 100);
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      executionCount: this.executionCount,
      lastExecutionTime: this.lastExecutionTime,
      lastError: this.lastError,
      delay: this.config.delay
    };
  }

  updateDelay(newDelay) {
    if (newDelay < 0) {
      throw new Error('Invalid delay value');
    }
    this.config.delay = newDelay;
    if (this.isRunning) {
      this.restart();
    }
  }

  destroy() {
    try {
      if (this.isRunning) {
        this.stop();
      }
      this.worker.terminate();
      this.worker = null;
    } catch (error) {
      console.error('Error during worker destruction:', error);
    }
  }
}