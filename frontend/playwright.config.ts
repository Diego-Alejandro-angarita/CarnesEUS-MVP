import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E: un navegador real contra Angular, Django y Postgres juntos.
 *
 * En la maquina reutiliza lo que ya este corriendo (docker compose up). En CI
 * levanta el backend y el servidor de desarrollo de Angular por su cuenta.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: '**/*.setup.ts' },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/personal.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'python manage.py runserver 8001 --noreload',
      cwd: '../backend',
      // 127.0.0.1 y no localhost: runserver solo escucha en IPv4 y Node puede
      // resolver localhost a ::1.
      url: 'http://127.0.0.1:8001/api/salud/',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      env: { BACKEND_URL: 'http://127.0.0.1:8001' },
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
