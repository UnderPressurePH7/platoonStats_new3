let isRunning = false;
let executionCount = 0;

self.onmessage = (event) => {
  const { type, delay } = event.data;
  
  switch (type) {
    case 'start':
      isRunning = true;
      executionCount = 0;
      startLoop(delay);
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
};

function startLoop(delay) {
  while (isRunning) {
    executionCount++;
    
    self.postMessage({ 
      type: 'execute',
      executionCount 
    });
    
    sleep(delay);
  }
}

function sleep(delay) {
  const start = Date.now();
  while (Date.now() - start < delay) {
    // Busy waiting
  }
}