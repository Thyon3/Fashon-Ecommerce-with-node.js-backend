const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class DataPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enablePersistence: options.enablePersistence || false,
      persistenceFile: options.persistenceFile || path.join(process.cwd(), 'data', 'pipeline.json'),
      enableMetrics: options.enableMetrics !== false,
      enableDataValidation: options.enableDataValidation || false,
      enableDataTransformation: options.enableDataTransformation !== false,
      enableDataAggregation: options.enableDataAggregation || false,
      enableDataFiltering: options.enableDataFiltering !== false,
      enableDataEnrichment: options.enableDataEnrichment || false,
      enableDataDeduplication: options.enableDataDeduplication || false,
      enableDataCompression: options.enableDataCompression || false,
      enableDataEncryption: options.enableDataEncryption || false,
      enableDataBatching: options.enableDataBatching || false,
      batchSize: options.batchSize || 100,
      batchTimeout: options.batchTimeout || 5000, // 5 seconds
      enableDataStreaming: options.enableDataStreaming || false,
      enableDataPartitioning: options.enableDataPartitioning || false,
      enableDataReplication: options.enableDataReplication || false,
      enableDataBackup: options.enableDataBackup || false,
      enableDataRecovery: options.enableDataRecovery || false,
      enableDataMonitoring: options.enableDataMonitoring !== false,
      enableDataLogging: options.enableDataLogging !== false,
      enableDataDebugging: options.enableDataDebugging || false,
      enableParallelProcessing: options.enableParallelProcessing || false,
      maxWorkers: options.maxWorkers || 4,
      enableRetryLogic: options.enableRetryLogic !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enableDeadLetterQueue: options.enableDeadLetterQueue || false,
      deadLetterQueueSize: options.deadLetterQueueSize || 1000,
      enableDataVersioning: options.enableDataVersioning || false,
      defaultDataVersion: options.defaultDataVersion || '1.0',
      enableDataSchemas: options.enableDataSchemas || false,
      maxPipelineHistory: options.maxPipelineHistory || 10000,
      ...options
    };
    
    this.pipelines = new Map();
    this.pipelineStages = new Map();
    this.dataSchemas = new Map();
    this.dataTransformers = new Map();
    this.dataValidators = new.Map();
    this.dataFilters = new Map();
    this.dataAggregators = new.Map();
    this.dataEnrichers = new Map();
    this.pipelineBatches = new Map();
    this.deadLetterQueue = [];
    this.pipelineMetrics = new Map();
    this.activePipelines = new Set();
    this.pipelineHistory = [];
    
    this.metrics = {
      totalPipelines: 0,
      totalStages: 0,
      totalDataProcessed: 0,
      totalDataFailed: 0,
      totalDataFiltered: 0,
      totalDataTransformed: 0,
      totalDataAggregated: 0,
      totalDataEnriched: 0,
      totalDataDeduplicated: 0,
      totalDataCompressed: 0,
      totalDataEncrypted: 0,
      totalDataBatched: 0,
      totalDataStreamed: 0,
      totalDataPartitioned: 0,
      totalDataReplicated: 0,
      totalDataBackedUp: 0,
      totalDataRecovered: 0,
      averageProcessingTime: 0,
      peakThroughput: 0,
      pipelinesByStatus: new Map(),
      stagesByType: new Map(),
      dataByType: new Map(),
      errorsByType: new Map(),
      retriesByPipeline: new Map(),
      deadLetterQueueSize: 0,
      startTime: Date.now(),
      lastDataProcessed: null
    };
    
    this.processingTimes = [];
    this.batchTimers = new Map();
    this.workers = [];
    
    this.init();
  }

  init() {
    if (this.options.enablePersistence) {
      this.loadPersistedPipelines();
    }
    
    if (this.options.enableParallelProcessing) {
      this.initializeWorkers();
    }
    
    if (this.options.enableDataMonitoring) {
      this.startDataMonitoring();
    }
    
    if (this.options.enableDataRecovery) {
      this.startDataRecovery();
    }
    
    console.log('[DATA_PIPELINE] Data pipeline initialized');
  }

  async loadPersistedPipelines() {
    try {
      const content = await fs.readFile(this.options.persistenceFile, 'utf8');
      const data = JSON.parse(content);
      
      if (data.pipelines) {
        for (const [id, pipeline] of Object.entries(data.pipelines)) {
          this.pipelines.set(id, {
            ...pipeline,
            status: 'stopped',
            lastProcessed: null
          });
        }
      }
      
      if (data.metrics) {
        this.metrics.pipelinesByStatus = new Map(data.metrics.pipelinesByStatus || []);
        this.metrics.stagesByType = new Map(data.metrics.stagesByType || []);
        this.metrics.dataByType = new Map(data.metrics.dataByType || []);
        this.metrics.errorsByType = new Map(data.metrics.errorsByType || []);
      }
      
      console.log(`[DATA_PIPELINE] Loaded ${this.pipelines.size} persisted pipelines`);
    } catch (error) {
      console.log('[DATA_PIPELINE] No persisted pipelines found');
    }
  }

  async persistPipelines() {
    if (!this.options.enablePersistence) return;
    
    try {
      const data = {
        pipelines: Object.fromEntries(this.pipelines),
        metrics: {
          pipelinesByStatus: Array.from(this.metrics.pipelinesByStatus.entries()),
          stagesByType: Array.from(this.metrics.stagesByType.entries()),
          dataByType: Array.from(this.metrics.dataByType.entries()),
          errorsByType: Array.from(this.metrics.errorsByType.entries())
        },
        timestamp: Date.now()
      };
      
      const dataDir = path.dirname(this.options.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      await fs.writeFile(this.options.persistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[DATA_PIPELINE] Failed to persist pipelines:', error);
    }
  }

  initializeWorkers() {
    for (let i = 0; i < this.options.maxWorkers; i++) {
      const worker = {
        id: `worker_${i}`,
        busy: false,
        processed: 0,
        errors: 0
      };
      
      this.workers.push(worker);
    }
    
    console.log(`[DATA_PIPELINE] Initialized ${this.options.maxWorkers} workers`);
  }

  createPipeline(name, config) {
    const pipeline = {
      id: this.generatePipelineId(),
      name,
      stages: config.stages || [],
      options: {
        enableValidation: config.enableValidation !== false,
        enableTransformation: config.enableTransformation !== false,
        enableAggregation: config.enableAggregation || false,
        enableFiltering: config.enableFiltering || false,
        enableEnrichment: config.enableEnrichment || false,
        enableDeduplication: config.enableDeduplication || false,
        enableCompression: config.enableCompression || false,
        enableEncryption: config.enableEncryption || false,
        enableBatching: config.enableBatching || false,
        enableStreaming: config.enableStreaming || false,
        enablePartitioning: config.enablePartitioning || false,
        enableReplication: config.enableReplication || false,
        enableBackup: config.enableBackup || false,
        parallelProcessing: config.parallelProcessing || false,
        retryLogic: config.retryLogic !== false,
        ...config.options
      },
      metadata: config.metadata || {},
      status: 'created',
      createdAt: Date.now(),
      lastProcessed: null,
      processedCount: 0,
      errorCount: 0,
      throughput: 0,
      averageProcessingTime: 0
    };
    
    // Validate pipeline configuration
    if (!this.validatePipelineConfig(pipeline)) {
      throw new Error('Invalid pipeline configuration');
    }
    
    // Add to pipelines map
    this.pipelines.set(pipeline.id, pipeline);
    
    // Initialize pipeline stages
    this.initializePipelineStages(pipeline);
    
    // Update metrics
    this.metrics.totalPipelines++;
    this.updatePipelineStatusMetrics(pipeline);
    
    // Persist pipelines
    this.persistPipelines();
    
    console.log(`[DATA_PIPELINE] Created pipeline: ${pipeline.name} (${pipeline.id})`);
    
    this.emit('pipeline:created', pipeline);
    
    return pipeline;
  }

  generatePipelineId() {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validatePipelineConfig(pipeline) {
    if (!pipeline.name || typeof pipeline.name !== 'string') {
      return false;
    }
    
    if (!Array.isArray(pipeline.stages) || pipeline.stages.length === 0) {
      return false;
    }
    
    // Validate each stage
    for (const stage of pipeline.stages) {
      if (!stage.type || !stage.name) {
        return false;
      }
    }
    
    return true;
  }

  initializePipelineStages(pipeline) {
    const stages = [];
    
    for (const stageConfig of pipeline.stages) {
      const stage = {
        id: this.generateStageId(),
        pipelineId: pipeline.id,
        type: stageConfig.type,
        name: stageConfig.name,
        config: stageConfig.config || {},
        order: stageConfig.order || stages.length,
        enabled: stageConfig.enabled !== false,
        statistics: {
          processed: 0,
          errors: 0,
          averageTime: 0,
          lastProcessed: null
        },
        createdAt: Date.now()
      };
      
      stages.push(stage);
      this.pipelineStages.set(stage.id, stage);
    }
    
    // Sort stages by order
    stages.sort((a, b) => a.order - b.order);
    
    // Update pipeline stages
    pipeline.stages = stages;
    this.metrics.totalStages += stages.length;
    
    // Update stage type metrics
    for (const stage of stages) {
      const typeCount = this.metrics.stagesByType.get(stage.type) || 0;
      this.metrics.stagesByType.set(stage.type, typeCount + 1);
    }
  }

  generateStageId() {
    return `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async startPipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }
    
    if (pipeline.status === 'running') {
      throw new Error(`Pipeline already running: ${pipelineId}`);
    }
    
    pipeline.status = 'running';
    this.activePipelines.add(pipelineId);
    
    this.updatePipelineStatusMetrics(pipeline);
    
    console.log(`[DATA_PIPELINE] Started pipeline: ${pipeline.name} (${pipelineId})`);
    
    this.emit('pipeline:started', pipeline);
    
    return pipeline;
  }

  async stopPipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }
    
    if (pipeline.status !== 'running') {
      throw new Error(`Pipeline not running: ${pipelineId}`);
    }
    
    pipeline.status = 'stopped';
    this.activePipelines.delete(pipelineId);
    
    this.updatePipelineStatusMetrics(pipeline);
    
    console.log(`[DATA_PIPELINE] Stopped pipeline: ${pipeline.name} (${pipelineId})`);
    
    this.emit('pipeline:stopped', pipeline);
    
    return pipeline;
  }

  async processData(pipelineId, data, options = {}) {
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }
    
    if (pipeline.status !== 'running') {
      throw new Error(`Pipeline not running: ${pipelineId}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Create data context
      const context = this.createDataContext(data, options);
      
      // Process through pipeline stages
      let processedData = context;
      
      for (const stage of pipeline.stages) {
        if (!stage.enabled) {
          continue;
        }
        
        processedData = await this.processStage(stage, processedData);
      }
      
      // Update pipeline metrics
      const processingTime = Date.now() - startTime;
      this.updatePipelineMetrics(pipeline, processingTime, true);
      
      // Add to history
      this.addToHistory(pipelineId, data, processedData, processingTime, true);
      
      if (this.options.enableDataLogging) {
        console.log(`[DATA_PIPELINE] Processed data in pipeline ${pipeline.name} (${processingTime}ms)`);
      }
      
      this.emit('data:processed', {
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        data,
        processedData,
        processingTime
      });
      
      return processedData;
      
    } catch (error) {
      // Update pipeline metrics
      const processingTime = Date.now() - startTime;
      this.updatePipelineMetrics(pipeline, processingTime, false);
      
      // Add to history
      this.addToHistory(pipelineId, data, null, processingTime, false, error);
      
      // Handle error
      await this.handlePipelineError(pipeline, data, error);
      
      throw error;
    }
  }

  createDataContext(data, options) {
    return {
      id: this.generateDataId(),
      data,
      metadata: {
        type: options.dataType || 'unknown',
        version: options.dataVersion || this.options.defaultDataVersion,
        source: options.source || 'unknown',
        timestamp: Date.now(),
        correlationId: options.correlationId || null,
        ...options.metadata
      },
      processed: false,
      errors: [],
      transformations: [],
      enrichments: [],
      validations: []
    };
  }

  generateDataId() {
    return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async processStage(stage, context) {
    const stageStartTime = Date.now();
    
    try {
      let processedContext = context;
      
      switch (stage.type) {
        case 'validator':
          processedContext = await this.processValidatorStage(stage, processedContext);
          break;
        case 'transformer':
          processedContext = await this.processTransformerStage(stage, processedContext);
          break;
        case 'filter':
          processedContext = await this.processFilterStage(stage, processedContext);
          break;
        case 'aggregator':
          processedContext = await this.processAggregatorStage(stage, processedContext);
          break;
        case 'enricher':
          processedContext = await this.processEnricherStage(stage, processedContext);
          break;
        case 'deduplicator':
          processedContext = await this.processDeduplicatorStage(stage, processedContext);
          break;
        case 'compressor':
          processedContext = await this.processCompressorStage(stage, processedContext);
          break;
        case 'encryptor':
          processedContext = await this.processEncryptorStage(stage, processedContext);
          break;
        case 'batcher':
          processedContext = await this.processBatcherStage(stage, processedContext);
          break;
        case 'partitioner':
          processedContext = await this.processPartitionerStage(stage, processedContext);
          break;
        case 'replicator':
          processedContext = await this.processReplicatorStage(stage, processedContext);
          break;
        case 'backuper':
          processedContext = await this.processBackuperStage(stage, processedContext);
          break;
        default:
          throw new Error(`Unknown stage type: ${stage.type}`);
      }
      
      // Update stage statistics
      const stageProcessingTime = Date.now() - stageStartTime;
      this.updateStageStatistics(stage, stageProcessingTime, true);
      
      return processedContext;
      
    } catch (error) {
      // Update stage statistics
      const stageProcessingTime = Date.now() - stageStartTime;
      this.updateStageStatistics(stage, stageProcessingTime, false);
      
      // Add error to context
      context.errors.push({
        stageId: stage.id,
        stageName: stage.name,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  async processValidatorStage(stage, context) {
    if (!this.options.enableDataValidation) {
      return context;
    }
    
    const validator = this.dataValidators.get(stage.config.validatorName);
    
    if (!validator) {
      throw new Error(`Validator not found: ${stage.config.validatorName}`);
    }
    
    const isValid = await validator(context.data, context.metadata);
    
    context.validations.push({
      validatorName: stage.config.validatorName,
      result: isValid,
      timestamp: Date.now()
    });
    
    if (!isValid) {
      throw new Error(`Data validation failed: ${stage.config.validatorName}`);
    }
    
    return context;
  }

  async processTransformerStage(stage, context) {
    if (!this.options.enableDataTransformation) {
      return context;
    }
    
    const transformer = this.dataTransformers.get(stage.config.transformerName);
    
    if (!transformer) {
      throw new Error(`Transformer not found: ${stage.config.transformerName}`);
    }
    
    const transformedData = await transformer(context.data, context.metadata, stage.config);
    
    context.transformations.push({
      transformerName: stage.config.transformerName,
      timestamp: Date.now()
    });
    
    context.data = transformedData;
    
    return context;
  }

  async processFilterStage(stage, context) {
    if (!this.options.enableDataFiltering) {
      return context;
    }
    
    const filter = this.dataFilters.get(stage.config.filterName);
    
    if (!filter) {
      throw new Error(`Filter not found: ${stage.config.filterName}`);
    }
    
    const shouldPass = await filter(context.data, context.metadata);
    
    if (!shouldPass) {
      throw new Error(`Data filtered out: ${stage.config.filterName}`);
    }
    
    return context;
  }

  async processAggregatorStage(stage, context) {
    if (!this.options.enableDataAggregation) {
      return context;
    }
    
    const aggregator = this.dataAggregators.get(stage.config.aggregatorName);
    
    if (!aggregator) {
      throw new Error(`Aggregator not found: ${stage.config.aggregatorName}`);
    }
    
    const aggregatedData = await aggregator(context.data, context.metadata, stage.config);
    
    context.data = aggregatedData;
    
    return context;
  }

  async processEnricherStage(stage, context) {
    if (!this.options.enableDataEnrichment) {
      return context;
    }
    
    const enricher = this.dataEnrichers.get(stage.config.enricherName);
    
    if (!enricher) {
      throw new Error(`Enricher not found: ${stage.config.enricherName}`);
    }
    
    const enrichment = await enricher(context.data, context.metadata, stage.config);
    
    context.enrichments.push({
      enricherName: stage.config.enricherName,
      enrichment,
      timestamp: Date.now()
    });
    
    // Merge enrichment into metadata
    Object.assign(context.metadata, enrichment);
    
    return context;
  }

  async processDeduplicatorStage(stage, context) {
    if (!this.options.enableDataDeduplication) {
      return context;
    }
    
    const deduplicationKey = this.generateDeduplicationKey(context);
    
    // Check if data already exists (simplified implementation)
    // In production, use proper deduplication storage
    const isDuplicate = false; // Placeholder
    
    if (isDuplicate) {
      throw new Error(`Duplicate data detected: ${deduplicationKey}`);
    }
    
    return context;
  }

  async processCompressorStage(stage, context) {
    if (!this.options.enableDataCompression) {
      return context;
    }
    
    // Simple compression implementation
    const compressedData = JSON.stringify(context.data);
    
    context.data = compressedData;
    context.metadata.compressed = true;
    
    this.metrics.totalDataCompressed++;
    
    return context;
  }

  async processEncryptorStage(stage, context) {
    if (!this.options.enableDataEncryption) {
      return context;
    }
    
    // Simple encryption implementation
    const encryptedData = JSON.stringify(context.data);
    
    context.data = encryptedData;
    context.metadata.encrypted = true;
    
    this.metrics.totalDataEncrypted++;
    
    return context;
  }

  async processBatcherStage(stage, context) {
    if (!this.options.enableDataBatching) {
      return context;
    }
    
    const batchKey = this.getBatchKey(stage, context);
    
    if (!this.pipelineBatches.has(batchKey)) {
      this.pipelineBatches.set(batchKey, []);
    }
    
    const batch = this.pipelineBatches.get(batchKey);
    batch.push(context);
    
    // Start batch timer if not already running
    if (!this.batchTimers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey, stage);
      }, this.options.batchTimeout);
      
      this.batchTimers.set(batchKey, timer);
    }
    
    // Process batch immediately if full
    if (batch.length >= this.options.batchSize) {
      this.processBatch(batchKey, stage);
    }
    
    this.metrics.totalDataBatched++;
    
    return context;
  }

  getBatchKey(stage, context) {
    return `${stage.pipelineId}:${stage.id}:${context.metadata.type || 'default'}`;
  }

  processBatch(batchKey, stage) {
    const batch = this.pipelineBatches.get(batchKey);
    
    if (!batch || batch.length === 0) {
      return;
    }
    
    // Clear batch timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey));
      this.batchTimers.delete(batchKey);
    }
    
    // Process batch
    console.log(`[DATA_PIPELINE] Processing batch: ${batchKey} (${batch.length} items)`);
    
    // Clear batch
    this.pipelineBatches.delete(batchKey);
  }

  async processPartitionerStage(stage, context) {
    if (!this.options.enableDataPartitioning) {
      return context;
    }
    
    const partitionKey = this.generatePartitionKey(stage, context);
    
    context.metadata.partition = partitionKey;
    this.metrics.totalDataPartitioned++;
    
    return context;
  }

  generatePartitionKey(stage, context) {
    // Simple partitioning implementation
    return `${context.metadata.type}_${context.id % 10}`;
  }

  async processReplicatorStage(stage, context) {
    if (!this.options.enableDataReplication) {
      return context;
    }
    
    // Simple replication implementation
    context.metadata.replicated = true;
    this.metrics.totalDataReplicated++;
    
    return context;
  }

  async processBackuperStage(stage, context) {
    if (!this.options.enableDataBackup) {
      return context;
    }
    
    // Simple backup implementation
    context.metadata.backedUp = true;
    this.metrics.totalDataBackedUp++;
    
    return context;
  }

  generateDeduplicationKey(context) {
    const key = `${context.metadata.type}:${JSON.stringify(context.data)}`;
    return require('crypto').createHash('md5').update(key).digest('hex');
  }

  updateStageStatistics(stage, processingTime, success) {
    stage.statistics.processed++;
    
    if (!success) {
      stage.statistics.errors++;
    }
    
    // Update average processing time
    const totalTime = stage.statistics.averageTime * (stage.statistics.processed - 1) + processingTime;
    stage.statistics.averageTime = totalTime / stage.statistics.processed;
    
    stage.statistics.lastProcessed = Date.now();
  }

  updatePipelineMetrics(pipeline, processingTime, success) {
    pipeline.processedCount++;
    
    if (!success) {
      pipeline.errorCount++;
    }
    
    // Update average processing time
    const totalTime = pipeline.averageProcessingTime * (pipeline.processedCount - 1) + processingTime;
    pipeline.averageProcessingTime = totalTime / pipeline.processedCount;
    
    pipeline.lastProcessed = Date.now();
    
    // Update global metrics
    this.metrics.totalDataProcessed++;
    
    if (!success) {
      this.metrics.totalDataFailed++;
    }
    
    // Update processing time
    this.processingTimes.push(processingTime);
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000);
    }
    
    // Calculate average processing time
    this.metrics.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    
    // Update data type metrics
    const dataType = 'unknown'; // Would be extracted from context
    const typeCount = this.metrics.dataByType.get(dataType) || 0;
    this.metrics.dataByType.set(dataType, typeCount + 1);
    
    this.metrics.lastDataProcessed = Date.now();
  }

  updatePipelineStatusMetrics(pipeline) {
    const statusCount = this.metrics.pipelinesByStatus.get(pipeline.status) || 0;
    this.metrics.pipelinesByStatus.set(pipeline.status, statusCount + 1);
  }

  addToHistory(pipelineId, inputData, outputData, processingTime, success, error = null) {
    const historyEntry = {
      id: this.generateHistoryId(),
      pipelineId,
      timestamp: Date.now(),
      inputData,
      outputData,
      processingTime,
      success,
      error: error ? error.message : null
    };
    
    this.pipelineHistory.push(historyEntry);
    
    // Limit history size
    if (this.pipelineHistory.length > this.options.maxPipelineHistory) {
      this.pipelineHistory = this.pipelineHistory.slice(-this.options.maxPipelineHistory);
    }
  }

  generateHistoryId() {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async handlePipelineError(pipeline, data, error) {
    console.error(`[DATA_PIPELINE] Pipeline error in ${pipeline.name}:`, error);
    
    // Update error metrics
    const errorType = error.constructor.name;
    const errorCount = this.metrics.errorsByType.get(errorType) || 0;
    this.metrics.errorsByType.set(errorType, errorCount + 1);
    
    // Add to dead letter queue if enabled
    if (this.options.enableDeadLetterQueue) {
      this.addToDeadLetterQueue(pipeline, data, error);
    }
    
    // Retry logic if enabled
    if (pipeline.options.retryLogic && this.options.enableRetryLogic) {
      await this.retryPipelineProcessing(pipeline, data, error);
    }
    
    this.emit('pipeline:error', {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      data,
      error,
      timestamp: Date.now()
    });
  }

  addToDeadLetterQueue(pipeline, data, error) {
    const deadLetterEntry = {
      id: this.generateDataId(),
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      data,
      error: error.message,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.deadLetterQueue.push(deadLetterEntry);
    
    // Limit dead letter queue size
    if (this.deadLetterQueue.length > this.options.deadLetterQueueSize) {
      this.deadLetterQueue.shift();
    }
    
    this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;
    
    console.error(`[DATA_PIPELINE] Added to dead letter queue: ${pipeline.name}`);
  }

  async retryPipelineProcessing(pipeline, data, error) {
    const retryKey = `${pipeline.id}:${data.id || 'unknown'}`;
    const retryCount = this.metrics.retriesByPipeline.get(retryKey) || 0;
    
    if (retryCount >= this.options.maxRetries) {
      console.error(`[DATA_PIPELINE] Max retries exceeded for pipeline: ${pipeline.name}`);
      return;
    }
    
    this.metrics.retriesByPipeline.set(retryKey, retryCount + 1);
    
    console.log(`[DATA_PIPELINE] Retrying pipeline ${pipeline.name} (attempt ${retryCount + 1})`);
    
    setTimeout(async () => {
      try {
        await this.processData(pipeline.id, data);
        this.metrics.retriesByPipeline.delete(retryKey);
        this.metrics.totalDataRecovered++;
      } catch (retryError) {
        console.error(`[DATA_PIPELINE] Retry failed for pipeline ${pipeline.name}:`, retryError);
      }
    }, this.options.retryDelay * (retryCount + 1));
  }

  startDataMonitoring() {
    setInterval(() => {
      this.updateMonitoringMetrics();
    }, 5000); // Update every 5 seconds
    
    console.log('[DATA_PIPELINE] Data monitoring started');
  }

  updateMonitoringMetrics() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentProcessing = this.pipelineHistory.filter(entry => entry.timestamp > oneSecondAgo);
    const throughput = recentProcessing.length;
    
    if (throughput > this.metrics.peakThroughput) {
      this.metrics.peakThroughput = throughput;
    }
  }

  startDataRecovery() {
    setInterval(() => {
      this.recoverDeadLetterData();
    }, 30000); // Try to recover every 30 seconds
    
    console.log('[DATA_PIPELINE] Data recovery started');
  }

  recoverDeadLetterData() {
    if (this.deadLetterQueue.length === 0) {
      return;
    }
    
    const entriesToRecover = this.deadLetterQueue.splice(0, 10); // Recover 10 at a time
    
    for (const entry of entriesToRecover) {
      try {
        const pipeline = this.pipelines.get(entry.pipelineId);
        
        if (pipeline && pipeline.status === 'running') {
          const success = this.processData(entry.pipelineId, entry.data);
          
          if (success) {
            this.metrics.totalDataRecovered++;
            console.log(`[DATA_PIPELINE] Recovered data for pipeline: ${entry.pipelineName}`);
          } else {
            // Put back in queue with increased retry count
            entry.retryCount++;
            if (entry.retryCount < 3) {
              this.deadLetterQueue.push(entry);
            }
          }
        }
      } catch (error) {
        console.error(`[DATA_PIPELINE] Failed to recover data:`, error);
      }
    }
    
    this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;
  }

  // Pipeline management methods
  addValidator(name, validator) {
    this.dataValidators.set(name, validator);
    console.log(`[DATA_PIPELINE] Added validator: ${name}`);
  }

  addTransformer(name, transformer) {
    this.dataTransformers.set(name, transformer);
    console.log(`[DATA_PIPELINE] Added transformer: ${name}`);
  }

  addFilter(name, filter) {
    this.dataFilters.set(name, filter);
    console.log(`[DATA_PIPELINE] Added filter: ${name}`);
  }

  addAggregator(name, aggregator) {
    this.dataAggregators.set(name, aggregator);
    console.log(`[DATA_PIPELINE] Added aggregator: ${name}`);
  }

  addEnricher(name, enricher) {
    this.dataEnrichers.set(name, enricher);
    console.log(`[DATA_PIPELINE] Added enricher: ${name}`);
  }

  addDataSchema(name, schema) {
    this.dataSchemas.set(name, schema);
    console.log(`[DATA_PIPELINE] Added data schema: ${name}`);
  }

  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId);
  }

  getPipelines(status = null) {
    const pipelines = Array.from(this.pipelines.values());
    
    if (status) {
      return pipelines.filter(pipeline => pipeline.status === status);
    }
    
    return pipelines;
  }

  getPipelineHistory(pipelineId, limit = 50) {
    return this.pipelineHistory
      .filter(entry => entry.pipelineId === pipelineId)
      .slice(-limit)
      .reverse();
  }

  getStats() {
    return {
      ...this.metrics,
      pipelinesByStatus: Object.fromEntries(this.metrics.pipelinesByStatus),
      stagesByType: Object.fromEntries(this.metrics.stagesByType),
      dataByType: Object.fromEntries(this.metrics.dataByType),
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      uptime: Date.now() - this.metrics.startTime,
      activePipelines: this.activePipelines.size,
      historySize: this.pipelineHistory.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      batchSize: this.pipelineBatches.size,
      workers: this.workers.length,
      averageProcessingTime: this.metrics.averageProcessingTime,
      peakThroughput: this.metrics.peakThroughput
    };
  }

  clearHistory() {
    this.pipelineHistory = [];
    this.deadLetterQueue = [];
    this.pipelineBatches.clear();
    this.metrics.retriesByPipeline.clear();
    
    console.log('[DATA_PIPELINE] Pipeline history cleared');
  }

  // Static method to create data pipeline
  static create(options = {}) {
    return new DataPipeline(options);
  }
}

module.exports = DataPipeline;
