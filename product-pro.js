/* ============================================================
   JOLLY Product Pro — Teqlər, Variantlar, Klonlama
   Məhsul detalı səhifəsinə özünü əlavə edir (route hook)
   ============================================================ */

const JollyProductPro = (() => {
  const esc = (s) => (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s));
  const TAG_COLORS = ['#7c8aff', '#29e0c9', '#ff5fa2', '#ffb84d', '#a78bfa'];

  function currentProductId() {
    const m = (window.location.hash || '').match(/^#\/product\/([^\/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function tagColor(tag) {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
    return TAG_COLORS[h];
  }

  function renderBlock(p) {
    const tags = p.tags || [];
    const variants = p.variants || [];
    return `
      <div class="glass anim-pop" style="padding:16px;margin-top:14px;" id="proBlock">
        <div class="section-title" style="margin-top:0;">🏷️ Teqlər</div>
        <div class="pro-tags" id="proTagsZone">
          ${tags.map((t, i) => `<span class="pro-tag" style="background:${tagColor(t)}22;color:${tagColor(t)};border:1px solid ${tagColor(t)}55;">${esc(t)} <span onclick="JollyProductPro.removeTag('${p.id}',${i})" style="cursor:pointer;margin-left:4px;">✕</span></span>`).join('')}
          <span class="pro-tag" style="cursor:pointer;background:var(--glass);border:1px solid var(--border-soft);" onclick="JollyProductPro.addTag('${p.id}')">+ əlavə et</span>
        </div>

        <div class="section-title">🎨 Variantlar</div>
        <div class="variant-row" id="proVariantsZone">
          ${variants.map((v, i) => `<span class="variant-chip on" onclick="JollyProductPro.removeVariant('${p.id}',${i})">${v.color ? `<span class="vc-dot" style="background:${esc(v.color)};"></span>` : ''}${esc(v.name)} ✕</span>`).join('')}
          <span class="variant-chip add" onclick="JollyProductPro.addVariant('${p.id}')">+</span>
        </div>

        <div class="row" style="gap:10px;margin-top:14px;">
          <button class="btn btn-ghost btn-block" onclick="JollyProductPro.clone('${p.id}')">📋 Klonla — yeni məhsul kimi kopyala</button>
        </div>
      </div>
    `;
  }

  function inject() {
    const id = currentProductId();
    const main = document.getElementById('main');
    if (!main) return;
    const old = document.getElementById('proBlock');
    if (old) old.remove();
    if (!id) return;
    const p = JollyDB.Products.get(id);
    if (!p) return;
    main.insertAdjacentHTML('beforeend', renderBlock(p));
  }

  function addTag(id) {
    const val = prompt('Yeni teq (məs. "yay kolleksiyası"):');
    if (!val || !val.trim()) return;
    const p = JollyDB.Products.get(id);
    if (!p) return;
    const tags = p.tags || [];
    if (tags.includes(val.trim())) { Toast.info('Bu teq artıq var'); return; }
    tags.push(val.trim());
    JollyDB.Products.update(id, { tags });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Teq əlavə olundu');
    inject();
  }
  function removeTag(id, idx) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    const tags = (p.tags || []).filter((_, i) => i !== idx);
    JollyDB.Products.update(id, { tags });
    inject();
  }

  function addVariant(id) {
    const name = prompt('Variant adı (məs. "Qırmızı - L ölçü"):');
    if (!name || !name.trim()) return;
    const color = prompt('Rəng kodu (istəyə bağlı, məs. #ff5fa2 və ya "qırmızı") — boş buraxa bilərsən:');
    const p = JollyDB.Products.get(id);
    if (!p) return;
    const variants = p.variants || [];
    variants.push({ name: name.trim(), color: (color || '').trim() });
    JollyDB.Products.update(id, { variants });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Variant əlavə olundu');
    inject();
  }
  function removeVariant(id, idx) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    const variants = (p.variants || []).filter((_, i) => i !== idx);
    JollyDB.Products.update(id, { variants });
    inject();
  }

  function clone(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    if (!confirm(`"${p.name}" klonlansın? Yeni məhsul kimi kopyalanacaq, sonra redaktə edə bilərsən.`)) return;
    const copy = { ...p };
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    copy.name = (p.name || 'Adsız') + ' (kopya)';
    const created = JollyDB.Products.add(copy);
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof JollyApp !== 'undefined' && JollyApp.celebrate) JollyApp.celebrate();
    Toast.success('Klonlandı — indi redaktə et');
    JollyRouter.go('#/product/' + created.id + '/edit');
  }

  function bindHook() {
    window.addEventListener('hashchange', () => setTimeout(inject, 30));
    setTimeout(inject, 30);
  }
  document.addEventListener('DOMContentLoaded', bindHook);

  return { addTag, removeTag, addVariant, removeVariant, clone };
})();
