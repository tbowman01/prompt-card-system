import { db } from '../database/connection';
import { TestCase } from '../types/testCase';

export interface SampleTestCase {
  name: string;
  input_variables: Record<string, any>;
  expected_output?: string;
  assertions: Array<{
    type: string;
    expected: any;
    description: string;
  }>;
  description: string;
}

export class SampleTestCaseService {
  private static instance: SampleTestCaseService;

  public static getInstance(): SampleTestCaseService {
    if (!SampleTestCaseService.instance) {
      SampleTestCaseService.instance = new SampleTestCaseService();
    }
    return SampleTestCaseService.instance;
  }

  /**
   * Get sample test cases for each prompt type
   */
  public getSampleTestCases(): Record<string, SampleTestCase[]> {
    return {
      "Creative Story Generator": [
        {
          name: "Science Fiction Adventure",
          description: "Test generation of a science fiction story with space setting",
          input_variables: {
            genre: "science fiction",
            setting: "a distant space station orbiting Jupiter",
            character_name: "Captain Maya Chen",
            character_description: "a seasoned space explorer with a cybernetic arm",
            word_count: "800",
            theme: "discovery and sacrifice",
            target_audience: "young adults",
            writing_style: "descriptive and suspenseful"
          },
          assertions: [
            {
              type: "contains",
              expected: "Captain Maya Chen",
              description: "Story should include the specified character name"
            },
            {
              type: "contains",
              expected: "Jupiter",
              description: "Story should reference the Jupiter setting"
            },
            {
              type: "word_count_range",
              expected: [700, 900],
              description: "Story should be approximately 800 words"
            },
            {
              type: "tone_analysis",
              expected: "suspenseful",
              description: "Story should maintain a suspenseful tone"
            }
          ]
        },
        {
          name: "Fantasy Quest",
          description: "Test generation of a fantasy story with magical elements",
          input_variables: {
            genre: "fantasy",
            setting: "an enchanted forest filled with ancient magic",
            character_name: "Elara Moonwhisper",
            character_description: "a young elf mage learning to control her powers",
            word_count: "600",
            theme: "courage and friendship",
            target_audience: "children",
            writing_style: "whimsical and magical"
          },
          assertions: [
            {
              type: "contains",
              expected: "Elara Moonwhisper",
              description: "Story should include the specified character name"
            },
            {
              type: "contains",
              expected: "magic",
              description: "Story should include magical elements"
            },
            {
              type: "reading_level",
              expected: "children",
              description: "Story should be appropriate for children"
            }
          ]
        }
      ],
      "Technical Documentation Assistant": [
        {
          name: "REST API Documentation",
          description: "Test documentation generation for a REST API project",
          input_variables: {
            project_name: "TaskFlow API",
            project_type: "REST API",
            tech_stack: "Node.js, Express.js, PostgreSQL, Redis",
            audience_level: "intermediate",
            documentation_focus: "API Endpoints and Authentication",
            tone: "professional and clear"
          },
          assertions: [
            {
              type: "contains",
              expected: "TaskFlow API",
              description: "Documentation should reference the project name"
            },
            {
              type: "contains",
              expected: "Prerequisites",
              description: "Should include prerequisites section"
            },
            {
              type: "contains",
              expected: "Installation",
              description: "Should include installation instructions"
            },
            {
              type: "structure_check",
              expected: ["Overview", "Getting Started", "API Reference", "Troubleshooting"],
              description: "Should include all required sections"
            }
          ]
        },
        {
          name: "Python Library Documentation",
          description: "Test documentation for a Python library",
          input_variables: {
            project_name: "DataViz Pro",
            project_type: "Python Library",
            tech_stack: "Python 3.9+, matplotlib, pandas, numpy",
            audience_level: "beginner",
            documentation_focus: "Data Visualization Functions",
            tone: "friendly and educational"
          },
          assertions: [
            {
              type: "contains",
              expected: "Python",
              description: "Should reference Python technology"
            },
            {
              type: "contains",
              expected: "matplotlib",
              description: "Should mention relevant dependencies"
            },
            {
              type: "tone_analysis",
              expected: "friendly",
              description: "Should maintain a friendly, educational tone"
            }
          ]
        }
      ],
      "Data Analysis Query Builder": [
        {
          name: "Sales Performance Analysis",
          description: "Test generation of sales data analysis queries",
          input_variables: {
            dataset_name: "Q4 Sales Performance Data",
            analysis_goal: "identify top-performing products and sales trends",
            data_source: "PostgreSQL sales database",
            time_period: "October 2024 - December 2024",
            key_metrics: "revenue, units sold, customer acquisition",
            complexity_level: "intermediate",
            output_format: "executive summary with charts",
            include_charts: "yes"
          },
          assertions: [
            {
              type: "contains",
              expected: "SELECT",
              description: "Should include SQL query examples"
            },
            {
              type: "contains",
              expected: "revenue",
              description: "Should analyze specified key metrics"
            },
            {
              type: "contains",
              expected: "October 2024",
              description: "Should reference the specified time period"
            },
            {
              type: "structure_check",
              expected: ["Data Exploration", "Statistical Analysis", "Insights and Findings"],
              description: "Should include required analysis sections"
            }
          ]
        },
        {
          name: "Customer Behavior Analysis",
          description: "Test customer behavior pattern analysis",
          input_variables: {
            dataset_name: "Customer Journey Analytics",
            analysis_goal: "understand customer purchase patterns and lifetime value",
            data_source: "MongoDB customer events collection",
            time_period: "January 2024 - December 2024",
            key_metrics: "conversion rate, average order value, customer lifetime value",
            complexity_level: "advanced",
            output_format: "detailed technical report",
            include_charts: "yes"
          },
          assertions: [
            {
              type: "contains",
              expected: "MongoDB",
              description: "Should reference the correct data source"
            },
            {
              type: "contains",
              expected: "conversion rate",
              description: "Should analyze conversion metrics"
            },
            {
              type: "complexity_check",
              expected: "advanced",
              description: "Should provide advanced-level analysis"
            }
          ]
        }
      ],
      "Problem-Solving Framework": [
        {
          name: "Software Performance Issue",
          description: "Test problem-solving approach for technical performance issues",
          input_variables: {
            problem_description: "Web application response times have increased by 300% over the past month",
            problem_context: "E-commerce platform serving 10,000+ daily users",
            stakeholders: "development team, operations team, business stakeholders",
            constraints: "limited budget, 2-week timeline, cannot take system offline",
            timeline: "2 weeks",
            methodology: "root cause analysis",
            analysis_depth: "comprehensive",
            decision_criteria: "impact, feasibility, cost",
            priority_level: "high"
          },
          assertions: [
            {
              type: "contains",
              expected: "root cause analysis",
              description: "Should use specified methodology"
            },
            {
              type: "contains",
              expected: "300%",
              description: "Should reference the specific performance issue"
            },
            {
              type: "structure_check",
              expected: ["Problem Definition", "Solution Framework", "Implementation Plan"],
              description: "Should include all framework sections"
            },
            {
              type: "timeline_check",
              expected: "2 weeks",
              description: "Should respect timeline constraints"
            }
          ]
        }
      ],
      "Code Generation Assistant": [
        {
          name: "Python REST API",
          description: "Test generation of Python REST API code",
          input_variables: {
            language: "Python",
            project_name: "User Management API",
            functionality_description: "CRUD operations for user accounts with authentication",
            framework: "FastAPI",
            coding_style: "PEP 8",
            requirements: "JWT authentication, password hashing, email validation, PostgreSQL database",
            performance_priority: "security and maintainability",
            target_environment: "Docker container",
            complexity_level: "intermediate"
          },
          assertions: [
            {
              type: "contains",
              expected: "FastAPI",
              description: "Should use specified framework"
            },
            {
              type: "contains",
              expected: "JWT",
              description: "Should implement JWT authentication"
            },
            {
              type: "contains",
              expected: "def",
              description: "Should contain Python function definitions"
            },
            {
              type: "security_check",
              expected: "password hashing",
              description: "Should implement secure password handling"
            }
          ]
        },
        {
          name: "React Component",
          description: "Test generation of React component with TypeScript",
          input_variables: {
            language: "TypeScript",
            project_name: "Task Dashboard",
            functionality_description: "Interactive task management component with drag-and-drop",
            framework: "React with TypeScript",
            coding_style: "Airbnb style guide",
            requirements: "drag-and-drop functionality, state management, responsive design, accessibility",
            performance_priority: "user experience and accessibility",
            target_environment: "modern browsers",
            complexity_level: "advanced"
          },
          assertions: [
            {
              type: "contains",
              expected: "React",
              description: "Should use React framework"
            },
            {
              type: "contains",
              expected: "interface",
              description: "Should include TypeScript interfaces"
            },
            {
              type: "contains",
              expected: "drag",
              description: "Should implement drag-and-drop functionality"
            },
            {
              type: "accessibility_check",
              expected: "aria-",
              description: "Should include accessibility attributes"
            }
          ]
        }
      ],
      "Business Strategy Consultant": [
        {
          name: "SaaS Market Entry",
          description: "Test business strategy analysis for SaaS market entry",
          input_variables: {
            company_name: "TechFlow Solutions",
            industry: "SaaS productivity tools",
            business_stage: "startup",
            target_market: "small to medium businesses",
            primary_challenge: "market differentiation in crowded space",
            focus_area_1: "competitive positioning",
            focus_area_2: "pricing strategy",
            focus_area_3: "customer acquisition",
            analysis_depth: "comprehensive",
            time_horizon: "18 months",
            budget_range: "$500K - $1M"
          },
          assertions: [
            {
              type: "contains",
              expected: "TechFlow Solutions",
              description: "Should reference the company name"
            },
            {
              type: "contains",
              expected: "SWOT",
              description: "Should include SWOT analysis"
            },
            {
              type: "contains",
              expected: "competitive positioning",
              description: "Should address specified focus areas"
            },
            {
              type: "structure_check",
              expected: ["Market Analysis", "Competitive Landscape", "SWOT Analysis", "Strategic Recommendations"],
              description: "Should include all required analysis sections"
            }
          ]
        }
      ]
    };
  }

