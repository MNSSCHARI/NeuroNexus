/**
 * Custom Error Classes for AI Service
 * Provides specific error types with user-friendly messages
 */

/**
 * Base class for AI service errors
 */
class AIServiceError extends Error {
  constructor(message, userMessage, statusCode = 500, originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = userMessage || message;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.userMessage,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
  }
}

/**
 * Error when API key is missing or invalid
 */
class APIKeyMissingError extends AIServiceError {
  constructor(provider, originalError = null) {
    const message = `${provider} API key is missing or invalid`;
    const userMessage = `The ${provider} API key is not configured or is invalid. Please check your project settings.`;
    super(message, userMessage, 401, originalError);
    this.provider = provider;
  }
}

/**
 * Error when a specific model is not available
 */
class ModelUnavailableError extends AIServiceError {
  constructor(model, provider, triedModels = [], originalError = null) {
    const message = `Model ${model} is not available for ${provider}`;
    const userMessage = `The AI model is currently unavailable. Our team has been notified and is working on a fix.`;
    super(message, userMessage, 503, originalError);
    this.model = model;
    this.provider = provider;
    this.triedModels = triedModels;
  }
}

/**
 * Error when rate limit or quota is exceeded
 */
class RateLimitError extends AIServiceError {
  constructor(provider, retryAfter = null, originalError = null) {
    const message = `Rate limit exceeded for ${provider}`;
    const userMessage = retryAfter 
      ? `API rate limit reached. Please try again in ${retryAfter} seconds.`
      : `API rate limit reached. Please try again in a few moments.`;
    super(message, userMessage, 429, originalError);
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
}

/**
 * Error when API response is invalid or malformed
 */
class InvalidResponseError extends AIServiceError {
  constructor(provider, details = '', originalError = null) {
    const message = `Invalid response from ${provider} API${details ? ': ' + details : ''}`;
    const userMessage = `The AI service returned an unexpected response. Please try again.`;
    super(message, userMessage, 502, originalError);
    this.provider = provider;
    this.details = details;
  }
}

/**
 * Error when request times out
 */
class TimeoutError extends AIServiceError {
  constructor(provider, timeoutSeconds, originalError = null) {
    const message = `Request to ${provider} timed out after ${timeoutSeconds} seconds`;
    const userMessage = `The request took too long to process. Please try again with a shorter question or context.`;
    super(message, userMessage, 504, originalError);
    this.provider = provider;
    this.timeoutSeconds = timeoutSeconds;
  }
}

/**
 * Error when all models/providers have been exhausted
 */
class AllProvidersFailedError extends AIServiceError {
  constructor(providers, errors = [], originalError = null) {
    const message = `All AI providers failed: ${providers.join(', ')}`;
    const userMessage = `All AI services are currently unavailable. Please try again later or contact support.`;
    super(message, userMessage, 503, originalError);
    this.providers = providers;
    this.errors = errors;
  }
}

/**
 * Error for network/connection issues
 */
class NetworkError extends AIServiceError {
  constructor(provider, originalError = null) {
    const message = `Network error connecting to ${provider}`;
    const userMessage = `Unable to connect to the AI service. Please check your internet connection and try again.`;
    super(message, userMessage, 503, originalError);
    this.provider = provider;
  }
}

/**
 * Helper function to classify and convert errors to custom error types
 */
function classifyError(error, provider, context = {}) {
  const errorMessage = error.message || String(error);
  const errorString = errorMessage.toLowerCase();

  // API Key errors
  if (errorString.includes('api key') || 
      errorString.includes('authentication') || 
      errorString.includes('unauthorized') ||
      errorString.includes('401')) {
    return new APIKeyMissingError(provider, error);
  }

  // Rate limit errors
  if (errorString.includes('rate limit') || 
      errorString.includes('quota') || 
      errorString.includes('429') ||
      errorString.includes('too many requests')) {
    const retryAfter = error.response?.headers?.['retry-after'] || 
                       error.retryAfter || 
                       null;
    return new RateLimitError(provider, retryAfter, error);
  }

  // Model not found errors
  if (errorString.includes('not found') || 
      errorString.includes('404') ||
      errorString.includes('model') && errorString.includes('unavailable')) {
    return new ModelUnavailableError(
      context.model || 'unknown',
      provider,
      context.triedModels || [],
      error
    );
  }

  // Timeout errors
  if (errorString.includes('timeout') || 
      errorString.includes('timed out') ||
      errorString.includes('504')) {
    return new TimeoutError(provider, context.timeoutSeconds || 30, error);
  }

  // Network errors
  if (errorString.includes('network') || 
      errorString.includes('connection') ||
      errorString.includes('econnrefused') ||
      errorString.includes('enotfound')) {
    return new NetworkError(provider, error);
  }

  // Invalid response errors
  if (errorString.includes('invalid') && errorString.includes('response') ||
      errorString.includes('malformed') ||
      errorString.includes('parse')) {
    return new InvalidResponseError(provider, errorMessage, error);
  }

  // Default: wrap as generic AI service error
  return new AIServiceError(
    errorMessage,
    `An error occurred with the ${provider} service. Please try again.`,
    500,
    error
  );
}

module.exports = {
  AIServiceError,
  APIKeyMissingError,
  ModelUnavailableError,
  RateLimitError,
  InvalidResponseError,
  TimeoutError,
  AllProvidersFailedError,
  NetworkError,
  classifyError
};

