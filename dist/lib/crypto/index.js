"use strict";
/**
 * Crypto Trading Signal Module
 * Exports all crypto-related functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTrend = exports.calculateSupportResistance = exports.analyzeVolume = exports.calculateATR = exports.calculateBollingerBands = exports.calculateMACD = exports.calculateRSI = exports.analyzeMarket = exports.displayComprehensiveAnalysis = exports.comprehensiveAnalysis = exports.fullSignal = exports.quickSignal = exports.displaySignal = exports.generateTradingSignal = exports.formatSignalSummary = exports.generateSignal = exports.calculateIndicators = exports.calculateAllEMAs = exports.calculateEMA = exports.isValidSymbol = exports.getSupportedSymbols = exports.normalizeSymbol = exports.fetch24hTicker = exports.fetchOHLCV = exports.fetchCryptoData = void 0;
var data_fetcher_1 = require("./data-fetcher");
Object.defineProperty(exports, "fetchCryptoData", { enumerable: true, get: function () { return data_fetcher_1.fetchCryptoData; } });
Object.defineProperty(exports, "fetchOHLCV", { enumerable: true, get: function () { return data_fetcher_1.fetchOHLCV; } });
Object.defineProperty(exports, "fetch24hTicker", { enumerable: true, get: function () { return data_fetcher_1.fetch24hTicker; } });
Object.defineProperty(exports, "normalizeSymbol", { enumerable: true, get: function () { return data_fetcher_1.normalizeSymbol; } });
Object.defineProperty(exports, "getSupportedSymbols", { enumerable: true, get: function () { return data_fetcher_1.getSupportedSymbols; } });
Object.defineProperty(exports, "isValidSymbol", { enumerable: true, get: function () { return data_fetcher_1.isValidSymbol; } });
var analyzer_1 = require("./analyzer");
Object.defineProperty(exports, "calculateEMA", { enumerable: true, get: function () { return analyzer_1.calculateEMA; } });
Object.defineProperty(exports, "calculateAllEMAs", { enumerable: true, get: function () { return analyzer_1.calculateAllEMAs; } });
Object.defineProperty(exports, "calculateIndicators", { enumerable: true, get: function () { return analyzer_1.calculateIndicators; } });
Object.defineProperty(exports, "generateSignal", { enumerable: true, get: function () { return analyzer_1.generateSignal; } });
Object.defineProperty(exports, "formatSignalSummary", { enumerable: true, get: function () { return analyzer_1.formatSignalSummary; } });
var signal_generator_1 = require("./signal-generator");
Object.defineProperty(exports, "generateTradingSignal", { enumerable: true, get: function () { return signal_generator_1.generateTradingSignal; } });
Object.defineProperty(exports, "displaySignal", { enumerable: true, get: function () { return signal_generator_1.displaySignal; } });
Object.defineProperty(exports, "quickSignal", { enumerable: true, get: function () { return signal_generator_1.quickSignal; } });
Object.defineProperty(exports, "fullSignal", { enumerable: true, get: function () { return signal_generator_1.fullSignal; } });
Object.defineProperty(exports, "comprehensiveAnalysis", { enumerable: true, get: function () { return signal_generator_1.comprehensiveAnalysis; } });
Object.defineProperty(exports, "displayComprehensiveAnalysis", { enumerable: true, get: function () { return signal_generator_1.displayComprehensiveAnalysis; } });
var market_analyzer_1 = require("./market-analyzer");
Object.defineProperty(exports, "analyzeMarket", { enumerable: true, get: function () { return market_analyzer_1.analyzeMarket; } });
var indicators_1 = require("./indicators");
Object.defineProperty(exports, "calculateRSI", { enumerable: true, get: function () { return indicators_1.calculateRSI; } });
Object.defineProperty(exports, "calculateMACD", { enumerable: true, get: function () { return indicators_1.calculateMACD; } });
Object.defineProperty(exports, "calculateBollingerBands", { enumerable: true, get: function () { return indicators_1.calculateBollingerBands; } });
Object.defineProperty(exports, "calculateATR", { enumerable: true, get: function () { return indicators_1.calculateATR; } });
Object.defineProperty(exports, "analyzeVolume", { enumerable: true, get: function () { return indicators_1.analyzeVolume; } });
Object.defineProperty(exports, "calculateSupportResistance", { enumerable: true, get: function () { return indicators_1.calculateSupportResistance; } });
Object.defineProperty(exports, "analyzeTrend", { enumerable: true, get: function () { return indicators_1.analyzeTrend; } });
