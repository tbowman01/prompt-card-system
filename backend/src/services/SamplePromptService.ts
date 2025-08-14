import { db } from '../database/connection';
import { PromptCard, CreatePromptCardRequest } from '../types/promptCard';

export interface SamplePrompt {
  title: string;
  description: string;
  prompt_template: string;
  variables: string[];
  category: string;
  tags: string[];
}

export class SamplePromptService {
  private static instance: SamplePromptService;
  private initialized = false;

  public static getInstance(): SamplePromptService {
    if (!SamplePromptService.instance) {
      SamplePromptService.instance = new SamplePromptService();
    }
    return SamplePromptService.instance;
  }

  /**
   * Get all predefined sample prompts
   */
  public getSamplePrompts(): SamplePrompt[] {
    return [
      {
        title: "Creative Story Generator",
        description: "Generate engaging creative stories based on specified genre, characters, and setting. Perfect for creative writing, content creation, and storytelling exercises.",
        prompt_template: `Write a {{genre}} story that takes place in {{setting}}. The main character is {{character_name}}, who is {{character_description}}. 

The story should:
- Be approximately {{word_count}} words long
- Include the theme of {{theme}}
- Have a clear beginning, middle, and end
- Be appropriate for {{target_audience}}

Style: {{writing_style}}

Create an engaging narrative that captures the reader's attention from the first sentence.`,
        variables: ["genre", "setting", "character_name", "character_description", "word_count", "theme", "target_audience", "writing_style"],
        category: "creative",
        tags: ["creative writing", "storytelling", "narrative", "fiction"]
      },
      {
        title: "Technical Documentation Assistant",
        description: "Create comprehensive technical documentation for software projects, APIs, and systems. Ideal for developers, technical writers, and project managers.",
        prompt_template: `Create technical documentation for {{project_name}}.

Project Type: {{project_type}}
Technology Stack: {{tech_stack}}
Target Audience: {{audience_level}}

Please include the following sections:

1. **Overview**
   - Brief description of {{project_name}}
   - Key features and capabilities
   - Use cases and benefits

2. **Getting Started**
   - Prerequisites and requirements
   - Installation instructions
   - Basic setup and configuration

3. **{{documentation_focus}}**
   - Detailed implementation guide
   - Code examples and best practices
   - Common patterns and conventions

4. **API Reference** (if applicable)
   - Endpoint documentation
   - Request/response examples
   - Error handling and status codes

5. **Troubleshooting**
   - Common issues and solutions
   - Debugging tips
   - FAQ section

Format: Use clear markdown formatting with code blocks, tables, and examples where appropriate.
Tone: {{tone}} and suitable for {{audience_level}} developers.`,
        variables: ["project_name", "project_type", "tech_stack", "audience_level", "documentation_focus", "tone"],
        category: "technical",
        tags: ["documentation", "technical writing", "API", "software", "development"]
      },
      {
        title: "Data Analysis Query Builder",
        description: "Generate comprehensive data analysis queries and insights for business intelligence, research, and decision-making processes.",
        prompt_template: `Perform a data analysis on {{dataset_name}} with the following specifications:

**Analysis Objective:** {{analysis_goal}}
**Data Source:** {{data_source}}
**Time Period:** {{time_period}}
**Key Metrics:** {{key_metrics}}

Please provide:

1. **Data Exploration**
   - Overview of the dataset structure
   - Key variables and their distributions
   - Data quality assessment and missing values

2. **Statistical Analysis**
   - Descriptive statistics for {{key_metrics}}
   - Correlation analysis between variables
   - Trend analysis over {{time_period}}

3. **Insights and Findings**
   - Key patterns and relationships discovered
   - Significant trends or anomalies
   - Business implications of findings

4. **Query Examples**
   - SQL/Python code for key calculations
   - Visualization recommendations
   - Data filtering and aggregation methods

5. **Recommendations**
   - Actionable insights based on analysis
   - Further analysis suggestions
   - Data collection improvements

Analysis Level: {{complexity_level}}
Output Format: {{output_format}}
Include visualizations: {{include_charts}}`,
        variables: ["dataset_name", "analysis_goal", "data_source", "time_period", "key_metrics", "complexity_level", "output_format", "include_charts"],
        category: "analytics",
        tags: ["data analysis", "business intelligence", "statistics", "SQL", "insights"]
      },
      {
        title: "Problem-Solving Framework",
        description: "Systematic approach to analyzing and solving complex problems using structured thinking methodologies. Great for consulting, project management, and strategic planning.",
        prompt_template: `Analyze and provide a solution framework for the following problem:

**Problem Statement:** {{problem_description}}
**Context:** {{problem_context}}
**Stakeholders:** {{stakeholders}}
**Constraints:** {{constraints}}
**Timeline:** {{timeline}}

Using the {{methodology}} approach, please provide:

1. **Problem Definition**
   - Root cause analysis
   - Problem scope and boundaries
   - Impact assessment on {{stakeholders}}

2. **Solution Framework**
   - Multiple solution alternatives
   - Pros and cons for each approach
   - Resource requirements and feasibility

3. **Implementation Plan**
   - Step-by-step action plan
   - Timeline and milestones
   - Risk assessment and mitigation strategies

4. **Success Metrics**
   - Key performance indicators
   - Measurement methods
   - Success criteria definition

5. **Recommendations**
   - Preferred solution with justification
   - Next steps and immediate actions
   - Long-term considerations

Analysis Depth: {{analysis_depth}}
Decision Framework: {{decision_criteria}}
Priority Level: {{priority_level}}`,
        variables: ["problem_description", "problem_context", "stakeholders", "constraints", "timeline", "methodology", "analysis_depth", "decision_criteria", "priority_level"],
        category: "problem-solving",
        tags: ["problem solving", "analysis", "strategy", "consulting", "framework"]
      },
      {
        title: "Code Generation Assistant",
        description: "Generate well-structured, documented code with best practices, error handling, and comprehensive testing. Perfect for rapid prototyping and development.",
        prompt_template: `Generate {{language}} code for the following requirements:

**Project:** {{project_name}}
**Functionality:** {{functionality_description}}
**Framework/Library:** {{framework}}
**Code Style:** {{coding_style}}

Requirements:
{{requirements}}

Please provide:

1. **Main Implementation**
   - Clean, well-structured code
   - Proper error handling and validation
   - Performance optimizations where applicable
   - Security best practices

2. **Documentation**
   - Comprehensive code comments
   - Function/method documentation
   - Usage examples
   - API documentation (if applicable)

3. **Testing**
   - Unit test cases
   - Integration test examples
   - Edge case handling
   - Mock data and fixtures

4. **Configuration**
   - Environment setup instructions
   - Dependencies and requirements
   - Configuration files (if needed)
   - Deployment considerations

Code Quality Standards:
- Follow {{coding_style}} conventions
- Include type hints/annotations (where applicable)
- Implement proper logging
- Handle edge cases and errors gracefully
- Optimize for {{performance_priority}}

Target Environment: {{target_environment}}
Complexity Level: {{complexity_level}}`,
        variables: ["language", "project_name", "functionality_description", "framework", "coding_style", "requirements", "performance_priority", "target_environment", "complexity_level"],
        category: "development",
        tags: ["code generation", "programming", "development", "testing", "best practices"]
      },
      {
        title: "Business Strategy Consultant",
        description: "Comprehensive business analysis and strategic planning assistant for market research, competitive analysis, and growth strategies.",
        prompt_template: `Provide a strategic business analysis for {{company_name}} in the {{industry}} industry.

**Company Profile:**
- Company: {{company_name}}
- Industry: {{industry}}
- Current Stage: {{business_stage}}
- Market Focus: {{target_market}}
- Key Challenge: {{primary_challenge}}

**Analysis Framework:**

1. **Market Analysis**
   - Industry overview and trends
   - Market size and growth potential
   - Key market drivers and barriers
   - Regulatory environment impact

2. **Competitive Landscape**
   - Direct and indirect competitors
   - Competitive advantages and gaps
   - Market positioning analysis
   - Pricing strategy comparison

3. **SWOT Analysis**
   - Internal strengths and capabilities
   - Areas for improvement
   - Market opportunities identification
   - Threat assessment and risk factors

4. **Strategic Recommendations**
   - Growth strategy options
   - Market entry/expansion strategies
   - Operational efficiency improvements
   - Innovation and differentiation opportunities

5. **Implementation Roadmap**
   - Priority initiatives and timeline
   - Resource allocation requirements
   - Key milestones and metrics
   - Risk mitigation strategies

**Specific Focus Areas:**
- {{focus_area_1}}
- {{focus_area_2}}
- {{focus_area_3}}

Analysis Depth: {{analysis_depth}}
Time Horizon: {{time_horizon}}
Budget Considerations: {{budget_range}}`,
        variables: ["company_name", "industry", "business_stage", "target_market", "primary_challenge", "focus_area_1", "focus_area_2", "focus_area_3", "analysis_depth", "time_horizon", "budget_range"],
        category: "business",
        tags: ["business strategy", "market analysis", "consulting", "competitive analysis", "growth planning"]
      },
      {
        title: "Educational Content Creator",
        description: "Generate comprehensive educational materials, lesson plans, and learning assessments for various subjects and skill levels.",
        prompt_template: `Create educational content for {{subject}} targeting {{grade_level}}.

**Learning Objective:** {{learning_objective}}
**Duration:** {{lesson_duration}}
**Learning Style:** {{learning_style_focus}}
**Assessment Type:** {{assessment_type}}

Please provide:

1. **Lesson Overview**
   - Clear learning objectives and outcomes
   - Prerequisites and prior knowledge required
   - Key concepts and vocabulary
   - Relevance to real-world applications

2. **Content Structure**
   - Introduction and hook ({{hook_type}})
   - Main content delivery methods
   - Interactive activities and examples
   - Practice exercises and demonstrations

3. **Teaching Materials**
   - Visual aids and multimedia suggestions
   - Handouts and worksheets
   - Technology integration ideas
   - Differentiation strategies for diverse learners

4. **Assessment Methods**
   - Formative assessment techniques
   - Summative evaluation criteria
   - Rubrics and scoring guides
   - Self-reflection prompts for students

5. **Extension Activities**
   - Homework assignments
   - Project-based learning opportunities
   - Cross-curricular connections
   - Advanced challenges for gifted learners

**Special Considerations:**
- Accommodations for {{special_needs}}
- Cultural sensitivity and inclusivity
- Technology requirements: {{tech_requirements}}
- Materials needed: {{materials_list}}

Teaching Approach: {{teaching_philosophy}}
Class Size: {{class_size}}`,
        variables: ["subject", "grade_level", "learning_objective", "lesson_duration", "learning_style_focus", "assessment_type", "hook_type", "special_needs", "tech_requirements", "materials_list", "teaching_philosophy", "class_size"],
        category: "education",
        tags: ["education", "lesson planning", "curriculum", "teaching", "assessment", "learning"]
      },
      {
        title: "Social Media Content Strategist",
        description: "Develop engaging social media content strategies, posts, and campaigns across multiple platforms with audience-specific messaging.",
        prompt_template: `Create a comprehensive social media strategy for {{brand_name}} in the {{industry}} sector.

**Brand Profile:**
- Brand: {{brand_name}}
- Industry: {{industry}}
- Target Audience: {{target_audience}}
- Brand Voice: {{brand_voice}}
- Key Message: {{key_message}}

**Campaign Details:**
- Campaign Goal: {{campaign_goal}}
- Duration: {{campaign_duration}}
- Budget Tier: {{budget_tier}}
- Primary Platforms: {{platforms}}

Please provide:

1. **Content Strategy**
   - Content pillars and themes
   - Posting frequency and optimal timing
   - Content mix ({{content_ratio}})
   - Seasonal considerations and trends

2. **Platform-Specific Content**
   - {{platform_1}}: {{platform_1_content_type}}
   - {{platform_2}}: {{platform_2_content_type}}  
   - {{platform_3}}: {{platform_3_content_type}}
   - Cross-platform content adaptation strategies

3. **Engagement Tactics**
   - Hashtag strategy and research
   - Community management approach
   - Influencer collaboration opportunities
   - User-generated content campaigns

4. **Content Calendar**
   - Weekly content themes
   - Special events and holidays
   - Product launches and announcements
   - Crisis management content backup

5. **Performance Metrics**
   - KPIs and success metrics
   - Monitoring and analytics tools
   - A/B testing recommendations
   - ROI measurement strategies

**Creative Elements:**
- Visual style guidelines
- Caption templates and tone examples
- Story and reel concepts
- Interactive content ideas (polls, Q&A, contests)

Campaign Type: {{campaign_type}}
Competitive Focus: {{competitor_analysis}}`,
        variables: ["brand_name", "industry", "target_audience", "brand_voice", "key_message", "campaign_goal", "campaign_duration", "budget_tier", "platforms", "content_ratio", "platform_1", "platform_1_content_type", "platform_2", "platform_2_content_type", "platform_3", "platform_3_content_type", "campaign_type", "competitor_analysis"],
        category: "marketing",
        tags: ["social media", "marketing", "content strategy", "brand management", "digital marketing", "engagement"]
      },
      {
        title: "Legal Document Analyst",
        description: "Analyze legal documents, contracts, and compliance requirements with clear explanations and risk assessments for business contexts.",
        prompt_template: `Provide legal analysis and guidance for {{document_type}} in {{jurisdiction}}.

**Document Context:**
- Document Type: {{document_type}}
- Jurisdiction: {{jurisdiction}}
- Parties Involved: {{parties}}
- Business Context: {{business_context}}
- Urgency Level: {{urgency_level}}

**Analysis Requirements:**

1. **Document Summary**
   - Key terms and provisions
   - Rights and obligations of each party
   - Critical dates and deadlines
   - Payment terms and conditions

2. **Legal Review**
   - Compliance with {{applicable_laws}}
   - Potential legal risks and liabilities
   - Missing clauses or protections
   - Enforceability concerns

3. **Business Impact Analysis**
   - Financial implications and exposure
   - Operational requirements and constraints
   - Strategic advantages and disadvantages
   - Long-term business relationship effects

4. **Risk Assessment**
   - High-risk clauses requiring attention
   - Mitigation strategies and alternatives
   - Negotiation recommendations
   - Red flags and deal breakers

5. **Recommendations**
   - Suggested amendments and additions
   - Alternative clause language
   - Negotiation strategy and priorities
   - Next steps and action items

**Special Considerations:**
- Industry-specific regulations: {{industry_regulations}}
- Cross-border implications: {{international_elements}}
- Intellectual property concerns: {{ip_considerations}}
- Dispute resolution mechanisms: {{dispute_resolution}}

**Disclaimer:** This analysis is for informational purposes only and does not constitute legal advice. Consult with qualified legal counsel for specific legal matters.

Analysis Depth: {{analysis_depth}}
Review Priority: {{priority_areas}}`,
        variables: ["document_type", "jurisdiction", "parties", "business_context", "urgency_level", "applicable_laws", "industry_regulations", "international_elements", "ip_considerations", "dispute_resolution", "analysis_depth", "priority_areas"],
        category: "legal",
        tags: ["legal analysis", "contracts", "compliance", "risk assessment", "business law", "documentation"]
      },
      {
        title: "Health & Wellness Coach",
        description: "Create personalized health and wellness plans, exercise routines, and nutrition guidance based on individual needs and goals.",
        prompt_template: `Design a comprehensive health and wellness plan for {{client_profile}}.

**Client Information:**
- Age Group: {{age_group}}
- Fitness Level: {{current_fitness_level}}
- Health Goals: {{primary_goals}}
- Available Time: {{time_commitment}}
- Equipment Access: {{equipment_available}}
- Health Considerations: {{health_restrictions}}

**Plan Components:**

1. **Fitness Program**
   - Workout schedule and frequency
   - Exercise types and progression plan
   - {{workout_focus}} specific routines
   - Recovery and rest day activities

2. **Nutrition Guidance**
   - Meal planning framework
   - Nutritional goals and targets
   - {{dietary_preferences}} compliant options
   - Hydration and supplement recommendations

3. **Lifestyle Integration**
   - Daily routine optimization
   - Stress management techniques
   - Sleep hygiene improvements
   - Work-life balance strategies

4. **Progress Tracking**
   - Measurable milestones and benchmarks
   - Monitoring tools and methods
   - Adjustment protocols
   - Motivation and accountability systems

5. **Educational Resources**
   - Key health and wellness concepts
   - Common misconceptions and myths
   - Evidence-based practice explanations
   - Additional learning materials

**Weekly Structure:**
- Monday: {{monday_focus}}
- Tuesday: {{tuesday_focus}}
- Wednesday: {{wednesday_focus}}
- Thursday: {{thursday_focus}}
- Friday: {{friday_focus}}
- Weekend: {{weekend_focus}}

**Important Note:** This plan is for educational purposes only. Consult healthcare professionals before starting any new fitness or nutrition program, especially if you have existing health conditions.

Plan Duration: {{plan_length}}
Modification Frequency: {{review_schedule}}`,
        variables: ["client_profile", "age_group", "current_fitness_level", "primary_goals", "time_commitment", "equipment_available", "health_restrictions", "workout_focus", "dietary_preferences", "monday_focus", "tuesday_focus", "wednesday_focus", "thursday_focus", "friday_focus", "weekend_focus", "plan_length", "review_schedule"],
        category: "health",
        tags: ["health", "wellness", "fitness", "nutrition", "lifestyle", "coaching", "personal development"]
      },
      {
        title: "Creative Project Manager",
        description: "Plan and manage creative projects from concept to completion, including timeline management, resource allocation, and stakeholder coordination.",
        prompt_template: `Create a comprehensive project management plan for {{project_name}} in the {{creative_field}} domain.

**Project Overview:**
- Project Name: {{project_name}}
- Creative Field: {{creative_field}}
- Project Type: {{project_type}}
- Client/Stakeholder: {{stakeholder}}
- Budget Range: {{budget_range}}
- Timeline: {{project_timeline}}

**Project Management Framework:**

1. **Project Scope & Objectives**
   - Creative vision and artistic goals
   - Deliverables and final outputs
   - Success criteria and quality standards
   - Scope boundaries and limitations

2. **Timeline & Milestones**
   - Pre-production phase: {{preproduction_duration}}
   - Production phase: {{production_duration}}
   - Post-production phase: {{postproduction_duration}}
   - Key milestones and approval gates

3. **Resource Planning**
   - Team roles and responsibilities
   - {{creative_roles}} requirements
   - Equipment and technology needs
   - External vendor and contractor management

4. **Creative Process Management**
   - Ideation and concept development workflow
   - Review and approval processes
   - Revision cycles and feedback integration
   - Quality assurance and testing protocols

5. **Risk Management**
   - Creative and technical risks
   - Resource availability concerns
   - Timeline and budget constraints
   - Stakeholder expectation management

6. **Communication Plan**
   - Stakeholder reporting schedule
   - Team collaboration protocols
   - Client presentation and feedback sessions
   - Crisis communication procedures

**Specific Considerations:**
- Creative brief and brand guidelines alignment
- Intellectual property and usage rights
- Technical specifications: {{technical_specs}}
- Platform requirements: {{delivery_platforms}}

**Tools & Methodology:**
- Project management software: {{pm_tools}}
- Creative collaboration platforms: {{creative_tools}}
- File management and version control
- Progress tracking and reporting methods

Project Complexity: {{complexity_level}}
Team Size: {{team_size}}`,
        variables: ["project_name", "creative_field", "project_type", "stakeholder", "budget_range", "project_timeline", "preproduction_duration", "production_duration", "postproduction_duration", "creative_roles", "technical_specs", "delivery_platforms", "pm_tools", "creative_tools", "complexity_level", "team_size"],
        category: "project-management",
        tags: ["project management", "creative projects", "planning", "coordination", "timeline management", "resource allocation"]
      }
    ];
  }

