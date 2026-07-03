/**
 * Unit tests for scaleFood — the portion-scaling helper shared by the
 * Add Food search quantity step and the barcode portion editor.
 * Focus: calories round to whole numbers, macros keep one decimal.
 */
import { scaleFood, FoodItem } from '../services/usda';

const egg: FoodItem = {
  fdcId: 0,
  description: 'Egg',
  calories: 155,
  protein: 13,
  carbs: 1.1,
  fat: 11,
};

describe('scaleFood', () => {
  it('returns identical macros at factor 1', () => {
    const r = scaleFood(egg, 1);
    expect(r).toMatchObject({ calories: 155, protein: 13, carbs: 1.1, fat: 11 });
  });

  it('scales grams (factor = grams/100)', () => {
    // 200 g → factor 2
    const r = scaleFood(egg, 200 / 100);
    expect(r.calories).toBe(310);
    expect(r.protein).toBe(26);
    expect(r.fat).toBe(22);
  });

  it('scales by serving count', () => {
    const r = scaleFood(egg, 4);
    expect(r.calories).toBe(620);
    expect(r.protein).toBe(52);
  });

  it('rounds calories to whole and macros to one decimal', () => {
    const r = scaleFood(egg, 0.5); // 50 g
    expect(r.calories).toBe(78);   // 77.5 → 78
    expect(r.carbs).toBe(0.6);     // 0.55 → 0.6
  });

  it('preserves non-macro fields', () => {
    const r = scaleFood(egg, 3);
    expect(r.fdcId).toBe(0);
    expect(r.description).toBe('Egg');
  });
});
