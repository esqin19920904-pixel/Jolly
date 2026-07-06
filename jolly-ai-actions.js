/* ============================================================
   JOLLY AI Actions — AI-nin əl-qolu: işi özü görür
   Təhlükəli əməliyyatlarda təsdiq + PIN qoruması
   ============================================================ */

const JollyAIActions = (() => {
  function openProduct(id) { JollyRouter.go('#/product/' + id); }
  function editProduct(id) { JollyRouter.go('#/product/' + id + '/edit'); }
  function openRoute(route) { JollyRouter.go(route); }

  function shareProduct(id) {
    if (typeof JollyShare !== 'undefined') JollyShare.showSharePreview(id);
    else if (typeof JollyProducts !== 'undefined') JollyProducts.whatsappShare(id);
    else Toast.error('Paylaşım modulu yoxdur');
  }

  function openCashierBarcode(id) {
    const p = JollyDB.Products.get(id);
    const bc = p && (p.barcodes || [])[0];
    if (bc && typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(bc);
    else Toast.error('Bu məhsulun barkodu yoxdur');
  }

  function openHealth() { JollyRouter.go('#/data-doctor'); }
  function openBackup() { JollyRouter.go('#/studios/integration'); }
  function openLiveLens() {
    if (typeof JollyLiveLens !== 'undefined') JollyLiveLens.open();
    else Toast.error('Live Lens modulu yoxdur');
  }

  function openList(products, title) {
    // Chat/panel bunları kart kimi göstərir — burada sadəcə kontekst ötürülür
    if (typeof JollyAIMemoryLite !== 'undefined') JollyAIMemoryLite.set({ lastListTitle: title });
    return products;
  }

  function confirmDangerous(message) {
    if (!confirm(message || 'Bu təhlükəli əməliyyatdır. Davam edilsin?')) return false;
    const s = JollyDB.getSettings();
    if (s.pinEnabled && s.pin) {
      const entered = prompt('PIN daxil et:');
      if (entered !== s.pin) { Toast.error('PIN yanlışdır'); return false; }
    }
    return true;
  }

  function deleteProduct(id) {
    if (!confirmDangerous('Məhsul silinsin? (Səbətə düşəcək)')) return;
    if (typeof JollyProducts !== 'undefined') JollyProducts.deleteProduct(id);
  }

  /* ---------- Mərkəzi icraçı ---------- */
  function run(action) {
    if (!action || !action.type) return;
    const a = action;
    switch (a.type) {
      case 'openProduct': return openProduct(a.productId);
      case 'editProduct': return editProduct(a.productId);
      case 'shareProduct': case 'whatsapp': return shareProduct(a.productId);
      case 'cashierBarcode': return openCashierBarcode(a.productId);
      case 'showBarcode': return typeof JollyProducts !== 'undefined' && JollyProducts.showBarcode(a.barcode);
      case 'navigate': return openRoute(a.route);
      case 'health': return openHealth();
      case 'backup': return openBackup();
      case 'liveLens': return openLiveLens();
      case 'deleteProduct': return deleteProduct(a.productId);
      case 'openVisualSearch':
        if (typeof JollyChat !== 'undefined') { JollyRouter.go('#/chat'); }
        return;
      default:
        console.warn('JollyAIActions: tanınmayan action', a.type);
    }
  }

  return { run, openProduct, editProduct, shareProduct, openCashierBarcode, openRoute, openList, openHealth, openBackup, openLiveLens, deleteProduct, confirmDangerous };
})();
