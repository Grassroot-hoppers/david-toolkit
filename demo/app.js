document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item[data-screen]');
  const screens = document.querySelectorAll('.main-content');

  const screenMap = {
    dashboard: 'screen-dashboard',
    roadmap: 'screen-roadmap',
  };

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const target = item.dataset.screen;
      const screenId = screenMap[target];
      if (!screenId) return;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      screens.forEach(s => s.classList.remove('active'));
      document.getElementById(screenId).classList.add('active');
    });
  });
});
