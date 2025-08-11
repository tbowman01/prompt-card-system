# Documentation Style Guide

## 📝 Overview

This style guide ensures consistency, accessibility, and maintainability across all documentation in the Prompt Card System project. All contributors must follow these guidelines when creating or updating documentation.

## 🎯 Content Principles

### 1. Clarity and Conciseness
- **Write for your audience**: Identify whether content is for beginners, intermediate users, or advanced developers
- **Use active voice**: "Configure the database" instead of "The database should be configured"
- **Be specific**: Provide exact steps, file paths, and command examples
- **Avoid jargon**: Define technical terms or link to the glossary

### 2. Structure and Organization
- **Use hierarchical headings**: Start with H1 (#) for document titles, then H2 (##), H3 (###), etc.
- **Logical flow**: Arrange content from general to specific
- **Consistent sections**: Use standardized sections across similar documents
- **Table of contents**: Include for documents longer than 1000 words

### 3. Accessibility Standards
- **Descriptive links**: Use meaningful link text instead of "click here"
- **Alt text for images**: Describe what the image shows
- **Color contrast**: Don't rely solely on color to convey information
- **Screen reader friendly**: Use semantic HTML and proper heading structure

## 📐 Formatting Standards

### Headings
```markdown
# H1: Document Title (Once per document)
## H2: Major Sections
### H3: Sub-sections
#### H4: Minor sections (avoid deeper nesting)
```

### Text Formatting
- **Bold**: For UI elements, important terms, and emphasis `**bold**`
- **Italic**: For emphasis and first-time term introduction `*italic*`
- **Code**: For inline code, file names, and commands `\`code\``
- **Strikethrough**: For deprecated features `~~deprecated~~`

### Lists
- **Ordered lists**: For sequential steps and procedures
- **Unordered lists**: For feature lists and options
- **Definition lists**: Not commonly used in Markdown

### Code Blocks
````markdown
```language
// Always specify the language for syntax highlighting
const example = "Hello World";
```
````

### Tables
```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |
```

### Links and Cross-references
- **Internal links**: Use relative paths `[Link Text](./relative/path.md)`
- **External links**: Use full URLs `[Link Text](https://example.com)`
- **Cross-references**: Link to related sections and documents
- **Anchor links**: Use for navigation within long documents `[Section](#section)`

## 🎨 Visual Elements

### Icons and Emojis
Use consistent emoji conventions:
- 📚 Documentation
- 🚀 Getting started/Launch
- ⚙️ Configuration/Settings
- 🔧 Tools/Development
- 🛡️ Security
- 📊 Analytics/Reports
- 🎯 Goals/Objectives
- ⚠️ Warnings
- ✅ Success/Completed
- ❌ Errors/Failed
- 🔄 Process/Workflow
- 💡 Tips/Ideas
- 📝 Notes/Examples

### Callout Boxes
Use consistent formatting for different message types:

```markdown
> 💡 **Tip**: Helpful suggestions and best practices

> ⚠️ **Warning**: Important cautions and potential issues

> ❌ **Error**: Common mistakes and how to avoid them

> 📝 **Note**: Additional information and context
```

### Code Examples
- **Complete examples**: Provide full, working code snippets
- **Syntax highlighting**: Always specify the language
- **Comments**: Explain complex logic within code
- **Real data**: Use realistic example data, not foo/bar

## 📂 File Structure and Naming

### File Naming Conventions
- Use kebab-case: `getting-started.md`
- Descriptive names: `api-authentication-guide.md`
- Consistent suffixes: `-guide.md`, `-reference.md`, `-tutorial.md`

### Directory Organization
```
docs/
├── README.md                    # Main documentation index
├── DOCUMENTATION_STYLE_GUIDE.md # This file
├── GLOSSARY.md                  # Terms and definitions
├── CHANGELOG.md                 # Version history
├── user-guide/                  # End-user documentation
├── developer/                   # Technical documentation
├── api/                         # API reference
├── deployment/                  # Deployment guides
├── troubleshooting/            # Support documentation
└── assets/                     # Images and media
    ├── images/
    └── diagrams/
```

## 🔤 Language and Tone

### Writing Style
- **Professional but approachable**: Friendly without being casual
- **Consistent terminology**: Use the same terms throughout all documentation
- **International audience**: Avoid idioms and cultural references
- **Gender-neutral language**: Use inclusive language

### Technical Writing
- **Step-by-step instructions**: Number sequential steps
- **Prerequisites**: List requirements before procedures
- **Expected outcomes**: Describe what should happen
- **Troubleshooting**: Include common issues and solutions

## 📋 Content Types and Templates

### User Guides
```markdown
# [Feature Name] Guide

## Overview
Brief description of the feature and its purpose.

## Prerequisites
- Requirement 1
- Requirement 2

## Step-by-Step Instructions
1. First step
2. Second step
3. Third step

## Examples
Practical examples and use cases.

## Troubleshooting
Common issues and solutions.

## Related Documentation
- [Link to related guide]
- [Link to API reference]
```

### API Documentation
```markdown
# API Endpoint Name

## Overview
Description of what this endpoint does.

## Endpoint
```http
POST /api/endpoint
```

## Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param1    | string | Yes | Description |

## Request Example
```json
{
  "example": "data"
}
```

## Response Example
```json
{
  "success": true,
  "data": {}
}
```

## Error Codes
| Code | Description |
|------|-------------|
| 400  | Bad Request |
```

### Troubleshooting Guides
```markdown
# Issue Name

## Problem Description
Clear description of the problem.

## Symptoms
- Symptom 1
- Symptom 2

## Causes
Possible causes of the issue.

## Solutions
1. Solution 1
2. Solution 2

## Prevention
How to prevent this issue in the future.
```

## 🔍 Quality Assurance

### Review Checklist
- [ ] Content is accurate and up-to-date
- [ ] All links work correctly
- [ ] Code examples execute successfully
- [ ] Screenshots are current
- [ ] Spelling and grammar are correct
- [ ] Formatting is consistent
- [ ] Accessibility guidelines are followed

### Maintenance Schedule
- **Weekly**: Review and update API documentation
- **Bi-weekly**: Check all internal and external links
- **Monthly**: Update screenshots and examples
- **Quarterly**: Comprehensive style guide compliance review

## 🔧 Tools and Automation

### Recommended Tools
- **Markdown editor**: Use tools with live preview
- **Spell checker**: Enable spell checking in your editor
- **Link checker**: Validate all links regularly
- **Image optimization**: Compress images for web

### Automated Checks
- Markdown linting
- Link validation
- Spell checking
- Style guide compliance

## 📊 Metrics and Analytics

### Documentation Quality Metrics
- **Completeness**: All features documented
- **Accuracy**: Information is correct and current
- **Usability**: Users can successfully complete tasks
- **Accessibility**: Meets WCAG guidelines
- **Maintenance**: Regular updates and reviews

### User Feedback Integration
- Monitor documentation usage analytics
- Collect user feedback through surveys
- Track support ticket patterns
- Regular user testing of documentation

## 🎯 Best Practices Summary

### Do's
✅ Write for your specific audience
✅ Use clear, descriptive headings
✅ Provide complete, working examples
✅ Include relevant cross-references
✅ Test all procedures and code examples
✅ Use consistent terminology
✅ Include accessibility features
✅ Update documentation with code changes

### Don'ts
❌ Use vague or ambiguous language
❌ Assume prior knowledge without stating prerequisites
❌ Include incomplete or broken examples
❌ Duplicate content across multiple documents
❌ Use inconsistent formatting
❌ Forget to update documentation when features change
❌ Ignore accessibility requirements
❌ Create orphaned documents without navigation

## 🔄 Version Control

### Documentation Versioning
- Tag documentation releases with semantic versioning
- Maintain changelog of documentation changes
- Archive obsolete documentation appropriately
- Ensure version consistency across all documents

### Change Management
- Document all changes in changelog
- Review changes for consistency with style guide
- Update cross-references when moving or renaming files
- Maintain backward compatibility where possible

---

*This style guide is a living document. It should be updated as the project evolves and new best practices are identified. All team members are responsible for maintaining documentation quality and consistency.*