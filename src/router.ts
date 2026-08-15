import { createRouter, createWebHistory } from 'vue-router'

import SurfaceHomeView from './views/SurfaceHomeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: SurfaceHomeView,
    },
  ],
  scrollBehavior() {
    return false
  },
})