  /**
   * Create test cases for a prompt card
   */
  public async createTestCasesForPrompt(promptCardId: number, promptTitle: string): Promise<TestCase[]> {
    try {
      const sampleTestCases = this.getSampleTestCases()[promptTitle];
      
      if (!sampleTestCases || sampleTestCases.length === 0) {
        console.log(`No sample test cases found for prompt: ${promptTitle}`);
        return [];
      }

      const createdTestCases: TestCase[] = [];

      for (const testCase of sampleTestCases) {
        // Check if test case already exists
        const existing = await db.prepare(`
          SELECT id FROM test_cases WHERE prompt_card_id = ? AND name = ?
        `).get(promptCardId, testCase.name);

        if (!existing) {
          const result = await db.prepare(`
            INSERT INTO test_cases (prompt_card_id, name, input_variables, expected_output, assertions)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            promptCardId,
            testCase.name,
            JSON.stringify(testCase.input_variables),
            testCase.expected_output || '',
            JSON.stringify(testCase.assertions)
          );

          const newTestCase = await db.prepare(`
            SELECT * FROM test_cases WHERE id = ?
          `).get(result.lastInsertRowid) as TestCase;

          createdTestCases.push({
            ...newTestCase,
            input_variables: JSON.parse(newTestCase.input_variables),
            assertions: JSON.parse(newTestCase.assertions || '[]')
          });

          console.log(`Created test case: ${testCase.name} for prompt: ${promptTitle}`);
        }
      }

      return createdTestCases;
    } catch (error) {
      console.error('Failed to create test cases for prompt:', error);
      throw error;
    }
  }

  /**
   * Get available test case templates by prompt title
   */
  public getTestCaseTemplatesForPrompt(promptTitle: string): SampleTestCase[] {
    return this.getSampleTestCases()[promptTitle] || [];
  }

  /**
   * Get all available prompt titles with test cases
   */
  public getPromptsWithTestCases(): string[] {
    return Object.keys(this.getSampleTestCases());
  }

  /**
   * Initialize test cases for all sample prompts in database
   */
  public async initializeAllTestCases(): Promise<void> {
    try {
      // Get all prompt cards that match sample prompt titles
      const promptCards = await db.prepare(`
        SELECT id, title FROM prompt_cards 
        WHERE title IN (${Object.keys(this.getSampleTestCases()).map(() => '?').join(',')})
      `).all(...Object.keys(this.getSampleTestCases()));

      for (const card of promptCards) {
        await this.createTestCasesForPrompt(card.id, card.title);
      }

      console.log(`Test case initialization completed for ${promptCards.length} prompt cards`);
    } catch (error) {
      console.error('Failed to initialize test cases:', error);
      throw error;
    }
  }

  /**
   * Validate test case structure
   */
  public validateTestCase(testCase: SampleTestCase): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!testCase.name?.trim()) {
      errors.push('Test case name is required');
    }

    if (!testCase.input_variables || Object.keys(testCase.input_variables).length === 0) {
      errors.push('Input variables are required');
    }

    if (!testCase.assertions || testCase.assertions.length === 0) {
      errors.push('At least one assertion is required');
    }

    // Validate assertions
    if (testCase.assertions) {
      testCase.assertions.forEach((assertion, index) => {
        if (!assertion.type) {
          errors.push(`Assertion ${index + 1}: type is required`);
        }
        if (assertion.expected === undefined || assertion.expected === null) {
          errors.push(`Assertion ${index + 1}: expected value is required`);
        }
        if (!assertion.description?.trim()) {
          errors.push(`Assertion ${index + 1}: description is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get test case statistics
   */
  public getTestCaseStats() {
    const testCases = this.getSampleTestCases();
    const promptTitles = Object.keys(testCases);
    const totalTestCases = promptTitles.reduce((sum, title) => sum + testCases[title].length, 0);
    const averageTestCasesPerPrompt = Math.round(totalTestCases / promptTitles.length);

    return {
      totalPrompts: promptTitles.length,
      totalTestCases,
      averageTestCasesPerPrompt,
      promptsBreakdown: promptTitles.map(title => ({
        prompt: title,
        testCaseCount: testCases[title].length
      }))
    };
  }
}

export default SampleTestCaseService;