  /**
   * Initialize sample prompts in the database
   */
  public async initializeSamplePrompts(): Promise<{
    created: number;
    existing: number;
    errors: string[];
  }> {
    const result = { created: 0, existing: 0, errors: [] };
    
    try {
      const samplePrompts = this.getSamplePrompts();
      
      for (const sample of samplePrompts) {
        try {
          // Validate sample before insertion
          const validation = this.validateSamplePrompt(sample);
          if (!validation.isValid) {
            result.errors.push(`${sample.title}: ${validation.errors.join(', ')}`);
            continue;
          }

          // Check if prompt already exists
          const existing = db.prepare(`
            SELECT id FROM prompt_cards WHERE title = ?
          `).get(sample.title);

          if (!existing) {
            const insertResult = db.prepare(`
              INSERT INTO prompt_cards (title, description, prompt_template, variables)
              VALUES (?, ?, ?, ?)
            `).run(
              sample.title,
              sample.description,
              sample.prompt_template,
              JSON.stringify(sample.variables)
            );

            result.created++;
            console.log(`Created sample prompt: ${sample.title} (ID: ${insertResult.lastInsertRowid})`);
          } else {
            result.existing++;
          }
        } catch (sampleError) {
          const errorMsg = `Failed to process ${sample.title}: ${sampleError instanceof Error ? sampleError.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      this.initialized = result.errors.length === 0 || result.created > 0;
      console.log(`Sample prompts initialization completed: ${result.created} created, ${result.existing} existing, ${result.errors.length} errors`);
      
      return result;
    } catch (error) {
      const errorMsg = 'Failed to initialize sample prompts: ' + (error instanceof Error ? error.message : 'Unknown error');
      console.error(errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Get sample prompts by category
   */
  public getSamplePromptsByCategory(category: string): SamplePrompt[] {
    return this.getSamplePrompts().filter(prompt => prompt.category === category);
  }

  /**
   * Get all available categories
   */
  public getCategories(): string[] {
    const categories = this.getSamplePrompts().map(prompt => prompt.category);
    return [...new Set(categories)];
  }

  /**
   * Create a database prompt card from a sample prompt
   */
  public async createPromptFromSample(sampleTitle: string): Promise<PromptCard | null> {
    try {
      const sample = this.getSamplePrompts().find(p => p.title === sampleTitle);
      if (!sample) {
        throw new Error(`Sample prompt '${sampleTitle}' not found`);
      }

      // Check if already exists
      const existing = await db.prepare(`
        SELECT * FROM prompt_cards WHERE title = ?
      `).get(sample.title) as PromptCard;

      if (existing) {
        return {
          ...existing,
          variables: JSON.parse(existing.variables || '[]')
        };
      }

      // Create new prompt card
      const result = await db.prepare(`
        INSERT INTO prompt_cards (title, description, prompt_template, variables)
        VALUES (?, ?, ?, ?)
      `).run(
        sample.title,
        sample.description,
        sample.prompt_template,
        JSON.stringify(sample.variables)
      );

      const newCard = await db.prepare(`
        SELECT * FROM prompt_cards WHERE id = ?
      `).get(result.lastInsertRowid) as PromptCard;

      return {
        ...newCard,
        variables: JSON.parse(newCard.variables || '[]')
      };
    } catch (error) {
      console.error('Failed to create prompt from sample:', error);
      throw error;
    }
  }

  /**
   * Get sample prompt preview without creating in database
   */
  public getSamplePromptPreview(title: string): SamplePrompt | null {
    return this.getSamplePrompts().find(p => p.title === title) || null;
  }

  /**
   * Validate sample prompt template
   */
  public validateSamplePrompt(sample: SamplePrompt): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!sample.title?.trim()) {
      errors.push('Title is required');
    }

    if (!sample.prompt_template?.trim()) {
      errors.push('Prompt template is required');
    }

    if (!sample.description?.trim()) {
      errors.push('Description is required');
    }

    // Check variables are used in template
    if (sample.variables && sample.variables.length > 0) {
      const templateVariables = this.extractVariablesFromTemplate(sample.prompt_template);
      const unusedVariables = sample.variables.filter(v => !templateVariables.includes(v));
      const undeclaredVariables = templateVariables.filter(v => !sample.variables.includes(v));

      if (unusedVariables.length > 0) {
        errors.push(`Unused variables declared: ${unusedVariables.join(', ')}`);
      }

      if (undeclaredVariables.length > 0) {
        errors.push(`Variables used but not declared: ${undeclaredVariables.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract variables from template
   */
  private extractVariablesFromTemplate(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(match => match.replace(/\{\{|\}\}/g, '')))];
  }

  /**
   * Get sample prompt statistics
   */
  public getSamplePromptStats() {
    const samples = this.getSamplePrompts();
    const categories = this.getCategories();
    
    return {
      totalSamples: samples.length,
      categories: categories.length,
      categoriesBreakdown: categories.map(cat => ({
        category: cat,
        count: samples.filter(s => s.category === cat).length
      })),
      averageVariables: Math.round(samples.reduce((sum, s) => sum + s.variables.length, 0) / samples.length),
      totalVariables: samples.reduce((sum, s) => sum + s.variables.length, 0)
    };
  }

  /**
   * Search sample prompts by text (title, description, tags)
   */
  public searchSamplePrompts(query: string, options: {
    categories?: string[];
    maxResults?: number;
    fuzzyMatch?: boolean;
  } = {}): SamplePrompt[] {
    const { categories = [], maxResults = 50, fuzzyMatch = true } = options;
    const queryLower = query.toLowerCase().trim();
    
    if (!queryLower) {
      return this.getSamplePrompts().slice(0, maxResults);
    }

    let samples = this.getSamplePrompts();
    
    // Filter by categories if specified
    if (categories.length > 0) {
      samples = samples.filter(s => categories.includes(s.category));
    }

    // Search and score results
    const scored = samples.map(sample => {
      let score = 0;
      const titleLower = sample.title.toLowerCase();
      const descLower = sample.description.toLowerCase();
      const tagsLower = sample.tags.map(t => t.toLowerCase());

      // Exact matches get highest score
      if (titleLower === queryLower) score += 100;
      else if (titleLower.includes(queryLower)) score += 50;
      else if (fuzzyMatch && this.fuzzyMatch(titleLower, queryLower)) score += 30;

      if (descLower.includes(queryLower)) score += 25;
      else if (fuzzyMatch && this.fuzzyMatch(descLower, queryLower)) score += 15;

      // Tag matches
      tagsLower.forEach(tag => {
        if (tag === queryLower) score += 40;
        else if (tag.includes(queryLower)) score += 20;
        else if (fuzzyMatch && this.fuzzyMatch(tag, queryLower)) score += 10;
      });

      // Category match
      if (sample.category.toLowerCase().includes(queryLower)) score += 15;

      return { sample, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => item.sample);

    return scored;
  }

  /**
   * Simple fuzzy matching implementation
   */
  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length > text.length) return false;
    
    let queryIndex = 0;
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === query.length;
  }

  /**
   * Get sample prompts with pagination
   */
  public getSamplePromptsPaginated(options: {
    page?: number;
    limit?: number;
    category?: string;
    sortBy?: 'title' | 'category' | 'variables' | 'created';
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      sortBy = 'title', 
      sortOrder = 'asc' 
    } = options;

    const samples = category ? 
      this.getSamplePromptsByCategory(category) : 
      this.getSamplePrompts();

    // Sort samples
    samples.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'variables':
          aValue = a.variables.length;
          bValue = b.variables.length;
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSamples = samples.slice(startIndex, endIndex);

    return {
      samples: paginatedSamples,
      pagination: {
        page,
        limit,
        total: samples.length,
        totalPages: Math.ceil(samples.length / limit),
        hasNext: endIndex < samples.length,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Bulk create prompt cards from multiple samples
   */
  public async bulkCreatePromptsFromSamples(
    sampleTitles: string[],
    options: { skipExisting?: boolean } = {}
  ): Promise<{
    created: PromptCard[];
    skipped: string[];
    errors: string[];
  }> {
    const result = { created: [], skipped: [], errors: [] };
    const { skipExisting = true } = options;

    for (const title of sampleTitles) {
      try {
        const sample = this.getSamplePrompts().find(p => p.title === title);
        if (!sample) {
          result.errors.push(`Sample '${title}' not found`);
          continue;
        }

        // Check if already exists
        if (skipExisting) {
          const existing = db.prepare(`
            SELECT id FROM prompt_cards WHERE title = ?
          `).get(title);
          
          if (existing) {
            result.skipped.push(title);
            continue;
          }
        }

        const promptCard = await this.createPromptFromSample(title);
        if (promptCard) {
          result.created.push(promptCard);
        }
      } catch (error) {
        result.errors.push(`Failed to create '${title}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Export sample prompts in various formats
   */
  public exportSamplePrompts(format: 'json' | 'yaml' | 'csv', options: {
    category?: string;
    includeStats?: boolean;
  } = {}) {
    const { category, includeStats = false } = options;
    
    const samples = category ? 
      this.getSamplePromptsByCategory(category) : 
      this.getSamplePrompts();

    const exportData: any = { samples };
    
    if (includeStats) {
      exportData.stats = this.getSamplePromptStats();
      exportData.exportedAt = new Date().toISOString();
      exportData.filter = category ? { category } : 'all';
    }

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      
      case 'yaml':
        // Simple YAML export (would need yaml library for complex objects)
        const yamlLines: string[] = [];
        if (includeStats) {
          yamlLines.push('# Sample Prompts Export');
          yamlLines.push(`# Generated: ${new Date().toISOString()}`);
          yamlLines.push(`# Filter: ${category || 'all'}`);
          yamlLines.push('');
        }
        yamlLines.push('samples:');
        samples.forEach((sample, index) => {
          yamlLines.push(`  - title: "${sample.title}"`);
          yamlLines.push(`    category: "${sample.category}"`);
          yamlLines.push(`    description: "${sample.description.replace(/"/g, '\\"')}"`);
          yamlLines.push(`    variables: [${sample.variables.map(v => `"${v}"`).join(', ')}]`);
          yamlLines.push(`    tags: [${sample.tags.map(t => `"${t}"`).join(', ')}]`);
          if (index < samples.length - 1) yamlLines.push('');
        });
        return yamlLines.join('\n');
      
      case 'csv':
        const csvRows = ['Title,Category,Description,Variables,Tags,Template Length'];
        samples.forEach(sample => {
          csvRows.push([
            `"${sample.title.replace(/"/g, '""')}"`,
            `"${sample.category}"`,
            `"${sample.description.replace(/"/g, '""')}"`,
            `"${sample.variables.join(', ')}"`,
            `"${sample.tags.join(', ')}"`,
            sample.prompt_template.length.toString()
          ].join(','));
        });
        return csvRows.join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get template complexity analysis
   */
  public getTemplateComplexity(sample: SamplePrompt): {
    score: number;
    factors: {
      variableCount: number;
      templateLength: number;
      structuralElements: number;
      conditionalLogic: number;
    };
    level: 'simple' | 'moderate' | 'complex' | 'advanced';
  } {
    const factors = {
      variableCount: sample.variables.length,
      templateLength: sample.prompt_template.length,
      structuralElements: (sample.prompt_template.match(/#{1,6}|\*{1,2}|_{1,2}|\d+\.|•|→|├|└/g) || []).length,
      conditionalLogic: (sample.prompt_template.match(/\b(if|when|unless|should|must|may|can)\b/gi) || []).length
    };

    // Calculate complexity score
    let score = 0;
    score += Math.min(factors.variableCount * 5, 50); // Max 50 points for variables
    score += Math.min(factors.templateLength / 50, 30); // Max 30 points for length
    score += Math.min(factors.structuralElements * 2, 15); // Max 15 points for structure
    score += Math.min(factors.conditionalLogic * 3, 25); // Max 25 points for logic

    let level: 'simple' | 'moderate' | 'complex' | 'advanced';
    if (score < 30) level = 'simple';
    else if (score < 60) level = 'moderate';
    else if (score < 90) level = 'complex';
    else level = 'advanced';

    return { score: Math.round(score), factors, level };
  }

  /**
   * Validate all sample prompts and return report
   */
  public validateAllSamplePrompts(): {
    valid: number;
    invalid: number;
    issues: Array<{
      title: string;
      errors: string[];
      complexity: string;
    }>;
  } {
    const samples = this.getSamplePrompts();
    const report = { valid: 0, invalid: 0, issues: [] };

    samples.forEach(sample => {
      const validation = this.validateSamplePrompt(sample);
      const complexity = this.getTemplateComplexity(sample);
      
      if (validation.isValid) {
        report.valid++;
      } else {
        report.invalid++;
        report.issues.push({
          title: sample.title,
          errors: validation.errors,
          complexity: complexity.level
        });
      }
    });

    return report;
  }
}

export default SamplePromptService;