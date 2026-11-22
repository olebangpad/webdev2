import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base를 상대 경로로 두어 GitHub Pages의 하위 경로에서도 그대로 동작한다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
