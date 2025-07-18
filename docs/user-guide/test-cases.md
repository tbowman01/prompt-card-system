# Test Case Management

Learn how to create comprehensive test cases that validate your prompt cards effectively.

## 🧪 What are Test Cases?

Test cases define specific scenarios that validate your prompt cards work correctly. Each test case includes:
- **Input variables** with specific values
- **Expected outcomes** or validation criteria
- **Assertions** that check the LLM response
- **Metadata** like priority and test category

## 🎯 Creating Effective Test Cases

### Basic Test Case Structure
```
Name: "Professional Email Response"
Description: "Tests formal business email generation"
Input Variables:
  - recipient: "Mr. Johnson"
  - subject: "Project Update"
  - tone: "professional"
  - urgency: "normal"
Assertions:
  - Contains "Dear Mr. Johnson"
  - Contains "Best regards"
  - Does not contain casual language
```

### Test Case Categories

#### 1. **Happy Path Tests**
Normal, expected usage scenarios:
```
Test: "Standard Customer Inquiry"
Input:
  - customer_name: "Sarah"
  - issue_type: "billing"
  - priority: "medium"
Expected: Professional response with solution
```

#### 2. **Edge Cases**
Unusual but valid inputs:
```
Test: "Very Long Customer Name"
Input:
  - customer_name: "Dr. Maria-Isabella Rodriguez-Fernandez III"
  - issue_type: "technical"
Expected: Properly formatted response without truncation
```

#### 3. **Boundary Tests**
Test limits and constraints:
```
Test: "Maximum Word Count"
Input:
  - response_length: "500"
  - content_type: "summary"
Expected: Response between 450-500 words
```

#### 4. **Error Handling**
Invalid or problematic inputs:
```
Test: "Empty Required Field"
Input:
  - customer_name: ""
  - issue_type: "billing"
Expected: Error message or default handling
```

## 🔧 Assertion Types

### 1. **Contains Assertion**
Checks if output contains specific text:
```json
{
  "type": "contains",
  "value": "Thank you for your inquiry",
  "case_sensitive": false
}
```

### 2. **Equals Assertion**
Exact match comparison:
```json
{
  "type": "equals",
  "value": "Operation completed successfully",
  "case_sensitive": true
}
```

### 3. **Regex Assertion**
Pattern matching:
```json
{
  "type": "regex",
  "pattern": "^[A-Z][a-z]+ [A-Z][a-z]+$",
  "description": "Proper name format"
}
```

### 4. **Length Assertion**
Output length validation:
```json
{
  "type": "length",
  "min": 50,
  "max": 200,
  "description": "Response length between 50-200 characters"
}
```

### 5. **Semantic Similarity**
AI-powered similarity checking:
```json
{
  "type": "semantic-similarity",
  "target": "We apologize for the inconvenience",
  "threshold": 0.8,
  "description": "Apologetic tone detection"
}
```

### 6. **Custom Assertion**
JavaScript-based custom validation:
```json
{
  "type": "custom",
  "code": "return response.includes('JSON') && JSON.parse(response).status === 'success'",
  "description": "Valid JSON response with success status"
}
```

### 7. **JSON Schema Assertion**
Structured data validation:
```json
{
  "type": "json-schema",
  "schema": {
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "age": {"type": "number"}
    },
    "required": ["name", "age"]
  }
}
```

### 8. **Sentiment Analysis**
Emotional tone detection:
```json
{
  "type": "sentiment",
  "expected": "positive",
  "confidence": 0.7,
  "description": "Response should be positive in tone"
}
```

## 📊 Test Case Design Patterns

### 1. **Equivalence Partitioning**
Group similar inputs together:
```
Partition 1: Short names (1-10 chars)
Partition 2: Medium names (11-30 chars)
Partition 3: Long names (31+ chars)
```

### 2. **Boundary Value Analysis**
Test at boundaries:
```
Test: Word count limits
- 0 words (minimum)
- 1 word (just above minimum)
- 99 words (just below maximum)
- 100 words (maximum)
- 101 words (just above maximum)
```

### 3. **Decision Table Testing**
Test all combinations:
```
User Type | Priority | Expected Response Time
----------|----------|----------------------
Premium   | High     | < 1 hour
Premium   | Low      | < 24 hours
Standard  | High     | < 4 hours
Standard  | Low      | < 48 hours
```

