import { diffWords } from 'diff';
import { Clause, ClauseDiff, DiffSegment } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function parseClauses(rawContent: string): Clause[] {
  const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const clauses: Clause[] = [];
  let currentClause: Clause | null = null;
  let contentBuffer: string[] = [];

  const clauseNumberRegex = /^(\d+(?:\.\d+)*)[、.\s]+(.+)$/;

  for (const line of lines) {
    const match = line.match(clauseNumberRegex);
    if (match) {
      if (currentClause) {
        currentClause.content = contentBuffer.join('\n').trim();
        clauses.push(currentClause);
      }
      currentClause = {
        id: uuidv4(),
        number: match[1],
        title: match[2].trim(),
        content: ''
      };
      contentBuffer = [];
    } else if (currentClause) {
      contentBuffer.push(line);
    }
  }

  if (currentClause) {
    currentClause.content = contentBuffer.join('\n').trim();
    clauses.push(currentClause);
  }

  return clauses;
}

export function compareClauses(templateClauses: Clause[], actualClauses: Clause[]): ClauseDiff[] {
  const results: ClauseDiff[] = [];
  const templateMap = new Map(templateClauses.map(c => [c.number, c]));
  const actualMap = new Map(actualClauses.map(c => [c.number, c]));
  const allNumbers = new Set([...templateMap.keys(), ...actualMap.keys()]);

  const sortedNumbers = [...allNumbers].sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      if ((aParts[i] || 0) !== (bParts[i] || 0)) {
        return (aParts[i] || 0) - (bParts[i] || 0);
      }
    }
    return 0;
  });

  for (const number of sortedNumbers) {
    const templateClause = templateMap.get(number);
    const actualClause = actualMap.get(number);

    if (!templateClause) {
      results.push({
        clauseNumber: number,
        clauseTitle: actualClause?.title || '未知条款',
        templateContent: '',
        actualContent: actualClause?.content || '',
        diff: actualClause ? [{ value: actualClause.title + '\n' + actualClause.content, added: true }] : [],
        hasDiff: true,
        isNew: true,
        isMissing: false
      });
    } else if (!actualClause) {
      results.push({
        clauseNumber: number,
        clauseTitle: templateClause.title,
        templateContent: templateClause.content,
        actualContent: '',
        diff: [{ value: templateClause.title + '\n' + templateClause.content, removed: true }],
        hasDiff: true,
        isNew: false,
        isMissing: true
      });
    } else {
      const templateFull = templateClause.title + '\n' + templateClause.content;
      const actualFull = actualClause.title + '\n' + actualClause.content;
      const diffResult = diffWords(templateFull, actualFull);
      const hasDiff = diffResult.some(d => d.added || d.removed);

      results.push({
        clauseNumber: number,
        clauseTitle: actualClause.title,
        templateContent: templateClause.content,
        actualContent: actualClause.content,
        diff: diffResult as DiffSegment[],
        hasDiff,
        isNew: false,
        isMissing: false
      });
    }
  }

  return results;
}
