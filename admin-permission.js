/**
 * JOLLY — İcazə Mərkəzi Studio
 * Admin panelindən POS.renderAdmin() çağırır
 */
(function() {
  if (typeof ModuleRegistry === 'undefined') return;

  ModuleRegistry.register({
    id: 'admin-permissions',
    name: 'İcazə Mərkəzi',
    icon: '🛡️',
    route: '#/studios/permissions',
    group: 'Sistem',
    enabled: true,

    render() {
      // Yalnız admin
      try {
        const s = JSON.parse(sessionStorage.getItem('jolly_sec_session')||'null');
        if (s && s.role !== 'admin') {
          if (window.JollyRouter) JollyRouter.go('#/home');
          return '';
        }
      } catch(e) {}

      return `
        <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
        <div id="pos-admin-wrap"></div>
      `;
    },

    afterRender() {
      if (window.POS) POS.renderAdmin('#pos-admin-wrap');
    },
  });

})();