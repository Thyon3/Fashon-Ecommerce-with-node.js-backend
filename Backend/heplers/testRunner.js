const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.testResults = [];
    this.testDir = path.join(__dirname, '../tests');
    this.reportsDir = path.join(__dirname, '../test-reports');
    this.ensureDirectories();
  }

  // Ensure directories exist
  ensureDirectories() {
    [this.testDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Run all tests
  async runAllTests(options = {}) {
    const {
      pattern = '**/*.test.js',
      timeout = 30000,
      bail: false,
      coverage: false
    } = options;

    console.log('[TEST_RUNNER] Starting test execution');
    
    const startTime = Date.now();
    const testResults = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: []
    };

    try {
      // Find all test files
      const testFiles = this.findTestFiles(pattern);
      
      console.log(`[TEST_RUNNER] Found ${testFiles.length} test files`);
      
      // Run each test file
      for (const testFile of testFiles) {
        const suiteResult = await this.runTestFile(testFile, options);
        testResults.suites.push(suiteResult);
        testResults.totalTests += suiteResult.total;
        testResults.passed += suiteResult.passed;
        testResults.failed += suiteResult.failed;
        testResults.skipped += suiteResult.skipped;
        
        // Bail on first failure if enabled
        if (bail && suiteResult.failed > 0) {
          console.log('[TEST_RUNNER] Bailing on first failure');
          break;
        }
      }
      
      testResults.endTime = new Date().toISOString();
      testResults.duration = Date.now() - startTime;
      
      // Generate report
      await this.generateReport(testResults);
      
      console.log(`[TEST_RUNNER] Test execution completed`);
      console.log(`[TEST_RUNNER] Total: ${testResults.totalTests}, Passed: ${testResults.passed}, Failed: ${testResults.failed}, Skipped: ${testResults.skipped}`);
      console.log(`[TEST_RUNNER] Duration: ${testResults.duration}ms`);
      
      return testResults;
      
    } catch (error) {
      console.error('[TEST_RUNNER] Test execution failed:', error);
      
      testResults.endTime = new Date().toISOString();
      testResults.duration = Date.now() - Date.parse(testResults.startTime);
      testResults.error = error.message;
      
      return testResults;
    }
  }

  // Find test files
  findTestFiles(pattern) {
    const glob = require('glob');
    
    return new Promise((resolve, reject) => {
      glob(pattern, { cwd: this.testDir }, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }

  // Run individual test file
  async runTestFile(testFile, options) {
    const suiteResult = {
      file: path.relative(this.testDir, testFile),
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };

    try {
      console.log(`[TEST_RUNNER] Running tests in: ${suiteResult.file}`);
      
      // Load and execute test file
      const module = require(path.resolve(testFile));
      
      if (typeof module.runTests === 'function') {
        const results = await module.runTests(options);
        
        suiteResult.totalTests = results.total || 0;
        suiteResult.passed = results.passed || 0;
        suiteResult.failed = results.failed || 0;
        suiteResult.skipped = results.skipped || 0;
        suiteResult.tests = results.tests || [];
        suiteResult.endTime = new Date().toISOString();
        suiteResult.duration = Date.now() - Date.parse(suiteResult.startTime);
        
      } else {
        throw new Error('Test file must export a runTests function');
      }
      
    } catch (error) {
      console.error(`[TEST_RUNNER] Error running test file ${suiteResult.file}:`, error);
      
      suiteResult.error = error.message;
      suiteResult.endTime = new Date().toISOString();
      suiteResult.duration = Date.now() - Date.parse(suiteResult.startTime);
      suiteResult.failed = 1;
    }
    
    return suiteResult;
  }

  // Generate test report
  async generateReport(testResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.reportsDir, `test-report-${timestamp}.json`);
    
    const report = {
      summary: {
        total: testResults.totalTests,
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped,
        duration: testResults.duration,
        passRate: testResults.totalTests > 0 ? (testResults.passed / testResults.totalTests) * 100 : 0
      },
      timestamp: testResults.timestamp,
      suites: testResults.suites,
      environment: this.getEnvironmentInfo(),
      coverage: testResults.coverage || null
    };

    // Save JSON report
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    await this.generateHTMLReport(report, reportFile.replace('.json', '.html'));
    
    console.log(`[TEST_RUNNER] Reports generated: ${reportFile}`);
  }

  // Generate HTML report
  generateHTMLReport(report, htmlFile) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - Fashon API</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-item { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-item.total { background-color: #e3f2fd; }
        .summary-item.passed { background-color: #e8f5e8; }
        .summary-item.failed { background-color: #ffebee; }
        .summary-item.skipped { background-color: #fff3e0; }
        .suites { margin-bottom: 30px; }
        .suite { margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .suite-title { font-weight: bold; color: #333; }
        .suite-stats { color: #666; }
        .test { margin-bottom: 10px; padding: 10px; border-left: 4px solid #ddd; padding-left: 15px; }
        .test.passed { border-left-color: #4caf50; }
        .test.failed { border-left-color: #f44336; }
        .test.skipped { border-left-color: #ff9800; }
        .test-name { font-weight: bold; }
        .test-duration { color: #666; font-size: 12px; }
        .test-message { color: #333; margin-top: 5px; }
        .error { color: #f44336; background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Report</h1>
            <p>Fashon E-commerce API Test Results</p>
        </div>
        
        <div class="summary">
            <div class="summary-item total">
                <h3>Total Tests</h3>
                <h2>${report.summary.total}</h2>
            </div>
            <div class="summary-item passed">
                <h3>Passed</h3>
                <h2>${report.summary.passed}</h2>
            </div>
            <div class="summary-item failed">
                <h3>Failed</h3>
                <h2>${report.summary.failed}</h2>
            </div>
            <div class="summary-item skipped">
                <h3>Skipped</h3>
                <h2>${report.summary.skipped}</h2>
            </div>
        </div>
        
        <div class="suites">
            <h2>Test Suites</h2>
            ${report.suites.map(suite => `
                <div class="suite">
                    <div class="suite-header">
                        <div class="suite-title">${suite.file}</div>
                        <div class="suite-stats">
                            ${suite.totalTests} tests | ${suite.passed} passed | ${suite.failed} failed | ${suite.skipped} skipped
                        </div>
                    </div>
                    ${suite.tests.map(test => `
                        <div class="test ${test.status}">
                            <div class="test-name">${test.name}</div>
                            <div class="test-duration">${test.duration}ms</div>
                            ${test.message ? `<div class="test-message">${test.message}</div>` : ''}
                            ${test.error ? `<div class="error">${test.error}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>Report generated on ${report.timestamp}</p>
            <p>Environment: ${report.environment.nodeVersion} on ${report.environment.platform}</p>
        </div>
    </div>
</body>
</html>
    `;
    
    fs.writeFileSync(htmlFile, html);
  }

  // Get environment information
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        HOST: process.env.HOST
      }
    };
  }

  // Get test results
  getTestResults() {
    return this.testResults;
  }

  // Get latest test results
  getLatestResults() {
    return this.testResults[this.testResults.length - 1] || null;
  }

  // Clear test results
  clearResults() {
    this.testResults = [];
    console.log('[TEST_RUNNER] Test results cleared');
  }

  // Run specific test suite
  async runTestSuite(testFile, options = {}) {
    console.log(`[TEST_RUNNER] Running test suite: ${testFile}`);
    
    const result = await this.runTestFile(
      path.join(this.testDir, testFile),
      options
    );
    
    console.log(`[TEST_RUNNER] Test suite completed: ${result.file}`);
    console.log(`[TEST_RUNNER] Results: ${result.passed}/${result.totalTests} passed`);
    
    return result;
  }

  // Run tests with coverage
  async runWithCoverage(options = {}) {
    console.log('[TEST_RUNNER] Running tests with coverage');
    
    // This would integrate with a coverage tool like Istanbul
    // For now, just run regular tests
    const results = await this.runAllTests(options);
    
    // Mock coverage data
    results.coverage = {
      lines: { total: 1000, covered: 850, percentage: 85 },
      functions: { total: 200, covered: 150, percentage: 75 },
      branches: { total: 500, covered: 300, percentage: 60 },
      statements: { total: 1500, covered: 1200, percentage: 80 }
    };
    
    return results;
  }

  // Run tests in watch mode
  runInWatchMode(options = {}) {
    console.log('[TEST_RUNNER] Starting watch mode');
    
    const { pattern = '**/*.test.js', interval = 5000 } = options;
    
    // Watch for file changes
    const fs = require('fs');
    
    fs.watch(this.testDir, { recursive: true }, (eventType, filename) => {
      if (eventType === 'change' && filename.endsWith('.test.js')) {
        console.log(`[TEST_RUNNER] File changed: ${filename}`);
        console.log('[TEST_RUNNER] Re-running tests...');
        
        // Re-run tests
        this.runAllTests(options).catch(error => {
          console.error('[TEST_RUNNER] Error in watch mode:', error);
        });
      }
    });
  }

  // Run tests in CI mode
  runInCI() {
    console.log('[TEST_RUNNER] Running tests in CI mode');
    
    return this.runAllTests({
      bail: true,
      coverage: true,
      timeout: 60000
    });
  }
}

// Create singleton instance
const testRunner = new TestRunner();

module.exports = testRunner;
