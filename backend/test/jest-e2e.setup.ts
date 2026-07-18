import { config } from 'dotenv';
import { resolve } from 'path';

// Load backend/.env so OPENAI_API_KEY is available at describe-collect time
// (gate: describe.skip when key missing). ConfigModule also loads .env later.
config({ path: resolve(__dirname, '../.env') });

jest.setTimeout(120_000);
