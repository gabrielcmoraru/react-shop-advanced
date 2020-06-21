import formatMoney from '../lib/formatMoney';

describe('formatMoney Function', () => {
    it('works with fractional dollars', () => {
        expect(formatMoney(1)).toEqual('$0.01');
        expect(formatMoney(10)).toEqual('$0.10');
        expect(formatMoney(9)).toEqual('$0.09');
        expect(formatMoney(40)).toEqual('$0.40');
    });

    it('leaves cents off for whole dollars', () => {
        expect(formatMoney(5000)).toEqual('$50');
    });
});
