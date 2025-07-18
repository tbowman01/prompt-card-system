# Creating Prompt Cards

Learn how to create effective prompt cards that serve as the foundation for systematic LLM testing.

## 📝 What is a Prompt Card?

A prompt card is a template that defines:
- **The prompt structure** with variable placeholders
- **Metadata** like title, description, and tags
- **Variable definitions** that can be reused across test cases
- **Default values** for common scenarios

## 🎯 Creating Your First Prompt Card

### Basic Information
1. **Title**: Choose a descriptive name
   - Good: "Customer Support Response Generator"
   - Bad: "Prompt1"

2. **Description**: Explain the purpose and use case
   - Include what the prompt does
   - Mention any special requirements
   - Note expected output format

3. **Tags**: Add relevant keywords for organization
   - Use consistent naming (e.g., "customer-service", "code-generation")
   - Include difficulty level if relevant

### Prompt Template Structure

Use the `{{variable_name}}` syntax for dynamic content:

```
You are a {{role}} with {{experience}} years of experience.

Task: {{task}}
Context: {{context}}

Please provide a {{output_format}} response that:
- {{requirement1}}
- {{requirement2}}
- {{requirement3}}

Tone: {{tone}}
```

## 🔧 Variable Types and Usage

### String Variables
Most common type for text input:
```
Hello {{customer_name}}, thank you for contacting {{company_name}}.
```

### Number Variables
For numeric values:
```
Generate {{count}} examples of {{topic}}.
```

### Boolean Variables
For conditional logic:
```
{{#if include_examples}}
Here are some examples:
{{examples}}
{{/if}}
```

### Array Variables
For lists of items:
```
Consider these factors: {{#each factors}}
- {{this}}
{{/each}}
```

## 🎨 Prompt Design Best Practices

### 1. Clear Structure
```
# Good Structure
Role: {{role}}
Task: {{task}}
Context: {{context}}
Requirements: {{requirements}}
Output Format: {{format}}
```

### 2. Explicit Instructions
```
# Instead of:
Write about {{topic}}.

# Use:
Write a {{word_count}}-word {{style}} article about {{topic}} that:
- Includes {{key_points}}
- Uses {{tone}} tone
- Targets {{audience}} audience
```

### 3. Output Format Specification
```
Please respond in the following JSON format:
{
  "summary": "Brief summary here",
  "details": ["detail1", "detail2"],
  "confidence": 0.95
}
```

### 4. Constraint Definition
```
Constraints:
- Maximum {{max_words}} words
- Must include {{required_elements}}
- Avoid {{forbidden_topics}}
- Use {{language}} language only
```

## 🔄 Variable Management

### Default Values
Set sensible defaults for common scenarios:
- `role`: "helpful assistant"
- `tone`: "professional"
- `language`: "English"

### Variable Validation
Add validation rules:
- **Required**: Must be provided
- **Pattern**: Must match regex
- **Range**: Numeric min/max values
- **Options**: Must be from predefined list

### Variable Groups
Organize related variables:
```
# Context Variables
{{user_context}}
{{business_context}}
{{technical_context}}

# Output Variables
{{output_format}}
{{output_length}}
{{output_style}}
```

## 🎭 Common Prompt Patterns

### 1. Role-Based Prompts
```
You are a {{role}} specializing in {{specialty}}.
Your task is to {{task}} for {{audience}}.
```

### 2. Few-Shot Examples
```
Here are examples of {{task}}:

Example 1:
Input: {{example1_input}}
Output: {{example1_output}}

Example 2:
Input: {{example2_input}}
Output: {{example2_output}}

Now, please handle:
Input: {{actual_input}}
Output:
```

### 3. Chain of Thought
```
Let's solve this step by step:

1. First, analyze {{input}}
2. Then, consider {{factors}}
3. Next, evaluate {{options}}
4. Finally, provide {{output}}
```

### 4. Constraint-Based
```
You must follow these rules:
- Rule 1: {{constraint1}}
- Rule 2: {{constraint2}}
- Rule 3: {{constraint3}}

Task: {{task}}
```

## 🔍 Advanced Features

### Conditional Logic
```
{{#if technical_audience}}
Use technical terminology and include implementation details.
{{else}}
Use simple language and focus on benefits.
{{/if}}
```

### Nested Variables
```
{{#each categories}}
Category: {{name}}
Description: {{description}}
{{#each items}}
- {{title}}: {{details}}
{{/each}}
{{/each}}
```

### Dynamic Content
```
{{#random_choice options}}
Today's focus: {{this}}
{{/random_choice}}
```

## 🧪 Testing Strategy

### Variable Coverage
Ensure your test cases cover:
- All variable combinations
- Edge cases (empty, very long, special characters)
- Different data types
- Boundary conditions

### Scenario Planning
Create test cases for:
- **Happy path**: Normal, expected usage
- **Edge cases**: Unusual but valid inputs
- **Error cases**: Invalid or problematic inputs
- **Stress tests**: Maximum complexity scenarios

## 📊 Performance Optimization

### Token Efficiency
```
# Instead of:
Please provide a very detailed, comprehensive, and thorough analysis...

# Use:
Provide a detailed analysis of {{topic}} covering:
- {{aspect1}}
- {{aspect2}}
- {{aspect3}}
```

### Response Time
- Keep prompts concise but complete
- Avoid unnecessary repetition
- Use clear, direct language

### Cost Management
- Monitor token usage patterns
- Optimize for shorter responses when appropriate
- Use caching for repeated content

## 🔒 Security Considerations

### Input Validation
```
# Validate inputs
{{#validate input pattern="^[a-zA-Z0-9\s]+$"}}
{{input}}
{{/validate}}
```

### Prompt Injection Prevention
```
# Wrap user content
User input: "{{user_input}}"
# Don't allow: {{user_input}} directly in instructions
```

### Content Safety
- Review all variable inputs
- Implement content filtering
- Monitor for inappropriate usage

## 📚 Examples by Use Case

### Customer Service
```
You are a {{company_name}} customer service representative.

Customer Issue: {{issue_description}}
Customer Tone: {{customer_tone}}
Previous Interactions: {{interaction_history}}

Provide a {{response_type}} response that:
- Acknowledges the issue
- Provides {{solution_type}}
- Maintains {{desired_tone}} tone
- Includes {{follow_up_action}}
```

### Code Generation
```
Generate {{language}} code for {{task}}.

Requirements:
- Input: {{input_type}}
- Output: {{output_type}}
- Constraints: {{constraints}}
- Style: {{coding_style}}

Include:
- Error handling
- Comments
- Unit tests (if {{include_tests}})
```

### Content Creation
```
Create {{content_type}} about {{topic}}.

Specifications:
- Length: {{word_count}} words
- Audience: {{target_audience}}
- Tone: {{tone}}
- Format: {{format}}
- Include: {{required_elements}}
```

## 🔄 Versioning and Management

### Version Control
- Save iterations of your prompts
- Track performance changes
- Maintain changelog

### Organization
- Use consistent naming conventions
- Group related prompts
- Tag by functionality or domain

### Collaboration
- Share prompts with team members
- Review and approve changes
- Document best practices

---

**Next Steps**: Learn about [Test Case Management](./test-cases.md) to effectively validate your prompt cards.