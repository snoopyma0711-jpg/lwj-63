import { ClauseDiff, Comment, RiskScoreDetail, RiskScoreLevel } from '../types';

const SCORE_RULES = {
  MODIFIED_CLAUSE: 5,
  MISSING_CLAUSE: 15,
  NEW_CLAUSE: 10,
  HIGH_RISK_COMMENT: 20
};

export function calculateRiskScore(
  diffs: ClauseDiff[],
  comments: Comment[]
): RiskScoreDetail {
  const modifiedClauses = diffs.filter(d => d.hasDiff && !d.isNew && !d.isMissing).length;
  const missingClauses = diffs.filter(d => d.isMissing).length;
  const newClauses = diffs.filter(d => d.isNew).length;

  const highRiskClauseNumbers = new Set(
    comments
      .filter(c => c.riskLevel === 'high')
      .map(c => c.clauseNumber)
  );
  const highRiskComments = highRiskClauseNumbers.size;

  const modifiedScore = modifiedClauses * SCORE_RULES.MODIFIED_CLAUSE;
  const missingScore = missingClauses * SCORE_RULES.MISSING_CLAUSE;
  const newScore = newClauses * SCORE_RULES.NEW_CLAUSE;
  const highRiskCommentScore = highRiskComments * SCORE_RULES.HIGH_RISK_COMMENT;

  const totalScore = Math.min(
    100,
    modifiedScore + missingScore + newScore + highRiskCommentScore
  );

  let level: RiskScoreLevel;
  if (totalScore <= 30) {
    level = 'low';
  } else if (totalScore <= 60) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    totalScore,
    level,
    modifiedClauses,
    missingClauses,
    newClauses,
    highRiskComments,
    breakdown: {
      modifiedScore,
      missingScore,
      newScore,
      highRiskCommentScore
    }
  };
}

export function getRiskScoreColor(score: number): string {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

export function getRiskScoreBgColor(score: number): string {
  if (score <= 30) return '#ecfdf5';
  if (score <= 60) return '#fffbeb';
  return '#fef2f2';
}

export function getRiskScoreLabel(score: number): string {
  if (score <= 30) return '低风险';
  if (score <= 60) return '中风险';
  return '高风险';
}
