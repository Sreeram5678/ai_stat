/**
 * AIStat - Local Topic & Semantic Categorization Engine
 * 100% Deterministic, Local-First, Zero-Cloud Heuristic Classifier.
 * Extracts prompt structural metadata and scores topics without persisting raw prompt content.
 */

export const CATEGORIES = {
  code_debugging: {
    id: 'code_debugging',
    name: 'Code / Debugging',
    description: 'Software development, bug fixing, script writing, algorithms, and code review',
    color: '#10b981', // Emerald
    keywords: [
      'code', 'function', 'class', 'const', 'let', 'var', 'def', 'import', 'export',
      'return', 'async', 'await', 'promise', 'bug', 'error', 'exception', 'stack trace',
      'syntax', 'compile', 'runtime', 'debug', 'refactor', 'git', 'commit', 'repo',
      'api', 'endpoint', 'json', 'typescript', 'javascript', 'python', 'rust', 'golang',
      'java', 'c++', 'html', 'css', 'sql', 'database', 'query', 'orm', 'regex',
      'unit test', 'mock', 'docker', 'kubernetes', 'npm', 'package', 'build', 'webpack',
      'vite', 'react', 'vue', 'angular', 'svelte', 'backend', 'frontend', 'terminal', 'shell'
    ],
    patterns: [
      /```[\s\S]*?```/,                     // Code blocks
      /`[^`]+`/,                            // Inline code
      /\b(def|function|class|const|let|var|import|export|return)\b/,
      /\b(console\.log|print\(|System\.out|std::cout)\b/,
      /\b(stack trace|uncaught exception|typeerror|referenceerror|nullpointerexception)\b/i,
      /\b(git (push|pull|commit|merge|rebase|checkout))\b/i,
      /[{}()[\];=><!+\-*/%&|^~]{3,}/        // Dense code operators
    ],
    weight: 1.2
  },

  writing_editing: {
    id: 'writing_editing',
    name: 'Writing / Editing',
    description: 'Prose writing, proofreading, essay drafting, copywriting, and stylistic editing',
    color: '#f59e0b', // Amber
    keywords: [
      'write', 'essay', 'paragraph', 'article', 'blog', 'rewrite', 'proofread', 'grammar',
      'tone', 'style', 'draft', 'headline', 'intro', 'conclusion', 'prose', 'sentence',
      'vocabulary', 'paraphrase', 'clarity', 'copywriting', 'story', 'narrative', 'dialogue',
      'synonym', 'spelling', 'rephrase', 'structure this paragraph', 'tone of voice', 'polite email'
    ],
    patterns: [
      /\b(rewrite|proofread|paraphrase|rephrase|check (my )?(grammar|spelling|tone))\b/i,
      /\b(write (an?|the) (essay|article|story|narrative|blog post|email|letter|poem))\b/i,
      /\b(make (it|this) (sound|more) (professional|concise|formal|casual|persuasive|engaging))\b/i,
      /\b(improve (the )?(flow|clarity|readability|tone))\b/i
    ],
    weight: 1.0
  },

  research_analysis: {
    id: 'research_analysis',
    name: 'Research / Analysis',
    description: 'Information synthesis, paper summaries, market research, comparison, and literature analysis',
    color: '#6366f1', // Indigo
    keywords: [
      'research', 'analyze', 'analysis', 'compare', 'contrast', 'synthesize', 'summary',
      'summarize', 'overview', 'literature', 'study', 'findings', 'pros and cons',
      'market', 'trend', 'statistics', 'evaluation', 'benchmark', 'breakdown', 'sources',
      'evidence', 'methodology', 'framework', 'survey', 'landscape', 'competitor'
    ],
    patterns: [
      /\b(summarize|summarise|give (me )?an? overview|key takeaways|break down)\b/i,
      /\b(compare and contrast|what are the (differences|pros and cons|tradeoffs))\b/i,
      /\b(state of the art|literature review|academic paper|research findings)\b/i,
      /\b(market analysis|competitive landscape|industry trends)\b/i
    ],
    weight: 1.0
  },

  math_logic: {
    id: 'math_logic',
    name: 'Mathematics / Logic',
    description: 'Mathematical equations, statistics, calculus, algebra, discrete logic, and proof verification',
    color: '#ec4899', // Pink
    keywords: [
      'math', 'mathematics', 'calculate', 'equation', 'formula', 'integral', 'derivative',
      'calculus', 'algebra', 'matrix', 'vector', 'probability', 'statistics', 'theorem',
      'proof', 'lemma', 'axiom', 'geometry', 'arithmetic', 'polynomial', 'eigenvalue',
      'hypothesis test', 'p-value', 'standard deviation', 'variance', 'logic puzzle', 'boolean'
    ],
    patterns: [
      /\b(solve (for|the equation|the integral|this math))\b/i,
      /\b(calculate|compute|differentiate|integrate|derive)\b/i,
      /\b(prove that|proof by induction|truth table|boolean logic)\b/i,
      /[∑∫∏√πθλ∞≈≠≤≥±∂∇]/,                   // Math Unicode symbols
      /\\\([^\\]+\\\)|\\\[[^\\]+\\\]/,       // LaTeX equations
      /\b[a-z]\s*=\s*[-+]?[0-9]*\.?[0-9]+\s*([+\-*/^]\s*[-+]?[0-9]*\.?[0-9]+)+/i
    ],
    weight: 1.15
  },

  creative_brainstorming: {
    id: 'creative_brainstorming',
    name: 'Brainstorming / Creative',
    description: 'Idea generation, naming, concept design, fictional worldbuilding, and creative problem-solving',
    color: '#8b5cf6', // Violet
    keywords: [
      'brainstorm', 'ideas', 'creative', 'concept', 'name suggestions', 'brand name',
      'tagline', 'slogan', 'worldbuilding', 'character', 'plot', 'inspiration',
      'innovative', 'novel', 'unconventional', 'metaphor', 'analogy', 'design prompt',
      'theme', 'game mechanics', 'art direction', 'mood board', 'ideate'
    ],
    patterns: [
      /\b(brainstorm|give me (\d+|some) (ideas|concepts|names|suggestions|options))\b/i,
      /\b(come up with|think of|creative ideas for|novel approaches to)\b/i,
      /\b(name (my|a) (startup|project|app|product|character|brand|podcast))\b/i,
      /\b(imagine a scenario|what if|world building|plot hook)\b/i
    ],
    weight: 1.0
  },

  career_professional: {
    id: 'career_professional',
    name: 'Career / Professional',
    description: 'Resume review, job applications, interview prep, management communication, and business planning',
    color: '#0ea5e9', // Sky blue
    keywords: [
      'resume', 'cv', 'cover letter', 'interview', 'job application', 'linkedin',
      'promotion', 'salary', 'negotiation', 'performance review', 'manager', 'executive',
      'stakeholder', 'presentation', 'pitch deck', 'proposal', 'business plan', 'okr',
      'kpi', 'roadmap', 'meeting agenda', '1-on-1', 'client email', 'workplace'
    ],
    patterns: [
      /\b(resume|curriculum vitae|cover letter|job description|interview prep)\b/i,
      /\b(prepare for an interview|mock interview|behavioral questions)\b/i,
      /\b(review my (resume|cv|cover letter|linkedin profile))\b/i,
      /\b(write (an email|a message) to (my )?(manager|boss|client|recruiter|team))\b/i,
      /\b(pitch deck|business proposal|executive summary|quarterly business review)\b/i
    ],
    weight: 1.05
  },

  learning_education: {
    id: 'learning_education',
    name: 'Learning / Education',
    description: 'Tutoring, explaining complex concepts, study guides, flashcards, and language acquisition',
    color: '#06b6d4', // Cyan
    keywords: [
      'explain', 'teach', 'learn', 'understand', 'concept', 'tutorial', 'guide',
      'beginner', 'step by step', 'how does it work', 'eli5', 'analogy', 'study guide',
      'flashcards', 'quiz', 'course', 'curriculum', 'lesson', 'translation', 'vocabulary practice',
      'grammar rules', 'language learning', 'student', 'homework'
    ],
    patterns: [
      /\b(explain (to me )?(like I'?m 5|simply|in simple terms|how|why|what))\b/i,
      /\b(how does [a-z0-9 _-]+ work\??)/i,
      /\b(teach me|guide to learning|beginner'?s guide to|what is the difference between)\b/i,
      /\b(create (a )?(study guide|quiz|test questions|flashcards))\b/i,
      /\b(translate (this|the following) (to|into|from))\b/i
    ],
    weight: 0.95
  },

  general_other: {
    id: 'general_other',
    name: 'General / Other',
    description: 'General questions, conversational chatter, formatting, and miscellaneous requests',
    color: '#64748b', // Slate
    keywords: [
      'hello', 'hi', 'help', 'question', 'thanks', 'thank you', 'ok', 'yes', 'no',
      'what', 'why', 'who', 'where', 'when', 'how', 'list', 'format', 'convert', 'table'
    ],
    patterns: [],
    weight: 0.5
  }
};

/**
 * Normalizes input text for analysis by removing extra whitespace and lowercasing.
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().toLowerCase();
}

/**
 * Extracts privacy-safe structural metadata from prompt text.
 * NEVER stores the raw prompt text itself.
 *
 * @param {string} text Raw prompt text
 * @returns {object} Derived structural metrics
 */
export function extractPromptMetadata(text = '') {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      charCount: 0,
      wordCount: 0,
      tokenBucket: '0-50',
      questionCount: 0,
      hasQuestion: false,
      instructionCount: 0,
      instructionDensity: 0,
      hasCode: false,
      hasMarkdown: false,
      hasUrl: false,
      hasMath: false,
      structuralDepth: 0,
      constraintCount: 0,
      complexityScore: 0,
      estimatedReasoningDepth: 'low'
    };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const charCount = raw.length;
  const words = raw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Approximate token length bucket
  let tokenBucket = '0-50';
  if (wordCount > 500) tokenBucket = '500+';
  else if (wordCount > 250) tokenBucket = '250-500';
  else if (wordCount > 100) tokenBucket = '100-250';
  else if (wordCount > 50) tokenBucket = '50-100';

  // Question indicators
  const questionMatches = raw.match(/\?/g) || [];
  const questionWords = (lower.match(/\b(what|why|how|when|where|who|which|can you|could you|is it|are there)\b/g) || []).length;
  const questionCount = Math.max(questionMatches.length, questionWords > 0 ? 1 : 0);
  const hasQuestion = questionCount > 0;

  // Instruction and directive count
  const instructionMatches = lower.match(/\b(please|ensure|must|should|do not|never|always|make sure|create|generate|write|build|implement|design|fix|convert|translate|summarize|calculate)\b/g) || [];
  const instructionCount = instructionMatches.length;
  const instructionDensity = wordCount > 0 ? Number((instructionCount / wordCount).toFixed(3)) : 0;

  // Code presence
  const hasCodeBlock = /```[\s\S]*?```/.test(raw);
  const hasInlineCode = /`[^`]+`/.test(raw);
  const hasCodeKeywords = /\b(function|const|let|var|class|import|export|def|return|async|await)\b/.test(raw);
  const hasCode = hasCodeBlock || (hasInlineCode && hasCodeKeywords) || (raw.includes('{') && raw.includes('}') && raw.includes(';'));

  // Markdown presence
  const hasMarkdown = /(^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|```|`[^`]+`|\*\*[^*]+\*\*|\[.+\]\(.+\))/m.test(raw);

  // URL presence
  const hasUrl = /https?:\/\/[^\s]+|www\.[^\s]+/i.test(raw);

  // Mathematical notation presence
  const hasMath = /[∑∫∏√πθλ∞≈≠≤≥±∂∇]/.test(raw) || /\\\([^\\]+\\\)|\\\[[^\\]+\\\]/.test(raw) || /\b(integral|derivative|matrix|eigenvalue|polynomial|calculus|equation)\b/i.test(lower);

  // Structural depth (bullet points, numbered lists, multi-paragraphs)
  const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const listItems = raw.match(/^\s*([-*+]|\d+\.)\s+/gm) || [];
  const structuralDepth = Math.min(10, (paragraphs.length - 1) * 2 + listItems.length);

  // Constraint density (length limits, negative constraints, style constraints)
  const constraints = lower.match(/\b(limit|maximum|minimum|under \d+|less than|no more than|do not include|exclude|strict|without|only in|in the style of|json format)\b/g) || [];
  const constraintCount = constraints.length;

  // Heuristic Complexity Score (0 - 100 normalized)
  const complexityScore = computeComplexityScore({
    wordCount,
    instructionCount,
    questionCount,
    structuralDepth,
    hasCode,
    hasMath,
    constraintCount
  });

  // Estimated reasoning depth
  let estimatedReasoningDepth = 'low';
  if (complexityScore >= 70 || hasMath || (hasCode && wordCount > 150)) {
    estimatedReasoningDepth = 'high';
  } else if (complexityScore >= 35 || wordCount > 60 || instructionCount >= 3) {
    estimatedReasoningDepth = 'medium';
  }

  return {
    charCount,
    wordCount,
    tokenBucket,
    questionCount,
    hasQuestion,
    instructionCount,
    instructionDensity,
    hasCode,
    hasMarkdown,
    hasUrl,
    hasMath,
    structuralDepth,
    constraintCount,
    complexityScore,
    estimatedReasoningDepth
  };
}

/**
 * Computes a normalized prompt complexity score between 0 and 100.
 *
 * Formula:
 * - Word length component: up to 30 pts (normalized at 200 words)
 * - Instruction & constraints: up to 25 pts (5 pts per instruction/constraint, max 5)
 * - Structural depth: up to 15 pts (paragraphs & lists)
 * - Code presence: 15 pts
 * - Math/Logic presence: 15 pts
 * - Question presence: up to 5 pts
 *
 * @param {object} factors Structural indicators
 * @returns {number} Integer between 0 and 100
 */
export function computeComplexityScore({
  wordCount = 0,
  instructionCount = 0,
  questionCount = 0,
  structuralDepth = 0,
  hasCode = false,
  hasMath = false,
  constraintCount = 0
} = {}) {
  const lengthScore = Math.min(30, (wordCount / 200) * 30);
  const directiveScore = Math.min(25, (instructionCount + constraintCount) * 5);
  const structScore = Math.min(15, structuralDepth * 3);
  const codeScore = hasCode ? 15 : 0;
  const mathScore = hasMath ? 15 : 0;
  const questionScore = Math.min(5, questionCount * 2.5);

  const rawScore = lengthScore + directiveScore + structScore + codeScore + mathScore + questionScore;
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Deterministic local prompt classifier.
 * Scores categories using keyword matches, regular expressions, and structural weights.
 *
 * @param {string|object} input Prompt text string or pre-extracted metadata object with text property
 * @param {object} [options] Custom category overrides or threshold adjustments
 * @returns {object} { category, confidence, secondaryCategories, signals, complexity, metadata }
 */
export function classifyPrompt(input, options = {}) {
  let text = '';
  let metadata = null;

  if (typeof input === 'string') {
    text = input;
    metadata = extractPromptMetadata(text);
  } else if (input && typeof input === 'object') {
    text = input.text || input.prompt || '';
    metadata = input.metadata || extractPromptMetadata(text);
  }

  const cleanText = normalizeText(text);
  const categoriesConfig = options.categories || CATEGORIES;

  if (!cleanText || cleanText.length === 0) {
    return {
      category: 'general_other',
      confidence: 0,
      secondaryCategories: [],
      signals: ['empty_input'],
      complexity: 0,
      metadata: metadata || extractPromptMetadata('')
    };
  }

  const scores = {};
  const signalMap = {};

  Object.entries(categoriesConfig).forEach(([catId, cat]) => {
    let score = 0;
    const signals = [];

    // 1. Regex Pattern Matching (High precision, +3.0 per match)
    if (Array.isArray(cat.patterns)) {
      cat.patterns.forEach(pattern => {
        if (pattern.test(text) || pattern.test(cleanText)) {
          score += 3.0;
          signals.push(`pattern:${pattern.source.slice(0, 20)}`);
        }
      });
    }

    // 2. Keyword Matching (+1.0 per exact word / phrase match)
    if (Array.isArray(cat.keywords)) {
      cat.keywords.forEach(kw => {
        const lowerKw = kw.toLowerCase();
        if (lowerKw.includes(' ')) {
          if (cleanText.includes(lowerKw)) {
            score += 1.5;
            signals.push(`phrase:${kw}`);
          }
        } else {
          // Word boundary match
          const regex = new RegExp(`\\b${escapeRegExp(lowerKw)}\\b`, 'i');
          if (regex.test(cleanText)) {
            score += 1.0;
            signals.push(`kw:${kw}`);
          }
        }
      });
    }

    // 3. Structural Bonus based on extracted metadata
    if (catId === 'code_debugging' && metadata.hasCode) {
      score += 4.0;
      signals.push('signal:has_code');
    }
    if (catId === 'math_logic' && metadata.hasMath) {
      score += 4.0;
      signals.push('signal:has_math');
    }

    // Apply category weight multiplier
    const weightedScore = score * (cat.weight || 1.0);
    scores[catId] = weightedScore;
    signalMap[catId] = signals;
  });

  // Sort categories by score descending
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  const topCategory = sorted[0];
  const topCatId = topCategory ? topCategory[0] : 'general_other';
  const topScore = topCategory ? topCategory[1] : 0;

  // Calculate total score for normalization
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Confidence calculation (0.0 to 1.0)
  if (topScore === 0) {
    // Default fallback to general_other
    return {
      category: 'general_other',
      confidence: 0.1,
      secondaryCategories: [],
      signals: ['fallback:no_keywords'],
      complexity: metadata.complexityScore,
      metadata
    };
  }

  // Margin of victory vs runner up
  const runnerUpScore = sorted[1] ? sorted[1][1] : 0;
  const margin = topScore - runnerUpScore;
  let confidence = Number(Math.min(0.99, Math.max(0.2, (topScore / (totalScore || 1)) * 0.6 + (margin / (topScore || 1)) * 0.4)).toFixed(2));

  if (topCatId === 'general_other') {
    confidence = Math.min(0.5, confidence);
  }

  // Secondary categories (score >= 35% of top score)
  const secondaryCategories = sorted
    .slice(1)
    .filter(([_, score]) => score > 0 && score >= topScore * 0.35)
    .map(([catId, score]) => ({
      category: catId,
      score: Number(score.toFixed(2)),
      confidence: Number((score / (totalScore || 1)).toFixed(2))
    }));

  return {
    category: topCatId,
    confidence,
    secondaryCategories,
    signals: signalMap[topCatId] || [],
    complexity: metadata.complexityScore,
    metadata
  };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  CATEGORIES,
  extractPromptMetadata,
  computeComplexityScore,
  classifyPrompt
};
