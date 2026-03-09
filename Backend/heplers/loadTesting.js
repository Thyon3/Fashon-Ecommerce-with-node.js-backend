class LoadTesting {
  constructor() {
    this.testResults = [];
    this.isRunning = false;
    this.currentTest = null;
  }

  // Run load test
  async runLoadTest(config) {
    if (this.isRunning) {
      throw new Error('Load test already in progress');
    }

    this.isRunning = true;
    this.currentTest = {
      id: this.generateTestId(),
      config,
      startTime: new Date(),
      endTime: null,
      results: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestsPerSecond: 0,
        errors: []
      }
    };

    try {
      console.log(`[LOAD_TEST] Starting load test: ${this.currentTest.id}`);
      
      await this.executeLoadTest(config);
      
      this.currentTest.endTime = new Date();
      this.currentTest.results.duration = this.currentTest.endTime - this.currentTest.startTime;
      
      console.log(`[LOAD_TEST] Load test completed: ${this.currentTest.results.totalRequests} requests in ${this.currentTest.results.duration}ms`);
      
      this.testResults.push(this.currentTest);
      
      return this.currentTest;
      
    } catch (error) {
      console.error('[LOAD_TEST] Load test failed:', error);
      throw error;
      
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }
  }

  // Execute load test
  async executeLoadTest(config) {
    const {
      baseUrl = 'http://localhost:3000',
      endpoints = [
        { method: 'GET', path: '/api/products', weight: 1 },
        { method: 'GET', path: '/api/categories', weight: 1 }
      ],
      duration = 60000, // 1 minute
      concurrency = 10,
      rampUpTime = 10000 // 10 seconds
    } = config;

    const startTime = Date.now();
    const endTime = startTime + duration;
    const requests = [];
    
    // Start concurrent workers
    const workers = [];
    
    for (let i = 0; i < concurrency; i++) {
      const delay = (rampUpTime / concurrency) * i;
      
      workers.push(
        this.runWorker(baseUrl, endpoints, startTime + delay, endTime, this.currentTest.results)
      );
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    // Calculate final metrics
    this.calculateMetrics(this.currentTest.results);
  }

  // Run individual worker
  async runWorker(baseUrl, endpoints, startTime, endTime, results) {
    const axios = require('axios');
    
    // Wait for start time
    if (Date.now() < startTime) {
      await new Promise(resolve => setTimeout(resolve, startTime - Date.now()));
    }
    
    while (Date.now() < endTime) {
      try {
        // Select endpoint based on weight
        const endpoint = this.selectEndpoint(endpoints);
        
        const requestStart = Date.now();
        
        // Make request
        const response = await axios({
          method: endpoint.method,
          url: baseUrl + endpoint.path,
          timeout: 30000,
          validateStatus: () => true // Don't throw on HTTP errors
        });
        
        const requestEnd = Date.now();
        const responseTime = requestEnd - requestStart;
        
        // Update results
        results.totalRequests++;
        
        if (response.status >= 200 && response.status < 400) {
          results.successfulRequests++;
        } else {
          results.failedRequests++;
          results.errors.push({
            status: response.status,
            message: response.statusText,
            endpoint: endpoint.path,
            timestamp: new Date().toISOString()
          });
        }
        
        // Update response time metrics
        results.minResponseTime = Math.min(results.minResponseTime, responseTime);
        results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
      } catch (error) {
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push({
          error: error.message,
          endpoint: endpoint.path,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Select endpoint based on weight
  selectEndpoint(endpoints) {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }
    
    return endpoints[0];
  }

  // Calculate final metrics
  calculateMetrics(results) {
    if (results.totalRequests === 0) {
      return;
    }
    
    // Calculate success rate
    results.successRate = (results.successfulRequests / results.totalRequests) * 100;
    
    // Calculate requests per second
    const duration = results.endTime - results.startTime;
    results.requestsPerSecond = (results.totalRequests / duration) * 1000;
    
    // Calculate average response time (would need to track individual times)
    results.averageResponseTime = (results.minResponseTime + results.maxResponseTime) / 2;
    
    // Reset min if no requests
    if (results.minResponseTime === Infinity) {
      results.minResponseTime = 0;
    }
  }

  // Get test results
  getTestResults() {
    return this.testResults;
  }

  // Get latest test result
  getLatestResult() {
    return this.testResults[this.testResults.length - 1] || null;
  }

  // Get test status
  getTestStatus() {
    return {
      isRunning: this.isRunning,
      currentTest: this.currentTest,
      totalTests: this.testResults.length
    };
  }

  // Generate test report
  generateReport(testId) {
    const test = this.testResults.find(t => t.id === testId);
    
    if (!test) {
      throw new Error('Test not found');
    }
    
    return {
      testId: test.id,
      config: test.config,
      startTime: test.startTime,
      endTime: test.endTime,
      duration: test.results.duration,
      results: test.results,
      summary: {
        totalRequests: test.results.totalRequests,
        successRate: test.results.successRate,
        averageResponseTime: test.results.averageResponseTime,
        requestsPerSecond: test.results.requestsPerSecond,
        errorCount: test.results.errors.length
      }
    };
  }

  // Generate test ID
  generateTestId() {
    return 'test_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Clear test results
  clearResults() {
    this.testResults = [];
    console.log('[LOAD_TEST] Test results cleared');
  }

  // Get performance benchmarks
  getBenchmarks() {
    if (this.testResults.length === 0) {
      return null;
    }
    
    const allResults = this.testResults.map(test => test.results);
    
    return {
      averageRequestsPerSecond: allResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / allResults.length,
      averageSuccessRate: allResults.reduce((sum, r) => sum + r.successRate, 0) / allResults.length,
      averageResponseTime: allResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / allResults.length,
      maxRequestsPerSecond: Math.max(...allResults.map(r => r.requestsPerSecond)),
      minSuccessRate: Math.min(...allResults.map(r => r.successRate)),
      maxResponseTime: Math.max(...allResults.map(r => r.maxResponseTime))
    };
  }

  // Export test results
  exportResults() {
    return JSON.stringify(this.testResults, null, 2);
  }

  // Import test results
  importResults(data) {
    try {
      this.testResults = JSON.parse(data);
      console.log('[LOAD_TEST] Test results imported');
    } catch (error) {
      console.error('[LOAD_TEST] Error importing results:', error);
      throw error;
    }
  }
}

// Create singleton instance
const loadTesting = new LoadTesting();

module.exports = loadTesting;
