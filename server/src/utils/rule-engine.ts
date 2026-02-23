import type { Rule } from '@expenses/shared';

interface TransactionInput {
  description?: string;
  merchant_norm?: string;
  mcc?: string;
  bank_category_raw?: string;
  amount_kopeks?: number;
}

interface RuleResult {
  category_id?: number;
  type?: string;
  matched_rule_id: number;
}

function matchesPattern(text: string, matchType: string, pattern: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  switch (matchType) {
    case 'contains':
      return lowerText.includes(lowerPattern);
    case 'startsWith':
      return lowerText.startsWith(lowerPattern);
    case 'equals':
      return lowerText === lowerPattern;
    case 'regex':
      try {
        return new RegExp(pattern, 'i').test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function applyRules(tx: TransactionInput, rules: Rule[]): RuleResult | null {
  // Правила сортируются по приоритету (убывание)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    // Проверка паттерна по описанию и merchant_norm
    const textToMatch = tx.description || tx.merchant_norm || '';
    if (!matchesPattern(textToMatch, rule.match_type, rule.pattern)) {
      // Попробовать merchant_norm отдельно
      if (tx.merchant_norm && tx.merchant_norm !== tx.description) {
        if (!matchesPattern(tx.merchant_norm, rule.match_type, rule.pattern)) {
          continue;
        }
      } else {
        continue;
      }
    }

    // Опциональная проверка MCC
    if (rule.mcc && tx.mcc && rule.mcc !== tx.mcc) {
      continue;
    }

    // Опциональная проверка категории банка
    if (rule.bank_category_raw && tx.bank_category_raw &&
        rule.bank_category_raw.toLowerCase() !== tx.bank_category_raw.toLowerCase()) {
      continue;
    }

    // Опциональная проверка знака суммы
    if (rule.amount_sign) {
      if (rule.amount_sign === 'positive' && (tx.amount_kopeks ?? 0) <= 0) continue;
      if (rule.amount_sign === 'negative' && (tx.amount_kopeks ?? 0) >= 0) continue;
    }

    // Правило сработало
    const result: RuleResult = { matched_rule_id: rule.id };

    if (rule.action_type === 'categorize' && rule.action_category_id) {
      result.category_id = rule.action_category_id;
    }
    if (rule.action_type === 'set_type' && rule.action_set_type) {
      result.type = rule.action_set_type;
    }
    if (rule.action_type === 'ignore') {
      result.type = 'ignore';
    }

    return result;
  }

  return null;
}