### 4. **State-Based Testing**
Test different system states:
```
Test: User Authentication States
- Not logged in
- Logged in as regular user
- Logged in as admin
- Session expired
```

## 🎨 Advanced Test Techniques

### 1. **Data-Driven Testing**
Use external data sources:
```
Test: "Customer Names from CSV"
Data Source: customer_names.csv
Columns: first_name, last_name, title
Test each combination
```

### 2. **Parameterized Testing**
Test with multiple parameter sets:
```
@ParameterizedTest
@ValueSource(strings = {"urgent", "normal", "low"})
void testPriorityHandling(String priority) {
  // Test logic here
}
```

### 3. **Negative Testing**
Test what should NOT happen:
```
Test: "Inappropriate Content Filter"
Input: "Generate inappropriate content"
Expected: Refusal or filtered response
```

### 4. **Performance Testing**
Test response time and resource usage:
```
Test: "Large Document Processing"
Input: 10,000 word document
Expected: 
  - Response time < 30 seconds
  - Memory usage < 500MB
  - Proper pagination
```

## 🔄 Test Execution Strategies

### 1. **Single Test Execution**
Run one test at a time:
- Good for debugging
- Detailed output analysis
- Interactive testing

### 2. **Batch Execution**
Run multiple tests together:
- Faster overall execution
- Comprehensive validation
- Automated reporting

### 3. **Parallel Execution**
Run tests simultaneously:
- Maximum speed
- Resource-intensive
- Requires proper isolation

### 4. **Scheduled Testing**
Automated test runs:
- Continuous validation
- Regression testing
- Performance monitoring

## 📈 Test Result Analysis

### Understanding Results
```
✅ PASSED: All assertions succeeded
❌ FAILED: One or more assertions failed
⚠️ PARTIAL: Some assertions passed
⏸️ SKIPPED: Test was not executed
🔄 RUNNING: Test in progress
```

### Performance Metrics
- **Response Time**: LLM processing time
- **Token Usage**: Input/output token count
- **Cost**: Calculated request cost
- **Accuracy**: Assertion success rate

### Debugging Failed Tests
1. **Review Raw Output**: Check actual LLM response
2. **Analyze Assertions**: Identify which assertions failed
3. **Check Input Data**: Verify test case parameters
4. **Compare Expected vs Actual**: Understand differences

## 🔧 Test Maintenance

### 1. **Regular Review**
- Update test cases for new features
- Remove obsolete tests
- Add tests for discovered issues

### 2. **Version Control**
- Track test case changes
- Link to prompt card versions
- Maintain test history

### 3. **Documentation**
- Document test purpose and scope
- Explain complex assertions
- Provide troubleshooting notes

## 📚 Best Practices

### 1. **Test Coverage**
- Cover all prompt variables
- Test different input combinations
- Include edge cases and errors

### 2. **Assertion Quality**
- Use multiple assertion types
- Make assertions specific
- Include meaningful descriptions

### 3. **Test Organization**
- Group related tests
- Use descriptive names
- Maintain consistent structure

### 4. **Performance Considerations**
- Balance thoroughness with speed
- Use caching for repeated tests
- Optimize assertion complexity

## 🎯 Real-World Examples

### E-commerce Customer Service
```
Test: "Order Status Inquiry"
Input:
  - customer_name: "John Smith"
  - order_id: "ORD-123456"
  - inquiry_type: "status"
Assertions:
  - Contains order ID
  - Professional tone (sentiment: positive)
  - Includes next steps
  - Response length: 50-150 words
```

### Code Generation
```
Test: "Python Function Generation"
Input:
  - function_name: "calculate_average"
  - parameters: ["numbers"]
  - return_type: "float"
Assertions:
  - Valid Python syntax
  - Includes docstring
  - Handles edge cases
  - Contains error handling
```

### Content Creation
```
Test: "Blog Post Introduction"
Input:
  - topic: "Sustainable Energy"
  - audience: "general public"
  - tone: "informative"
  - length: "100 words"
Assertions:
  - Word count: 90-110
  - Engaging opening
  - Clear topic introduction
  - Appropriate reading level
```

---

**Next Steps**: Learn about [Running Tests](./running-tests.md) to execute your test cases effectively.