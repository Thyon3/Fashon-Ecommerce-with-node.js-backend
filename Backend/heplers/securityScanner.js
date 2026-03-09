const fs = require('fs');
const path = require('path');

class SecurityScanner {
  constructor() {
    this.scanResults = [];
    this.vulnerabilities = [];
  }

  // Run comprehensive security scan
  async runSecurityScan() {
    console.log('[SECURITY] Starting security scan');
    
    const scanResults = {
      timestamp: new Date().toISOString(),
      scans: {
        dependencies: await this.scanDependencies(),
        code: await this.scanCode(),
        configuration: await this.scanConfiguration(),
        environment: await this.scanEnvironment(),
        permissions: await this.scanPermissions()
      },
      vulnerabilities: [],
      score: 0
    };

    // Calculate overall security score
    scanResults.score = this.calculateSecurityScore(scanResults);
    
    // Collect all vulnerabilities
    Object.values(scanResults.scans).forEach(scan => {
      if (scan.vulnerabilities) {
        scanResults.vulnerabilities.push(...scan.vulnerabilities);
      }
    });

    console.log(`[SECURITY] Scan completed: ${scanResults.vulnerabilities.length} vulnerabilities found, Score: ${scanResults.score}`);
    
    this.scanResults.push(scanResults);
    
    return scanResults;
  }

