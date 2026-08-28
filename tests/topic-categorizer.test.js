import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  extractPromptMetadata,
  computeComplexityScore,
  classifyPrompt
} from '../shared/topic-categorizer.js';

describe('Topic & Semantic Categorizer Suite', () => {
  describe('extractPromptMetadata()', () => {
    it('handles empty and null inputs safely', () => {
      const metaEmpty = extractPromptMetadata('');
      expect(metaEmpty.charCount).toBe(0);
      expect(metaEmpty.wordCount).toBe(0);
      expect(metaEmpty.hasCode).toBe(false);
      expect(metaEmpty.hasMath).toBe(false);
      expect(metaEmpty.complexityScore).toBe(0);
      expect(metaEmpty.estimatedReasoningDepth).toBe('low');

      const metaNull = extractPromptMetadata(null);
      expect(metaNull.wordCount).toBe(0);
    });

    it('extracts word counts and token buckets correctly', () => {
      const shortText = 'Explain how gradient descent works.';
      const shortMeta = extractPromptMetadata(shortText);
      expect(shortMeta.wordCount).toBe(5);
      expect(shortMeta.tokenBucket).toBe('0-50');

      const mediumText = new Array(75).fill('word').join(' ');
      const medMeta = extractPromptMetadata(mediumText);
      expect(medMeta.wordCount).toBe(75);
      expect(medMeta.tokenBucket).toBe('50-100');

      const longText = new Array(300).fill('analysis').join(' ');
      const longMeta = extractPromptMetadata(longText);
      expect(longMeta.wordCount).toBe(300);
      expect(longMeta.tokenBucket).toBe('250-500');
    });

    it('identifies code presence and code blocks', () => {
      const codePrompt = 'Here is my function:\n```javascript\nfunction solve(n) {\n  return n * 2;\n}\n```\nPlease fix the bug.';
      const meta = extractPromptMetadata(codePrompt);
      expect(meta.hasCode).toBe(true);
      expect(meta.instructionCount).toBeGreaterThan(0);
    });

    it('identifies mathematical symbols and LaTeX expressions', () => {
      const mathPrompt = 'Calculate the integral \\int_{0}^{\\pi} \\sin(x) dx and find the eigenvalue.';
      const meta = extractPromptMetadata(mathPrompt);
      expect(meta.hasMath).toBe(true);
    });

    it('computes structural depth from paragraphs and bullet points', () => {
      const structuredPrompt = `# Overview\n\nFirst paragraph of detailed context.\n\nSecond paragraph.\n\n- Point 1\n- Point 2\n- Point 3`;
      const meta = extractPromptMetadata(structuredPrompt);
      expect(meta.hasMarkdown).toBe(true);
      expect(meta.structuralDepth).toBeGreaterThanOrEqual(3);
    });

    it('identifies constraint keywords and density', () => {
      const constraintPrompt = 'Write a summary. Limit response to under 100 words. Do not include markdown. JSON format only.';
      const meta = extractPromptMetadata(constraintPrompt);
      expect(meta.constraintCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('computeComplexityScore()', () => {
    it('normalizes scores between 0 and 100', () => {
      expect(computeComplexityScore()).toBe(0);
      expect(computeComplexityScore({ wordCount: 10 })).toBeLessThan(20);

      const highComplexity = computeComplexityScore({
        wordCount: 300,
        instructionCount: 5,
        questionCount: 3,
        structuralDepth: 8,
        hasCode: true,
        hasMath: true,
        constraintCount: 4
      });
      expect(highComplexity).toBeLessThanOrEqual(100);
      expect(highComplexity).toBeGreaterThanOrEqual(80);
    });
  });

  describe('classifyPrompt()', () => {
    it('classifies Code & Debugging prompts with high confidence', () => {
      const prompt = 'Can you review this python script and debug the IndexError in my async function?\n```python\ndef fetch():\n    return []\n```';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('code_debugging');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.metadata.hasCode).toBe(true);
    });

    it('classifies Writing & Editing prompts accurately', () => {
      const prompt = 'Please rewrite this paragraph to make it sound more professional, concise, and check my grammar.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('writing_editing');
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('classifies Research & Analysis prompts accurately', () => {
      const prompt = 'Please summarize the literature review on transformers, compare and contrast the pros and cons of sparse attention.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('research_analysis');
    });

    it('classifies Mathematics & Logic prompts accurately', () => {
      const prompt = 'Solve for x: 3x^2 + 5x - 8 = 0 and prove by induction for all n >= 1.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('math_logic');
    });

    it('classifies Career & Professional prompts accurately', () => {
      const prompt = 'Review my resume and cover letter for a Senior Software Engineer position and suggest behavioral interview prep answers.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('career_professional');
    });

    it('classifies Learning & Education prompts accurately', () => {
      const prompt = 'Explain how quantum computing works like I am 5 years old. Give me a step by step beginner guide and study guide flashcards.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('learning_education');
    });

    it('classifies Brainstorming & Creative prompts accurately', () => {
      const prompt = 'Brainstorm 10 innovative startup name suggestions and unique brand tagline ideas for a coffee roasting app.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('creative_brainstorming');
    });

    it('falls back gracefully to general_other on conversational chatter', () => {
      const prompt = 'Hello! Thank you very much, that was helpful.';
      const result = classifyPrompt(prompt);

      expect(result.category).toBe('general_other');
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });

    it('supports custom category taxonomies passed via options', () => {
      const customCategories = {
        devops: {
          id: 'devops',
          name: 'DevOps & SRE',
          keywords: ['terraform', 'ansible', 'ci/cd', 'helm', 'docker'],
          patterns: [/\b(deploy|infrastructure as code)\b/i],
          weight: 1.5
        },
        general: {
          id: 'general',
          name: 'General',
          keywords: ['hello'],
          patterns: [],
          weight: 0.5
        }
      };

      const prompt = 'Help me deploy my terraform script with docker and helm.';
      const result = classifyPrompt(prompt, { categories: customCategories });

      expect(result.category).toBe('devops');
    });

    it('detects secondary categories when prompt spans multiple domains', () => {
      const mixedPrompt = 'Write an essay comparing Python and Rust for machine learning, with code snippets demonstrating both.';
      const result = classifyPrompt(mixedPrompt);

      expect(['code_debugging', 'writing_editing', 'research_analysis']).toContain(result.category);
      expect(Array.isArray(result.secondaryCategories)).toBe(true);
    });
  });
});
