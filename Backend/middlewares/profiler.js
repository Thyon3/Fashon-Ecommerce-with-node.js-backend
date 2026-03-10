class Profiler {
  static profiles = new Map();
  static enabled = process.env.NODE_ENV === 'development';

  static start(id) {
    if (!this.enabled) return;
    
    this.profiles.set(id, {
      startTime: process.hrtime.bigint(),
      memoryBefore: process.memoryUsage()
    });
  }

  static end(id) {
    if (!this.enabled) return;
    
    const profile = this.profiles.get(id);
    if (!profile) return;

    const endTime = process.hrtime.bigint();
    const memoryAfter = process.memoryUsage();
    
    const duration = Number(endTime - profile.startTime) / 1000000; // Convert to milliseconds
    const memoryDiff = memoryAfter.heapUsed - profile.memoryBefore.heapUsed;

    const result = {
      id,
      duration: Math.round(duration * 100) / 100,
      memoryUsed: Math.round(memoryDiff / 1024), // KB
      timestamp: new Date().toISOString()
    };

    this.profiles.delete(id);
    console.log(`[PROFILER] ${result.id}: ${result.duration}ms, ${result.memoryUsed}KB`);
    
    return result;
  }

  static middleware() {
    return (req, res, next) => {
      const id = `${req.method}-${req.originalUrl}-${Date.now()}`;
      this.start(id);

      res.on('finish', () => {
        const profile = this.end(id);
        if (profile) {
          req.profile = profile;
        }
      });

      next();
    };
  }

  static async function(name, fn) {
    if (!this.enabled) return await fn();

    const id = `function-${name}-${Date.now()}`;
    this.start(id);
    
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  static getProfiles() {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({
      id,
      startTime: profile.startTime,
      memoryBefore: profile.memoryBefore
    }));
  }

  static clear() {
    this.profiles.clear();
  }
}

module.exports = Profiler;
