/* ============================================================
   JOLLY Tədarükçü Sifarişi — Supplier Order
   Tədarükçünü seç → o tədarükçüyə aid BÜTÜN məhsullar avtomatik
   siyahıya dolur (JollyDB.Products.filter({supplier}) ilə) →
   hər məhsulun yanında sifariş miqdarını yaz → Kopyala/WhatsApp
   ilə göndər, istəsən Sifariş Tarixçəsinə yadda saxla.

   Tamamilə müstəqil modul — ModuleRegistry-ə qeydiyyatdan keçir,
   "JOLLY Store"da avtomatik görünür.
   Route: #/supplier-order
   ============================================================ */

const JollySupplierOrder = (() => {
  const ORDERS_KEY = 'jolly_supplier_orders';

  let selectedSupplier = null;
  let quantities = {}; // { productId: qtyString }

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getOrders() { return JollyDB.read(ORDERS_KEY, []); }
  function saveOrder(order) {
    const orders = getOrders();
    orders.unshift(order);
    JollyDB.write(ORDERS_KEY, orders);
  }
  function nextOrderNumber() { return getOrders().length + 1; }

  /* ============================================================
     ƏSAS SƏHİFƏ
     ============================================================ */
  function render(rest) {
    if (rest === 'history') return renderHistory();
    if (rest && rest.indexOf('history/') === 0) return renderOrderDetail(rest.slice(8));

    selectedSupplier = null;
    quantities = {};
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📝 Tədarükçü Sifarişi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Tədarükçünü seç — məhsulları avtomatik dolduracaq.</p>

      <button class="btn btn-ghost btn-block" style="margin-bottom:16px;" onclick="JollyRouter.go('#/supplier-order/history')">📄 Sifariş Tarixçəsi</button>

      <div id="soContent">${renderSupplierPicker()}</div>
    `;
  }

  function renderSupplierPicker() {
    const suppliers = JollyDB.Suppliers.all();
    if (!suppliers.length) {
      return '<div class="empty-state"><div class="big-icon">🚚</div><h3>Hələ tədarükçü yoxdur</h3><p>Əvvəlcə bir məhsula tədarükçü təyin et.</p></div>';
    }
    return `
      <div class="section-title" style="margin-top:0;">Tədarükçünü seç</div>
      <div class="glass" style="padding:4px 14px;">
        ${suppliers.map(s => `
          <div class="list-row" style="cursor:pointer;" onclick="JollySupplierOrder.selectSupplier('${esc(s.name)}')">
            <span>🚚 ${esc(s.code ? s.code + ' - ' + s.name : s.name)}</span>
            <span style="color:var(--accent-1);">›</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function selectSupplier(name) {
    selectedSupplier = name;
    quantities = {};
    const zone = document.getElementById('soContent');
    if (zone) zone.innerHTML = renderOrderForm();
    if (typeof JollyStorage !== 'undefined') setTimeout(() => JollyStorage.hydrate(), 0);
  }

  function changeSupplier() {
    selectedSupplier = null;
    quantities = {};
    const zone = document.getElementById('soContent');
    if (zone) zone.innerHTML = renderSupplierPicker();
  }

  function renderOrderForm() {
    const products = JollyDB.Products.filter({ supplier: selectedSupplier });
    return `
      <div class="glass" style="padding:14px;margin-bottom:14px;">
        <div class="row between">
          <div>
            <div class="muted" style="font-size:11px;text-transform:uppercase;">Tədarükçü</div>
            <div style="font-family:var(--font-display);font-size:17px;font-weight:700;">🚚 ${esc(selectedSupplier)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="JollySupplierOrder.changeSupplier()">Dəyiş</button>
        </div>
      </div>

      ${products.length ? `
        <div class="section-title" style="margin-top:0;">Məhsullar (${products.length}) — miqdar yaz</div>
        <div class="glass" style="padding:4px 14px;margin-bottom:14px;" id="soProductList">
          ${products.map(p => renderProductRow(p)).join('')}
        </div>
        <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="JollySupplierOrder.finalizeOrder()">✅ Sifarişi yadda saxla</button>
        <div class="row" style="gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollySupplierOrder.copyOrder()">📋 Kopyala</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollySupplierOrder.whatsappOrder()">📤 WhatsApp</button>
        </div>
      ` : '<div class="empty-state"><div class="big-icon">📦</div><h3>Bu tədarükçüdən məhsul yoxdur</h3></div>'}
    `;
  }

  function renderProductRow(p) {
    const thumb = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:38px;height:38px;object-fit:cover;border-radius:8px;">`
      : `<div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;">🧴</div>`;
    return `
      <div class="list-row" style="align-items:center;flex-wrap:nowrap;">
        <span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span style="flex-shrink:0;">${thumb}</span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${esc(p.name || 'Adsız')}</span>
        </span>
        <input type="number" inputmode="numeric" min="0" placeholder="0" value="${quantities[p.id] || ''}"
          style="width:56px;flex-shrink:0;padding:8px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid var(--border-soft);color:var(--text-hi);text-align:center;"
          oninput="JollySupplierOrder.setQty('${p.id}', this.value)">
      </div>
    `;
  }

  function setQty(id, val) { quantities[id] = val; }

  function getOrderItems() {
    const products = JollyDB.Products.filter({ supplier: selectedSupplier });
    return products
      .map(p => ({ productId: p.id, name: p.name || 'Adsız', qty: parseInt(quantities[p.id], 10) || 0 }))
      .filter(it => it.qty > 0);
  }

  function buildOrderText(items) {
    const lines = [`📦 Sifariş — ${selectedSupplier}`, ''];
    items.forEach(it => lines.push(`- ${it.name}: ${it.qty} ədəd`));
    return lines.join('\n');
  }

  function copyOrder() {
    const items = getOrderItems();
    if (!items.length) { Toast.error('Heç bir məhsula miqdar yazılmayıb'); return; }
    const text = buildOrderText(items);
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); Toast.success('Sifariş kopyalandı'); } catch (e) { Toast.error('Kopyalanmadı'); }
    ta.remove();
  }

  function whatsappOrder() {
    const items = getOrderItems();
    if (!items.length) { Toast.error('Heç bir məhsula miqdar yazılmayıb'); return; }
    const text = buildOrderText(items);
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  function finalizeOrder() {
    const items = getOrderItems();
    if (!items.length) { Toast.error('Heç bir məhsula miqdar yazılmayıb'); return; }
    const order = {
      id: JollyDB.uid('sfr'),
      number: nextOrderNumber(),
      date: Date.now(),
      supplier: selectedSupplier,
      items,
    };
    saveOrder(order);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`📄 Sifariş #${order.number} yadda saxlanıldı`);
    quantities = {};
    const zone = document.getElementById('soContent');
    if (zone) zone.innerHTML = renderOrderForm();
  }

  /* ============================================================
     SİFARİŞ TARİXÇƏSİ
     ============================================================ */
  function renderHistory() {
    const orders = getOrders();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/supplier-order')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📄 Sifariş Tarixçəsi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">${orders.length} sifariş</p>
      <div class="glass" style="padding:4px 14px;">
        ${orders.length ? orders.map(o => `
          <div class="list-row" style="cursor:pointer;" onclick="JollyRouter.go('#/supplier-order/history/${o.id}')">
            <span>📝 Sifariş #${o.number} — 🚚 ${esc(o.supplier)}</span>
            <span class="muted" style="font-size:11px;">${new Date(o.date).toLocaleDateString('az-AZ')} ›</span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hələ sifariş yoxdur</div>'}
      </div>
    `;
  }

  function renderOrderDetail(id) {
    const order = getOrders().find(o => o.id === id);
    if (!order) return `<div class="back-btn anim-slide" onclick="JollyRouter.go('#/supplier-order/history')">‹ Geri</div><div class="empty-state"><div class="big-icon">📭</div><h3>Sifariş tapılmadı</h3></div>`;
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/supplier-order/history')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📝 Sifariş #${order.number}</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">🚚 ${esc(order.supplier)} · ${new Date(order.date).toLocaleString('az-AZ')}</p>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        ${order.items.map(it => `
          <div class="list-row" ${it.productId ? `onclick="JollyRouter.go('#/product/${it.productId}')" style="cursor:pointer;"` : ''}>
            <span>${esc(it.name)}</span>
            <span class="mono" style="color:var(--accent-2);">${it.qty} ədəd</span>
          </div>
        `).join('')}
      </div>
      <div class="row" style="gap:10px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="JollySupplierOrder.copyOrderRecord('${order.id}')">📋 Kopyala</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="JollySupplierOrder.whatsappOrderRecord('${order.id}')">📤 WhatsApp</button>
      </div>
    `;
  }

  function copyOrderRecord(id) {
    const order = getOrders().find(o => o.id === id);
    if (!order) return;
    const lines = [`📦 Sifariş — ${order.supplier}`, ''];
    order.items.forEach(it => lines.push(`- ${it.name}: ${it.qty} ədəd`));
    const ta = document.createElement('textarea');
    ta.value = lines.join('\n'); document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); Toast.success('Kopyalandı'); } catch (e) { Toast.error('Kopyalanmadı'); }
    ta.remove();
  }

  function whatsappOrderRecord(id) {
    const order = getOrders().find(o => o.id === id);
    if (!order) return;
    const lines = [`📦 Sifariş — ${order.supplier}`, ''];
    order.items.forEach(it => lines.push(`- ${it.name}: ${it.qty} ədəd`));
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'supplier-order',
      name: 'Tədarükçü Sifarişi',
      icon: '📝',
      route: '#/supplier-order',
      group: 'Anbar',
      enabled: true,
      render(rest) { return render(rest); },
    });
  }

  return {
    selectSupplier, changeSupplier, setQty, copyOrder, whatsappOrder, finalizeOrder,
    copyOrderRecord, whatsappOrderRecord,
  };
})();
