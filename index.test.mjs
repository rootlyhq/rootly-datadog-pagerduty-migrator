import { describe, it, expect } from 'vitest';
import { normalizedServiceName, getErrorMessage, resultsCSV } from './index.js';

describe('normalizedServiceName', () => {
  it('lowercases and replaces special chars with underscore', () => {
    expect(normalizedServiceName('Production On-Call')).toBe('production_on-call');
  });

  it('strips leading underscores and dashes', () => {
    expect(normalizedServiceName('[Production] On-Call')).toBe('production_on-call');
  });

  it('handles already normalized names', () => {
    expect(normalizedServiceName('production_on-call')).toBe('production_on-call');
  });

  it('handles names with multiple special chars', () => {
    expect(normalizedServiceName('Team (US) / East Coast')).toBe('team_us_east_coast');
  });

  it('handles empty string', () => {
    expect(normalizedServiceName('')).toBe('');
  });
});

describe('getErrorMessage', () => {
  it('extracts message from API error response', () => {
    const error = new Error('HTTP 400');
    error.response = { data: { errors: ['Webhook already exists'] } };
    expect(getErrorMessage(error)).toBe('Webhook already exists');
  });

  it('falls back to error.message when no response', () => {
    const error = new Error('Network timeout');
    expect(getErrorMessage(error)).toBe('Network timeout');
  });

  it('falls back to Unknown error when nothing available', () => {
    expect(getErrorMessage({})).toBe('Unknown error');
  });

  it('handles response with no errors array', () => {
    const error = new Error('HTTP 500');
    error.response = { data: {} };
    expect(getErrorMessage(error)).toBe('HTTP 500');
  });

  it('handles response with empty errors array', () => {
    const error = new Error('HTTP 422');
    error.response = { data: { errors: [] } };
    expect(getErrorMessage(error)).toBe('HTTP 422');
  });
});

describe('resultsCSV', () => {
  it('returns header row when no results', () => {
    const csv = resultsCSV();
    expect(csv).toContain('Monitor');
    expect(csv).toContain('Error');
    expect(csv.split('\n')).toHaveLength(1);
  });
});
