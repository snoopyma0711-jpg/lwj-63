import { ContractSummary } from '../types';

export interface ExtractedSummary {
  partyA: string | null;
  partyB: string | null;
  contractAmount: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  paymentMethod: string | null;
  penaltyRatio: string | null;
  confidentialityPeriod: string | null;
}

export function extractContractSummary(rawContent: string): ExtractedSummary {
  const content = rawContent.replace(/\r/g, '');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = content;

  return {
    partyA: extractPartyA(fullText, lines),
    partyB: extractPartyB(fullText, lines),
    contractAmount: extractContractAmount(fullText, lines),
    effectiveDate: extractEffectiveDate(fullText, lines),
    expiryDate: extractExpiryDate(fullText, lines),
    paymentMethod: extractPaymentMethod(fullText, lines),
    penaltyRatio: extractPenaltyRatio(fullText, lines),
    confidentialityPeriod: extractConfidentialityPeriod(fullText, lines)
  };
}

function extractPartyA(fullText: string, lines: string[]): string | null {
  const patterns = [
    /甲方[：:(（\s]*([^，。；\n\r)]+?)(?:[，。；\n\r]|乙方)/i,
    /甲方[：:(（\s]*([^\n\r]+)/i,
    /出租方[：:(（\s]*([^，。；\n\r)]+)/i,
    /卖方[：:(（\s]*([^，。；\n\r)]+)/i,
    /发包人[：:(（\s]*([^，。；\n\r)]+)/i,
    /[（(]甲方[)）][：:\s]*([^\n\r]+)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim().replace(/[：:]$/, '').trim();
      if (result.length > 0 && result.length < 100) {
        return result;
      }
    }
  }

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    if (line.includes('甲方') && !line.includes('乙方')) {
      const match = line.match(/甲方[：:(（\s]*(.+)/i);
      if (match && match[1]) {
        const result = match[1].trim().replace(/[：:]$/, '').trim();
        if (result.length > 0 && result.length < 100) {
          return result;
        }
      }
    }
  }

  return null;
}

function extractPartyB(fullText: string, lines: string[]): string | null {
  const patterns = [
    /乙方[：:(（\s]*([^，。；\n\r)]+)/i,
    /[（(]乙方[)）][：:\s]*([^\n\r]+)/i,
    /承租方[：:(（\s]*([^，。；\n\r)]+)/i,
    /买方[：:(（\s]*([^，。；\n\r)]+)/i,
    /承包人[：:(（\s]*([^，。；\n\r)]+)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim().replace(/[：:]$/, '').trim();
      if (result.length > 0 && result.length < 100 && !result.includes('甲方')) {
        return result;
      }
    }
  }

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    if (line.includes('乙方') && !line.includes('甲方')) {
      const match = line.match(/乙方[：:(（\s]*(.+)/i);
      if (match && match[1]) {
        const result = match[1].trim().replace(/[：:]$/, '').trim();
        if (result.length > 0 && result.length < 100) {
          return result;
        }
      }
    }
  }

  return null;
}

