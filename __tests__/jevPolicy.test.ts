import {
  decideTriage, decideReply, decidePhoto, triageRequest, replyCheckRequest, photoCheckRequest,
  THRESHOLDS, EATING_DISORDER_MESSAGE, OFF_TOPIC_MESSAGE,
} from '../supabase/functions/_shared/jevPolicy';

describe('decideTriage', () => {
  it('fails open when Jev is unavailable', () => {
    expect(decideTriage(null)).toBe('allow');
    expect(decideTriage({})).toBe('allow');
  });
  it('blocks eating-disorder signals above threshold, ahead of everything else', () => {
    expect(decideTriage({ eatingDisorder: 0.95, offTopic: 0.99, medical: 0.99 })).toBe('block_eating_disorder');
    expect(decideTriage({ eatingDisorder: THRESHOLDS.eatingDisorder })).toBe('block_eating_disorder');
  });
  it('does not block just below the threshold', () => {
    expect(decideTriage({ eatingDisorder: 0.69, veryLowCalorie: 0.69, offTopic: 0.89, medical: 0.69 })).toBe('allow');
  });
  it('blocks a stated very-low daily calorie goal', () => {
    expect(decideTriage({ eatingDisorder: 0.2, veryLowCalorie: 0.85 })).toBe('block_eating_disorder');
  });
  it('blocks clear off-topic, steers medical', () => {
    expect(decideTriage({ offTopic: 0.95 })).toBe('block_off_topic');
    expect(decideTriage({ medical: 0.8 })).toBe('steer_medical');
  });
});

describe('decideReply / decidePhoto', () => {
  it('replaces dangerous-diet replies, footers medical ones, allows the rest', () => {
    expect(decideReply(null)).toBe('allow');
    expect(decideReply({ dangerousDiet: 0.5, medicalAdvice: 0.5 })).toBe('allow');
    expect(decideReply({ dangerousDiet: 0.9, medicalAdvice: 0.9 })).toBe('replace_with_safety');
    expect(decideReply({ dangerousDiet: 0.1, medicalAdvice: 0.9 })).toBe('append_footer');
  });
  it('flags non-food or implausible calories, fails open otherwise', () => {
    expect(decidePhoto(null)).toBe('ok');
    expect(decidePhoto({ isFood: 0.9, plausible: 0.9 })).toBe('ok');
    expect(decidePhoto({ isFood: 0.1, plausible: 0.9 })).toBe('doubtful');
    expect(decidePhoto({ isFood: 0.9, plausible: 0.1 })).toBe('doubtful');
  });
});

describe('request builders', () => {
  it('triage sends only recent, capped conversation and no PII fields', () => {
    const msgs = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(5000) }));
    const r = triageRequest(msgs);
    expect(r.state.recent_conversation).toHaveLength(4);
    expect(r.state.recent_conversation[0].text.length).toBe(600);
    expect(r.state.latest_user_message.length).toBe(1000);
    expect(Object.keys(r.questions)).toEqual(['eatingDisorder', 'veryLowCalorie', 'medical', 'offTopic']);
  });
  it('reply and photo checks build valid noul questions', () => {
    expect(Object.keys(replyCheckRequest('hi').questions)).toEqual(['dangerousDiet', 'medicalAdvice']);
    const p = photoCheckRequest('Rice', [{ name: 'rice', grams: 100, calories: 130 }], 130);
    expect(Object.keys(p.questions)).toEqual(['isFood', 'plausible']);
  });
  it('fixed messages are non-empty', () => {
    expect(EATING_DISORDER_MESSAGE.length).toBeGreaterThan(50);
    expect(OFF_TOPIC_MESSAGE.length).toBeGreaterThan(20);
  });
});
