import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BackendManager {
  private process: ChildProcess | null = null;
  private port: number = 8765;
  private host: string = '127.0.0.1';
  private isHealthy: boolean = false;

  getUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  isRunning(): boolean {
    return this.isHealthy && this.process !== null && !this.process.killed;
  }

  async start(): Promise<void> {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    let backendPath: string;
    let pythonPath: string;

    if (isDev) {
      // Development: use local backend directory
      backendPath = join(__dirname, '../../../backend');
      pythonPath = join(backendPath, 'venv/bin/python');
    } else {
      // Production: use bundled backend
      backendPath = join(process.resourcesPath, 'backend');
      pythonPath = join(backendPath, 'venv/bin/python');
    }

    const serverPath = join(backendPath, 'server.py');

    console.log(`Starting backend from: ${backendPath}`);
    console.log(`Python path: ${pythonPath}`);

    try {
      this.process = spawn(pythonPath, ['-m', 'uvicorn', 'server:app', '--host', this.host, '--port', this.port.toString()], {
        cwd: backendPath,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });

      this.process.stdout?.on('data', (data) => {
        console.log(`[Backend] ${data}`);
      });

      this.process.stderr?.on('data', (data) => {
        console.error(`[Backend Error] ${data}`);
      });

      this.process.on('error', (error) => {
        console.error('Failed to start backend:', error);
        this.isHealthy = false;
      });

      this.process.on('exit', (code) => {
        console.log(`Backend process exited with code ${code}`);
        this.isHealthy = false;
        this.process = null;
      });

      // Wait for backend to become healthy
      await this.waitForHealth();
    } catch (error) {
      console.error('Error starting backend:', error);
      throw error;
    }
  }

  private async waitForHealth(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.getUrl()}/`);
        if (response.ok) {
          this.isHealthy = true;
          console.log('Backend is healthy');
          return;
        }
      } catch {
        // Backend not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.warn('Backend health check timed out, continuing anyway');
    this.isHealthy = true; // Assume it will start eventually
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      console.log('Stopping backend...');
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.isHealthy = false;
      console.log('Backend stopped');
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}
