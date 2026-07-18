/**
 * sanitizeSnapResult — normalizes analyze-photo responses:
 *  - itemized (new) responses keep items/confidence/notes
 *  - legacy responses (totals only) still produce a valid SnapResult
 *  - malformed entries are dropped, non-numeric fields default to 0
 */
jest.mock('../services/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));

import { sanitizeSnapResult } from '../services/foodSnap';

describe('sanitizeSnapResult', () => {
  it('passes through an itemized response with confidence and notes', () => {
    const r = sanitizeSnapResult({
      name: 'Grilled chicken with rice',
      calories: 650, protein: 45, carbs: 60, fat: 22,
      items: [
        { name: 'Grilled chicken breast', grams: 150, calories: 250, protein: 40, carbs: 0, fat: 9 },
        { name: 'White rice', grams: 200, calories: 260, protein: 5, carbs: 56, fat: 1 },
      ],
      confidence: 'high',
      notes: 'assumed 1 tbsp oil',
    });
    expect(r.items).toHaveLength(2);
    expect(r.items![0]).toEqual({ name: 'Grilled chicken breast', grams: 150, calories: 250, protein: 40, carbs: 0, fat: 9 });
    expect(r.confidence).toBe('high');
    expect(r.notes).toBe('assumed 1 tbsp oil');
    expect(r.calories).toBe(650);
  });

  it('handles the legacy totals-only shape (no items/confidence/notes)', () => {
    const r = sanitizeSnapResult({ name: 'Pizza slice', calories: 285, protein: 12, carbs: 36, fat: 10 });
    expect(r).toEqual({ name: 'Pizza slice', calories: 285, protein: 12, carbs: 36, fat: 10 });
    expect(r.items).toBeUndefined();
    expect(r.confidence).toBeUndefined();
  });

  it('drops items without a name and defaults bad numbers to 0', () => {
    const r = sanitizeSnapResult({
      name: 'Mixed plate',
      calories: '450', protein: null, carbs: -5, fat: 'NaN',
      items: [
        { name: '', grams: 100, calories: 100, protein: 1, carbs: 1, fat: 1 },
        { name: 'Salad', grams: '80', calories: 40, protein: 2, carbs: 5, fat: 1 },
        'garbage',
      ],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items![0].name).toBe('Salad');
    expect(r.items![0].grams).toBe(80);
    expect(r.calories).toBe(450);
    expect(r.protein).toBe(0);
    expect(r.carbs).toBe(0);
    expect(r.fat).toBe(0);
  });

  it('rejects invalid confidence values and empty notes', () => {
    const r = sanitizeSnapResult({ name: 'Soup', calories: 120, protein: 4, carbs: 10, fat: 6, confidence: 'certain', notes: '   ' });
    expect(r.confidence).toBeUndefined();
    expect(r.notes).toBeUndefined();
  });

  it('survives a completely malformed payload', () => {
    const r = sanitizeSnapResult(null);
    expect(r).toEqual({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
