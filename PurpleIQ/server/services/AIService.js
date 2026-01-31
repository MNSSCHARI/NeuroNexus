const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Service
 * Handles LLM interactions for different providers
 */
class AIService {
  constructor() {
    this.clients = new Map(); // Cache clients per API key
  }

  /**
   * Get OpenAI client
   */
  getOpenAIClient(apiKey) {
    const key = `openai-${apiKey}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new OpenAI({ apiKey }));
    }
    return this.clients.get(key);
  }

  /**
   * Get Gemini client
   */
  getGeminiClient(apiKey) {
    const key = `gemini-${apiKey}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new GoogleGenerativeAI(apiKey));
    }
    return this.clients.get(key);
  }

  /**
   * Generate answer using OpenAI
   */
  async generateWithOpenAI(apiKey, context, question) {
    const client = this.getOpenAIClient(apiKey);
    
    const systemPrompt = `You are PurpleIQ, an AI-powered QA assistant. Answer questions based ONLY on the provided project documents and context. If the information is not in the provided context, say so clearly.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return completion.choices[0].message.content;
  }

  /**
   * Generate answer using Gemini
   */
  async generateWithGemini(apiKey, context, question) {
    const genAI = this.getGeminiClient(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemPrompt = `You are PurpleIQ, an AI-powered QA assistant. Answer questions based ONLY on the provided project documents and context. If the information is not in the provided context, say so clearly.`;

    const fullPrompt = `${systemPrompt}\n\nContext from Project Documents:\n\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Generate answer based on AI model type
   */
  async generateAnswer(aiModel, apiKey, context, question) {
    switch (aiModel.toLowerCase()) {
      case 'openai':
        return await this.generateWithOpenAI(apiKey, context, question);
      case 'gemini':
        return await this.generateWithGemini(apiKey, context, question);
      case 'claude':
        // TODO: Implement Claude when API is available
        throw new Error('Claude integration not yet implemented');
      default:
        throw new Error(`Unsupported AI model: ${aiModel}`);
    }
  }
}

module.exports = new AIService();

