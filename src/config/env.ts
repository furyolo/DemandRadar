import { config as loadDotenv } from 'dotenv';

export function loadDemandRadarEnv(path = 'config/.env'): void {
  loadDotenv({ path, override: false, quiet: true });
}