function extractContractAmount(fullText: string, lines: string[]): string | null {
  const patterns = [
    /合同金额[：:(（\s]*([^\n\r，。；]+)/i,
    /合同价款[：:(（\s]*([^\n\r，。；]+)/i,
    /合同总价[：:(（\s]*([^\n\r，。；]+)/i,
    /总金额[：:(（\s]*([^\n\r，。；]+)/i,
    /价款[：:(（\s]*([^\n\r，。；]+)/i,
    /租金[：:(（\s]*([^\n\r，。；]+)/i,
    /人民币[：:(（\s]*([^\n\r，。；]+元)/i,
    /(￥[0-9,]+\.?[0-9]*)/,
    /([0-9,]+\.?[0-9]*\s*元)/
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim();
      if (result.length > 0 && result.length < 100) {
        return result;
      }
    }
  }

  for (const line of lines) {
    if (line.includes('金额') || line.includes('价款') || line.includes('价格')) {
      const numMatch = line.match(/(￥?[0-9,]+\.?[0-9]*\s*(?:元|万元|万元整)?)/);
      if (numMatch) {
        return numMatch[1].trim();
      }
    }
  }

  return null;
}

function extractEffectiveDate(fullText: string, lines: string[]): string | null {
  const patterns = [
    /生效日期[：:(（\s]*([^\n\r，。；]+)/i,
    /合同生效[：:(（\s]*([^\n\r，。；]+)/i,
    /有效期开始[：:(（\s]*([^\n\r，。；]+)/i,
    /开始日期[：:(（\s]*([^\n\r，。；]+)/i,
    /自[：:(（\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i,
    /从[：:(（\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim();
      if (result.length > 0 && result.length < 50) {
        return result;
      }
    }
  }

  const dateRangePattern = /有效期[：:(（\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)\s*(?:至|到|-|~)\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i;
  const rangeMatch = fullText.match(dateRangePattern);
  if (rangeMatch && rangeMatch[1]) {
    return rangeMatch[1].trim();
  }

  const simpleDatePattern = /([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = simpleDatePattern.exec(fullText)) !== null) {
    dates.push(dateMatch[1]);
  }
  if (dates.length >= 1) {
    return dates[0];
  }

  return null;
}

function extractExpiryDate(fullText: string, lines: string[]): string | null {
  const patterns = [
    /到期日期[：:(（\s]*([^\n\r，。；]+)/i,
    /截止日期[：:(（\s]*([^\n\r，。；]+)/i,
    /结束日期[：:(（\s]*([^\n\r，。；]+)/i,
    /合同到期[：:(（\s]*([^\n\r，。；]+)/i,
    /有效期至[：:(（\s]*([^\n\r，。；]+)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim();
      if (result.length > 0 && result.length < 50) {
        return result;
      }
    }
  }

  const dateRangePattern = /有效期[：:(（\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)\s*(?:至|到|-|~)\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i;
  const rangeMatch = fullText.match(dateRangePattern);
  if (rangeMatch && rangeMatch[2]) {
    return rangeMatch[2].trim();
  }

  const simpleDatePattern = /([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = simpleDatePattern.exec(fullText)) !== null) {
    dates.push(dateMatch[1]);
  }
  if (dates.length >= 2) {
    return dates[dates.length - 1];
  }

  return null;
}

function extractPaymentMethod(fullText: string, lines: string[]): string | null {
  const patterns = [
    /付款方式[：:(（\s]*([^\n\r。；]+)/i,
    /支付方式[：:(（\s]*([^\n\r。；]+)/i,
    /结算方式[：:(（\s]*([^\n\r。；]+)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim().replace(/[。；]$/, '').trim();
      if (result.length > 0 && result.length < 200) {
        return result;
      }
    }
  }

  const keywords = ['银行转账', '现金', '支票', '汇票', '月结', '季度结', '年结', '一次性支付', '分期付款'];
  for (const keyword of keywords) {
    if (fullText.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

function extractPenaltyRatio(fullText: string, lines: string[]): string | null {
  const patterns = [
    /违约金[：:(（\s]*([^\n\r。；]+)/i,
    /违约金比例[：:(（\s]*([^\n\r。；]+)/i,
    /逾期违约金[：:(（\s]*([^\n\r。；]+)/i,
    /滞纳金[：:(（\s]*([^\n\r。；]+)/i,
    /([0-9.]+%\s*[每／/]\s*日)/i,
    /(每日[0-9.]+%)/i,
    /(日[0-9.]+‰)/i,
    /([0-9.]+‰\s*[每／/]\s*日)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim().replace(/[。；]$/, '').trim();
      if (result.length > 0 && result.length < 100) {
        return result;
      }
    }
  }

  return null;
}

function extractConfidentialityPeriod(fullText: string, lines: string[]): string | null {
  const patterns = [
    /保密期限[：:(（\s]*([^\n\r。；]+)/i,
    /保密义务[：:(（\s]*([^\n\r。；]+)/i,
    /保密期[：:(（\s]*([^\n\r。；]+)/i,
    /保密[：:(（\s]*([^\n\r。；]*年)/i,
    /([0-9]+\s*年)\s*保密/i,
    /保密([0-9]+\s*年)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const result = match[1].trim().replace(/[。；]$/, '').trim();
      if (result.length > 0 && result.length < 100) {
        return result;
      }
    }
  }

  const yearPattern = /([0-9]+\s*年)/g;
  for (const line of lines) {
    if (line.includes('保密') || line.includes('保密期限')) {
      const yearMatch = line.match(yearPattern);
      if (yearMatch) {
        return yearMatch[0];
      }
    }
  }

  if (fullText.includes('永久保密') || fullText.includes('长期保密')) {
    return '永久';
  }

  return null;
}
