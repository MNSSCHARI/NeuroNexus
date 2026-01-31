/**
 * Prompt templates for different workspace types
 * This module provides prompt templates that are sent to OpenAI API
 * Each workspace type has a specialized prompt designed for specific use cases
 */

/**
 * Retrieves the appropriate prompt template based on workspace type
 * @param {string} workspaceType - The type of workspace: 'requirement', 'testcase', 'development', or any other value
 * @returns {string} - The prompt template string with {{input}} placeholder
 */
const getPromptTemplate = (workspaceType) => {
  // Object containing all available prompt templates
  const templates = {
    // Template for requirement analysis workspace
    // Used when workspaceType is 'requirement'
    'requirement': `You are a QA expert.
Analyze the following requirement and provide:
- Functional flow
- Preconditions
- Happy path
- Negative scenarios
- Edge cases
Requirement:
{{input}}`,

    // Template for test case generation workspace
    // Used when workspaceType is 'testcase'
    'testcase': `You are a QA test designer.
Generate structured manual test cases with:
- Test case title
- Steps
- Expected result
- Priority
Requirement:
{{input}}`,

    // Template for development assistance workspace
    // Used when workspaceType is 'development'
    'development': `You are a development assistant. Analyze the following development requirement and provide structured guidance.

Requirement:
{{input}}

Please provide analysis in the following JSON structure:
{
  "summary": "Brief summary",
  "technicalApproach": "Description of technical approach",
  "technologies": ["tech1", "tech2", ...],
  "architecture": "Architecture description",
  "implementationSteps": [
    {"step": 1, "description": "Step description", "dependencies": ["dep1", ...]}
  ],
  "codeStructure": "Description of code structure",
  "testingStrategy": "Testing approach",
  "deploymentConsiderations": ["consideration1", ...],
  "estimatedComplexity": "low|medium|high"
}`,

    // Default template used when workspaceType doesn't match any of the above
    // Provides a generic analysis prompt
    'default': `Analyze the following text and provide structured output.

Text:
{{input}}

Please provide a structured analysis in JSON format with relevant sections based on the content.`
  };

  // Convert workspaceType to lowercase for case-insensitive matching
  // Return the matching template, or 'default' if no match is found
  // This ensures we always return a valid template string
  return templates[workspaceType.toLowerCase()] || templates['default'];
};

/**
 * Formats a prompt template by replacing the {{input}} placeholder with actual user text
 * @param {string} template - The prompt template string containing {{input}} placeholder
 * @param {string} text - The actual user input text to insert into the template
 * @returns {string} - The formatted prompt with user text inserted
 */
const formatPrompt = (template, text) => {
  // Replace the {{input}} placeholder with the actual user input text
  // This creates the final prompt that will be sent to OpenAI
  return template.replace('{{input}}', text);
};

// Export both functions so they can be imported and used in other modules (like index.js)
module.exports = {
  getPromptTemplate, // Function to get prompt template by workspace type
  formatPrompt // Function to format template with user input
};

