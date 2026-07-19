/* JOLLY Security — Müvəqqəti deaktiv */
const JollySecurity = {
  init(){}, isViewer(){return false;}, isAdmin(){return true;},
  isUnlocked(){return true;}, clearSession(){}, applyViewerMode(){},
  toggleEnabled(){}, toggleViewer(){}, setupPin(){}, setupViewerPin(){},
  setupPattern(){}, setupBiometric(){}, confirmSetupPin(){},
  genNewRecovery(){}, disableAll(){}, clearActivityLog(){},
  switchUser(){}, lockNow(){}, can(){return true;},
  getRole(){return 'admin';}, getSession(){return {role:'admin'};},
  setSession(){}, startViewerObserver(){},
};
