import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFreeOffers, isOwned } from '../src/epic-api.js';

const offerPayload = {
  data: { Catalog: { searchStore: { elements: [{
    title: 'Test Game', id: 'offer-1', namespace: 'ns-1', items: [{ id: 'item-1' }],
    catalogNs: { mappings: [{ pageType: 'productHome', pageSlug: 'test-game' }] },
    promotions: { promotionalOffers: [{ promotionalOffers: [{
      startDate: '2026-08-20T00:00:00.000Z', endDate: '2026-09-01T00:00:00.000Z',
      discountSetting: { discountPercentage: 0 }
    }] }] }
  }] } } }
};

test('extracts active free promotion with offer and catalog IDs', () => {
  const [offer] = extractFreeOffers(offerPayload, new Date('2026-08-29T00:00:00Z'));
  assert.equal(offer.offerId, 'offer-1');
  assert.deepEqual(offer.catalogItemIds, ['item-1']);
  assert.equal(offer.url, 'https://store.epicgames.com/en-US/p/test-game');
});

test('ownership matches catalog item entitlement', () => {
  const [offer] = extractFreeOffers(offerPayload, new Date('2026-08-29T00:00:00Z'));
  assert.equal(isOwned(offer, [{ namespace: 'ns-1', catalogItemId: 'item-1', status: 'ACTIVE' }]), true);
  assert.equal(isOwned(offer, [{ namespace: 'ns-1', catalogItemId: 'other', status: 'ACTIVE' }]), false);
});