  // Scan dependencies for known vulnerabilities
  async scanDependencies() {
    try {
      const packageJsonPath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const vulnerabilities = [];
      
      // Check for known vulnerable packages
      const vulnerablePackages = {
        'express': '<4.17.21',
        'mongoose': '<5.13.0',
        'jsonwebtoken': '<8.5.1',
        'bcrypt': '<5.0.1',
        'helmet': '<4.6.0',
        'cors': '<2.8.5',
        'morgan': '<1.9.1'
      };
      
      Object.keys(packageJson.dependencies || {}).forEach(pkg => {
        if (vulnerablePackages[pkg]) {
          vulnerabilities.push({
            type: 'dependency',
            package: pkg,
            severity: 'high',
            description: `Package ${pkg} has known vulnerabilities`,
            recommendation: `Update ${pkg} to version ${vulnerablePackages[pkg]} or higher`
          });
        }
      });
      
      return {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerable',
        totalPackages: Object.keys(packageJson.dependencies || {}).length,
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities.length * 20))
      };
      
    } catch (error) {
      console.error('Error scanning dependencies:', error);
      return {
        status: 'error',
        error: error.message,
        vulnerabilities: [],
        score: 0
      };
    }
  }

  // Scan code for security issues
  async scanCode() {
    try {
      const vulnerabilities = [];
      const codeFiles = this.getCodeFiles();
      
      for (const file of codeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for hardcoded secrets
        const secretPatterns = [
          /password\s*=\s*['"`][^'"`]+['"`]/gi,
          /api[_-]?key\s*=\s*['"`][^'"`]+['"`]/gi,
          /secret\s*=\s*['"`][^'"`]+['"`]/gi,
          /token\s*=\s*['"`][^'"`]+['"`]/gi
        ];
        
        secretPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            vulnerabilities.push({
              type: 'code',
              file: path.relative(__dirname, file),
              severity: 'critical',
              description: 'Hardcoded secret detected',
              recommendation: 'Use environment variables for secrets',
              matches: matches.length
            });
          }
        });
        
        // Check for eval usage
        if (content.includes('eval(')) {
          vulnerabilities.push({
            type: 'code',
            file: path.relative(__dirname, file),
            severity: 'high',
            description: 'Use of eval() detected',
            recommendation: 'Avoid using eval() for security reasons'
          });
        }
        
        // Check for SQL injection patterns
        if (content.includes('SELECT') && content.includes('+')) {
          vulnerabilities.push({
            type: 'code',
            file: path.relative(__dirname, file),
            severity: 'medium',
            description: 'Potential SQL injection vulnerability',
            recommendation: 'Use parameterized queries'
          });
        }
      }
      
      return {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerable',
        filesScanned: codeFiles.length,
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities.length * 15))
      };
      
    } catch (error) {
      console.error('Error scanning code:', error);
      return {
        status: 'error',
        error: error.message,
        vulnerabilities: [],
        score: 0
      };
    }
  }

  // Scan configuration files
  async scanConfiguration() {
    try {
      const vulnerabilities = [];
      
      // Check .env file
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Check for default passwords
        if (envContent.includes('password=123') || envContent.includes('password=admin')) {
          vulnerabilities.push({
            type: 'configuration',
            file: '.env',
            severity: 'critical',
            description: 'Default password detected',
            recommendation: 'Use strong, unique passwords'
          });
        }
        
        // Check for missing required variables
        const requiredVars = ['NODE_ENV', 'MONGODB_URI', 'ACCESS_TOKEN_SECRETSTRING'];
        requiredVars.forEach(varName => {
          if (!envContent.includes(`${varName}=`)) {
            vulnerabilities.push({
              type: 'configuration',
              file: '.env',
              severity: 'medium',
              description: `Missing required environment variable: ${varName}`,
              recommendation: `Add ${varName} to environment configuration`
            });
          }
        });
      }
      
      return {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerable',
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities.length * 25))
      };
      
    } catch (error) {
      console.error('Error scanning configuration:', error);
      return {
        status: 'error',
        error: error.message,
        vulnerabilities: [],
        score: 0
      };
    }
  }

  // Scan environment setup
  async scanEnvironment() {
    try {
      const vulnerabilities = [];
      
      // Check if running in production
      if (process.env.NODE_ENV === 'production') {
        // Check for debug mode
        if (process.env.DEBUG) {
          vulnerabilities.push({
            type: 'environment',
            severity: 'medium',
            description: 'Debug mode enabled in production',
            recommendation: 'Disable debug mode in production'
          });
        }
        
        // Check for insecure cookies
        if (!process.env.COOKIE_SECURE || process.env.COOKIE_SECURE !== 'true') {
          vulnerabilities.push({
            type: 'environment',
            severity: 'high',
            description: 'Insecure cookie configuration',
            recommendation: 'Enable secure cookies in production'
          });
        }
      }
      
      return {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerable',
        environment: process.env.NODE_ENV || 'unknown',
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities.length * 20))
      };
      
    } catch (error) {
      console.error('Error scanning environment:', error);
      return {
        status: 'error',
        error: error.message,
        vulnerabilities: [],
        score: 0
      };
    }
  }

  // Scan file permissions
  async scanPermissions() {
    try {
      const vulnerabilities = [];
      
      // Check file permissions for sensitive files
      const sensitiveFiles = [
        '.env',
        'package.json',
        'config/db.js'
      ];
      
      sensitiveFiles.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          
          // Check if file is readable by others (Unix-like systems)
          if (process.platform !== 'win32' && (stats.mode & 0o0044)) {
            vulnerabilities.push({
              type: 'permissions',
              file,
              severity: 'medium',
              description: 'Sensitive file has world-readable permissions',
              recommendation: 'Restrict file permissions to owner only'
            });
          }
        }
      });
      
      return {
        status: vulnerabilities.length === 0 ? 'secure' : 'vulnerable',
        vulnerabilities,
        score: Math.max(0, 100 - (vulnerabilities.length * 15))
      };
      
    } catch (error) {
      console.error('Error scanning permissions:', error);
      return {
        status: 'error',
        error: error.message,
        vulnerabilities: [],
        score: 0
      };
    }
  }

  // Get code files to scan
  getCodeFiles() {
    const codeFiles = [];
    const extensions = ['.js', '.json', '.env'];
    
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scanDirectory(filePath);
        } else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
          codeFiles.push(filePath);
        }
      });
    };
    
    scanDirectory(path.join(__dirname, '..'));
    
    return codeFiles;
  }

  // Calculate overall security score
  calculateSecurityScore(scanResults) {
    const scores = Object.values(scanResults.scans).map(scan => scan.score || 0);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  // Get scan results
  getScanResults() {
    return this.scanResults;
  }

  // Get latest scan result
  getLatestScan() {
    return this.scanResults[this.scanResults.length - 1] || null;
  }

  // Get security recommendations
  getRecommendations() {
    const latestScan = this.getLatestScan();
    
    if (!latestScan) {
      return [];
    }
    
    const recommendations = [];
    
    latestScan.vulnerabilities.forEach(vuln => {
      if (!recommendations.find(r => r.description === vuln.recommendation)) {
        recommendations.push({
          type: vuln.type,
          severity: vuln.severity,
          description: vuln.recommendation,
          affectedFiles: vuln.file ? [vuln.file] : []
        });
      }
    });
    
    return recommendations.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Generate security report
  generateReport() {
    const latestScan = this.getLatestScan();
    
    if (!latestScan) {
      return { error: 'No scan results available' };
    }
    
    return {
      timestamp: latestScan.timestamp,
      score: latestScan.score,
      status: latestScan.score >= 80 ? 'secure' : latestScan.score >= 60 ? 'moderate' : 'vulnerable',
      summary: {
        totalVulnerabilities: latestScan.vulnerabilities.length,
        critical: latestScan.vulnerabilities.filter(v => v.severity === 'critical').length,
        high: latestScan.vulnerabilities.filter(v => v.severity === 'high').length,
        medium: latestScan.vulnerabilities.filter(v => v.severity === 'medium').length,
        low: latestScan.vulnerabilities.filter(v => v.severity === 'low').length
      },
      scans: latestScan.scans,
      recommendations: this.getRecommendations()
    };
  }

  // Clear scan results
  clearResults() {
    this.scanResults = [];
    console.log('[SECURITY] Scan results cleared');
  }
}

// Create singleton instance
const securityScanner = new SecurityScanner();

module.exports = securityScanner;
